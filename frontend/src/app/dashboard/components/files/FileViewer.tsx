"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { atom, useAtom } from "jotai";
import * as ContextMenu   from "@radix-ui/react-context-menu";
import * as AlertDialog   from "@radix-ui/react-alert-dialog";
import {
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiTrash,
  FiArchive,
} from "react-icons/fi";
import { cn }               from "@/utils/cn";
import { iconFor }          from "@/utils/fileIcons";
import { useLasso }         from "@/hooks/useLasso";
import { useToast }         from "@/providers/toast-provider";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";

/* ------------------------------------------------------------------ */
/*                             TYPEDEFS                               */
/* ------------------------------------------------------------------ */
export interface RemoteFile {
  file_id          : number;
  original_filename: string | null;
  direct_link      : string;
}

interface Props {
  fetchEndpoint : string;
  sessionToken ?: string;
  readOnly     ?: boolean;
  title        ?: string;
}

/* ------------------------------------------------------------------ */
/*                            JOTAI ATOMS                             */
/* ------------------------------------------------------------------ */
const filesA       = () => atom<RemoteFile[]>([]);
const loadingA     = () => atom(false);
const errorA       = () => atom("");
const selectedIdsA = () => atom<Set<number>>(new Set<number>());
const downloadingA = () => atom<number | null>(null);
const zipBusyA     = () => atom(false);
const wantsDeleteA = () => atom(false);

/* ------------------------------------------------------------------ */
/*                           HELPERS                                  */
/* ------------------------------------------------------------------ */
function shortenFilename(full: string, limit = 26): string {
  if (full.length <= limit) return full;
  const dot  = full.lastIndexOf(".");
  const ext  = dot !== -1 ? full.slice(dot) : "";
  const base = dot !== -1 ? full.slice(0, dot) : full;
  const tail = Math.min(4, base.length);
  const avail = limit - ext.length - 3 - tail;
  if (avail <= 0) return base.slice(0, 1) + "…" + ext;
  return base.slice(0, avail) + "…" + base.slice(-tail) + ext;
}
const absolute = (link: string) =>
  /^(https?:)?\/\//.test(link)
    ? link
    : `${process.env.NEXT_PUBLIC_BACKEND_URL}${link}`;

/* ================================================================== */
/*                            COMPONENT                               */
/* ================================================================== */
export default function FileViewer({
  fetchEndpoint,
  sessionToken,
  readOnly = false,
  title,
}: Props) {
  const { push } = useToast();

  /* ---------- atoms ---------- */
  const [files,        setFiles]        = useAtom(useMemo(filesA,       []));
  const [loading,      setLoading]      = useAtom(useMemo(loadingA,     []));
  const [errorMsg,     setErr]          = useAtom(useMemo(errorA,       []));
  const [selectedIds,  setSel]          = useAtom(useMemo(selectedIdsA, []));
  const [downloadingId,setDL]           = useAtom(useMemo(downloadingA, []));
  const [zipBusy,      setZipBusy]      = useAtom(useMemo(zipBusyA,     []));
  const [wantsDelete,  setWantsDelete]  = useAtom(useMemo(wantsDeleteA, []));
  const [needsRefresh, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  /* ---------- fetch list ---------- */
  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const res = await fetch(fetchEndpoint, {
          headers: sessionToken ? { Authorization:`Bearer ${sessionToken}` } : undefined,
        });
        if (!res.ok) throw new Error("Failed to fetch files");
        setFiles(await res.json());
      } catch (e: any) {
        setErr(e.message || "Load error");
      } finally {
        setLoading(false);
        if (needsRefresh) setNeedsRefresh(false);
      }
    })();
  }, [fetchEndpoint, sessionToken, needsRefresh,
      setLoading, setErr, setFiles, setNeedsRefresh]);

  /* ---------- selection helpers ---------- */
  const toggleSelect = useCallback((id: number, additive: boolean) => {
    setSel(prev => {
      const next = new Set(additive ? prev : []);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [setSel]);
  const clearSel = () => setSel(new Set());

  /* ---------- marquee / lasso ---------- */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { boxStyle, isVisible: lassoVisible,
          onMouseDown: lassoDown, registerTile } =
    useLasso(ids => setSel(new Set(ids)), containerRef);

  /* ---------- keyboard (Del) ---------- */
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (e.key === "Delete" && selectedIds.size > 0) {
        e.preventDefault();
        setWantsDelete(true);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [readOnly, selectedIds.size, setWantsDelete]);

  /* ---------- actions (copy / download / zip / delete) ---------- */
  const copySelected = async () => {
    if (!selectedIds.size) return;
    const map  = new Map(files.map(f => [f.file_id, f.direct_link]));
    const urls = Array.from(selectedIds).map(id => absolute(map.get(id)!)).join("\n");
    await navigator.clipboard.writeText(urls);
    push({ title:"URLs copied", variant:"success" });
  };

  const downloadOne = async (file: RemoteFile) => {
    setDL(file.file_id);
    try {
      const res = await fetch(absolute(file.direct_link));
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href, download: file.original_filename ?? `file_${file.file_id}`,
      }).click();
      URL.revokeObjectURL(href);
    } catch (e:any) {
      push({ title:e.message ?? "Download error", variant:"error" });
    } finally { setDL(null); }
  };

  const downloadZip = async () => {
    if (zipBusy || selectedIds.size < 2) return;
    setZipBusy(true);
    try {
      const ids  = Array.from(selectedIds);
      const res  = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-download`,
        {
          method : "POST",
          headers: {
            "Content-Type":"application/json",
            ...(sessionToken && { Authorization:`Bearer ${sessionToken}` }),
          },
          body: JSON.stringify({ ids }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        throw new Error(d.detail || "ZIP download failed");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href, download:`files_${Date.now()}.zip`,
      }).click();
      URL.revokeObjectURL(href);
      push({ title:"ZIP downloaded", variant:"success" });
    } catch (e:any) {
      push({ title:e.message || "ZIP failed", variant:"error" });
    } finally { setZipBusy(false); }
  };

  const batchDelete = async () => {
    if (readOnly || !selectedIds.size) return;
    const ids = Array.from(selectedIds);
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-delete`,
        {
          method :"DELETE",
          headers:{
            "Content-Type":"application/json",
            ...(sessionToken && { Authorization:`Bearer ${sessionToken}` }),
          },
          body: JSON.stringify({ ids }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        throw new Error(d.detail || "Delete failed");
      }
      const { deleted } = await res.json();
      setFiles(prev => prev.filter(f => !deleted.includes(f.file_id)));
      clearSel();
      push({ title:`${deleted.length} file${deleted.length!==1?"s":""} deleted`, variant:"success" });
    } catch (e:any) {
      push({ title:e.message || "Delete failed", variant:"error" });
    } finally {
      setLoading(false);
      setWantsDelete(false);
    }
  };

  /* ---------- derived ---------- */
  const selCount       = selectedIds.size;
  const selectedOne    = selCount === 1 ? files.find(f => f.file_id === Array.from(selectedIds)[0]) : null;
  const deleteDialogOpen = wantsDelete && selCount > 0;

  /* ---------- Tile ---------- */
  const Tile = ({ file }:{ file:RemoteFile }) => {
    const divRef  = useRef<HTMLDivElement>(null);
    const Icon    = useMemo(() => iconFor(file.original_filename || "file"), [file.original_filename]);
    const selected = selectedIds.has(file.file_id);

    useEffect(() => {
      const el = divRef.current; if (!el) return;
      const measure = () => registerTile(file.file_id, el.getBoundingClientRect());
      measure();
      const ro = new ResizeObserver(measure); ro.observe(el);
      return () => { ro.disconnect(); registerTile(file.file_id, null); };
    }, [registerTile, file.file_id]);

    const handleClick = (e:React.MouseEvent) => {
      toggleSelect(file.file_id, e.ctrlKey || e.metaKey);
      e.stopPropagation();
    };
    const handleCtx   = () => { if (!selected) setSel(new Set([file.file_id])); };

    return (
      <div
        ref={divRef}
        onClick={handleClick}
        onContextMenu={handleCtx}
        className={cn(
          "h-32 w-full relative flex flex-col items-center justify-center gap-2 p-4",
          "rounded-lg cursor-pointer select-none outline-none",
          "border border-theme-200/50 dark:border-theme-800/50",
          "bg-theme-100/25 dark:bg-theme-900/25 hover:bg-theme-100/50 dark:hover:bg-theme-900/40",
          "shadow-sm hover:shadow-md shadow-theme-500/5",
          selected && "ring-2 ring-theme-500"
        )}
      >
        {downloadingId === file.file_id ? (
          <FiLoader className="w-6 h-6 animate-spin text-theme-700 dark:text-theme-300" />
        ) : (
          <Icon className="w-6 h-6 text-theme-700 dark:text-theme-300" />
        )}
        <p className="text-xs text-center leading-tight break-all line-clamp-2 max-h-8 overflow-hidden">
          {shortenFilename(file.original_filename || `file_${file.file_id}`)}
        </p>
        {selected && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-theme-500" />
        )}
      </div>
    );
  };

  /* ---------- skeleton tiles (first load) ---------- */
  const SkeletonGrid = () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-32 rounded-lg bg-theme-200 dark:bg-theme-800 animate-pulse"
        />
      ))}
    </div>
  );

  /* ------------------------------------------------------------------ */
  /*                                UI                                  */
  /* ------------------------------------------------------------------ */
  return (
    <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setWantsDelete}>
      <div className="relative">
        {/* top-right spinner while refreshing */}
        {loading && files.length > 0 && (
          <FiLoader className="absolute top-0 right-0 w-4 h-4 animate-spin text-theme-600" />
        )}

        {title && <h4 className="text-lg font-medium mb-3">{title}</h4>}

        {/* toolbar */}
        <div className="mb-3 flex items-center gap-3 min-h-[34px]">
          {selCount ? (
            <>
              <span className="text-sm">{selCount} selected</span>

              <ToolbarBtn onClick={copySelected} label="Copy"><FiCopy /></ToolbarBtn>

              {selCount === 1 ? (
                <ToolbarBtn onClick={() => selectedOne && downloadOne(selectedOne)} label="Download">
                  <FiDownload />
                </ToolbarBtn>
              ) : (
                <ToolbarBtn onClick={downloadZip} disabled={zipBusy} label="ZIP">
                  <FiArchive />
                </ToolbarBtn>
              )}

              {!readOnly && (
                <ToolbarBtn onClick={() => setWantsDelete(true)} label="Delete" danger>
                  <FiTrash />
                </ToolbarBtn>
              )}

              <button
                onClick={clearSel}
                className="text-xs px-2 py-0.5 bg-theme-200 dark:bg-theme-800 rounded"
              >
                Clear
              </button>
            </>
          ) : (
            <span className="opacity-0 select-none">placeholder</span>
          )}
        </div>

        {/* error */}
        {errorMsg && (
          <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
            {errorMsg}
          </p>
        )}

        {/* grid / skeleton */}
        {loading && files.length === 0 ? (
          <SkeletonGrid />
        ) : (
          <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
              <div
                ref={containerRef}
                onClick={e => {
                  if (e.target === containerRef.current && !(e.ctrlKey || e.metaKey)) clearSel();
                }}
                onMouseDown={e => { if (!(e.ctrlKey || e.metaKey)) lassoDown(e); }}
                className="relative min-h-[300px]"
              >
                {lassoVisible && (
                  <div style={boxStyle}
                    className="pointer-events-none absolute z-50 bg-blue-500/20 border-2 border-blue-500" />
                )}

                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                  {files.map(f => <Tile key={f.file_id} file={f} />)}
                </div>
              </div>
            </ContextMenu.Trigger>

            {/* context menu */}
            <ContextMenu.Content
              className="min-w-[180px] bg-theme-50 dark:bg-theme-900 rounded-md
                         shadow-lg p-1 z-50 border border-theme-200 dark:border-theme-700
                         data-[side=right]:ml-1 data-[side=left]:mr-1
                         data-[side=top]:mb-1 data-[side=bottom]:mt-1"
            >
              <CMI
                disabled={selCount !== 1}
                onSelect={() => selectedOne && window.open(absolute(selectedOne.direct_link), "_blank")}
              >
                <FiExternalLink className="mr-2" /> Open in new tab
              </CMI>
              <CMI disabled={!selCount} onSelect={copySelected}>
                <FiCopy className="mr-2" /> Copy URL{selCount > 1 && "s"}
              </CMI>
              <CMI disabled={selCount !== 1} onSelect={() => selectedOne && downloadOne(selectedOne)}>
                <FiDownload className="mr-2" /> Download
              </CMI>
              <CMI disabled={selCount < 2} onSelect={downloadZip}>
                <FiArchive className="mr-2" /> ZIP
              </CMI>
              {!readOnly && (
                <>
                  <ContextMenu.Separator className="h-px my-1 bg-theme-200 dark:bg-theme-700" />
                  <CMI
                    disabled={!selCount}
                    onSelect={() => setWantsDelete(true)}
                    className="text-red-600"
                  >
                    <FiTrash className="mr-2" /> Delete
                  </CMI>
                </>
              )}
            </ContextMenu.Content>
          </ContextMenu.Root>
        )}
      </div>

      {/* delete confirmation */}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <AlertDialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg
                     w-full max-w-sm p-6"
        >
          <AlertDialog.Title className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
            Delete {selCount} file{selCount>1 && "s"}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300 mb-4">
            This action cannot be undone.
          </AlertDialog.Description>

          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={batchDelete}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/*                         SMALL SUB-COMPONENTS                       */
/* ------------------------------------------------------------------ */
function ToolbarBtn({
  onClick,
  label,
  children,
  disabled = false,
  danger = false,
}: {
  onClick : () => void;
  label   : string;
  children: React.ReactNode;
  disabled?: boolean;
  danger ?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs px-2 py-1 rounded transition",
        disabled
          ? "bg-theme-300 dark:bg-theme-800/40 cursor-not-allowed"
          : danger
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-theme-200/60 dark:bg-theme-800/60 hover:bg-theme-200 dark:hover:bg-theme-800"
      )}
    >
      {children} {label}
    </button>
  );
}

function CMI({
  children,
  onSelect,
  disabled = false,
  className = "",
}: {
  children : React.ReactNode;
  onSelect : () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ContextMenu.Item
      disabled={disabled}
      onSelect={disabled ? undefined : onSelect}
      className={cn(
        "flex items-center px-2 py-1.5 text-sm rounded cursor-pointer outline-none",
        "text-theme-800 dark:text-theme-200 hover:bg-theme-200/50 dark:hover:bg-theme-800/50",
        disabled && "opacity-40 pointer-events-none select-none",
        className
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}
