"use client";

/* ------------------------------------------------------------------ */
/*                               IMPORTS                              */
/* ------------------------------------------------------------------ */
import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiTrash,
  FiArchive,
} from "react-icons/fi";
import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";
import { useLasso } from "@/hooks/useLasso";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";
import { NEXT_PUBLIC_BACKEND_URL } from "@/lib/env";
import { FileTile } from "./FileTile";
import {
  filesA,
  loadingA,
  errorA,
  selectedIdsA,
  downloadingA,
  zipBusyA,
  wantsDeleteA,
} from "./atoms";
import type { RemoteFile } from "./types";

/* ------------------------------------------------------------------ */
/*                               UTILS                                */
/* ------------------------------------------------------------------ */
const absolute = (link: string) =>
  /^(https?:)?\/\//.test(link)
    ? link
    : `${NEXT_PUBLIC_BACKEND_URL}${link.startsWith("/") ? "" : "/"}${link}`;

/* ================================================================== */
/*                           CONTAINER                                */
/* ================================================================== */
export default function FileViewerContainer({
  fetchEndpoint,
  sessionToken,
  readOnly = false,
  title,
}: {
  fetchEndpoint: string;
  sessionToken?: string;
  readOnly?: boolean;
  title?: string;
}) {
  const { push } = useToast();

  /* ---------- scoped atoms ---------- */
  const [files,        setFiles]   = useAtom(useMemo(filesA, []));
  const [loading,      setLoading] = useAtom(useMemo(loadingA, []));
  const [errorMsg,     setErr]     = useAtom(useMemo(errorA, []));
  const [selectedIds,  setSel]     = useAtom(useMemo(selectedIdsA, []));
  const [downloadingId,setDL]      = useAtom(useMemo(downloadingA, []));
  const [zipBusy,      setZipBusy] = useAtom(useMemo(zipBusyA, []));
  const [wantsDelete,  setWantsDelete] =
    useAtom(useMemo(wantsDeleteA, []));
  const [needsRefresh, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  /* ------------------------------------------------------------------ */
  /*                             FETCH LIST                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await api<RemoteFile[]>(fetchEndpoint, { token: sessionToken });
        setFiles(data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Load error");
      } finally {
        setLoading(false);
        if (needsRefresh) setNeedsRefresh(false);
      }
    })();
  }, [fetchEndpoint, sessionToken, needsRefresh, setNeedsRefresh, setFiles]);

  /* ------------------------------------------------------------------ */
  /*                         SELECTION HELPERS                          */
  /* ------------------------------------------------------------------ */
  const toggleSelect = useCallback(
    (id: number, additive: boolean) => {
      setSel((prev: Set<number>) => {
        const next = new Set<number>(additive ? prev : []);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    [setSel],
  );
  const clearSel          = () => setSel(new Set<number>());
  const setExclusive      = (id: number) => setSel(new Set<number>([id]));

  /* ------------------------------------------------------------------ */
  /*                          MARQUEE LASSO                             */
  /* ------------------------------------------------------------------ */
  const containerRef = useRef<HTMLDivElement>(null);
  const { boxStyle, isVisible: lassoVisible, onMouseDown: lassoDown, registerTile } =
    useLasso((ids) => setSel(new Set<number>(ids)), containerRef);

  /* ------------------------------------------------------------------ */
  /*                          ACTIONS                                   */
  /* ------------------------------------------------------------------ */
  const selCount    = selectedIds.size;
  const selectedOne = selCount === 1
    ? files.find((f) => f.file_id === Array.from(selectedIds)[0])
    : null;

  /* ---- copy URLs ---- */
  const copySelected = async () => {
    if (!selCount) return;
    const urlMap = new Map(files.map((f) => [f.file_id, f.direct_link]));
    const urls   = Array.from(selectedIds).map((id) => absolute(urlMap.get(id)!)).join("\n");
    await navigator.clipboard.writeText(urls);
    push({ title: "URLs copied", variant: "success" });
  };

  /* ---- download single ---- */
  const downloadOne = async (file: RemoteFile) => {
    setDL(file.file_id);
    try {
      const blob = await api<Blob>(absolute(file.direct_link));
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: file.original_filename ?? `file_${file.file_id}`,
      }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      push({ title: e instanceof Error ? e.message : "Download error", variant: "error" });
    } finally {
      setDL(null);
    }
  };

  /* ---- download ZIP ---- */
  const downloadZip = async () => {
    if (zipBusy || selCount < 2) return;
    setZipBusy(true);
    try {
      const ids  = Array.from(selectedIds);
      const blob = await api<Blob>("/files/batch-download", {
        method: "POST",
        token : sessionToken,
        json  : { ids },
      });
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: `files_${Date.now()}.zip`,
      }).click();
      URL.revokeObjectURL(href);
      push({ title: "ZIP downloaded", variant: "success" });
    } catch (e) {
      push({ title: e instanceof Error ? e.message : "ZIP failed", variant: "error" });
    } finally {
      setZipBusy(false);
    }
  };

  /* ---- delete ---- */
  const batchDelete = async () => {
    if (readOnly || !selCount) return;
    const ids = Array.from(selectedIds);
    setLoading(true);
    try {
      await api("/files/batch-delete", {
        method: "DELETE",
        token : sessionToken,
        json  : { ids },
      });
      setFiles((prev) => prev.filter((f) => !ids.includes(f.file_id)));
      clearSel();
      push({ title: `${ids.length} file${ids.length !== 1 ? "s" : ""} deleted`, variant: "success" });
    } catch (e) {
      push({ title: e instanceof Error ? e.message : "Delete failed", variant: "error" });
    } finally {
      setLoading(false);
      setWantsDelete(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                          SKELETON GRID                             */
  /* ------------------------------------------------------------------ */
  const SkeletonGrid = () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
      {Array.from({ length: 8 }).map((_ , i) => (
        <div key={i} className="h-32 rounded-lg bg-theme-200 dark:bg-theme-800 animate-pulse" />
      ))}
    </div>
  );

  const deleteDialogOpen = wantsDelete && selCount > 0;

  /* ------------------------------------------------------------------ */
  /*                                UI                                  */
  /* ------------------------------------------------------------------ */
  return (
    <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setWantsDelete}>
      <div className="relative">
        {loading && files.length > 0 && (
          <FiLoader className="absolute top-0 right-0 w-4 h-4 animate-spin text-theme-600" />
        )}

        {title && <h4 className="text-lg font-medium mb-3">{title}</h4>}

        {/* ----------------------------- TOOLBAR ----------------------------- */}
        <div className="mb-3 flex items-center gap-3 min-h-[34px]">
          {selCount ? (
            <>
              <span className="text-sm">{selCount} selected</span>

              <ToolbarBtn onClick={copySelected} label="Copy">
                <FiCopy />
              </ToolbarBtn>

              {selCount === 1 ? (
                <ToolbarBtn
                  onClick={() => selectedOne && downloadOne(selectedOne)}
                  label="Download"
                >
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

        {/* ----------------------------- ERRORS ------------------------------ */}
        {errorMsg && (
          <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
            {errorMsg}
          </p>
        )}

        {/* ----------------------------- CONTENT ----------------------------- */}
        {loading && files.length === 0 ? (
          <SkeletonGrid />
        ) : (
          <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
              <div
                ref={containerRef}
                onClick={(e) => {
                  if (e.target === containerRef.current && !(e.ctrlKey || e.metaKey)) clearSel();
                }}
                onMouseDown={(e) => {
                  if (!(e.ctrlKey || e.metaKey)) lassoDown(e);
                }}
                className="relative min-h-[300px]"
              >
                {lassoVisible && (
                  <div
                    style={boxStyle}
                    className="pointer-events-none absolute z-50 bg-blue-500/20 border-2 border-blue-500"
                  />
                )}

                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                  {files.map((f) => (
                    <FileTile
                      key={f.file_id}
                      file={f}
                      selected={selectedIds.has(f.file_id)}
                      downloading={downloadingId === f.file_id}
                      toggleSelect={toggleSelect}
                      setExclusiveSelect={setExclusive}
                      registerTile={registerTile}
                    />
                  ))}
                </div>
              </div>
            </ContextMenu.Trigger>

            {/* ----------------------- CONTEXT MENU ----------------------- */}
            <ContextMenu.Content
              className="min-w-[180px] bg-theme-50 dark:bg-theme-900 rounded-md
                         shadow-lg p-1 z-50 border border-theme-200 dark:border-theme-700
                         data-[side=right]:ml-1 data-[side=left]:mr-1
                         data-[side=top]:mb-1 data-[side=bottom]:mt-1"
            >
              <CMI
                disabled={selCount !== 1}
                onSelect={() =>
                  selectedOne && window.open(absolute(selectedOne.direct_link), "_blank")
                }
              >
                <FiExternalLink className="mr-2" /> Open in new tab
              </CMI>
              <CMI disabled={!selCount} onSelect={copySelected}>
                <FiCopy className="mr-2" /> Copy URL{selCount > 1 && "s"}
              </CMI>
              <CMI
                disabled={selCount !== 1}
                onSelect={() => selectedOne && downloadOne(selectedOne)}
              >
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

      {/* ----------------------- DELETE CONFIRM ----------------------- */}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <AlertDialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg
                     w-full max-w-sm p-6"
        >
          <AlertDialog.Title className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
            Delete {selCount} file{selCount > 1 && "s"}?
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
/*                 SMALL HELPERS – TOOLBAR & CM ITEM                  */
/* ------------------------------------------------------------------ */
function ToolbarBtn({
  onClick, label, children, disabled = false, danger = false,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
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
          : "bg-theme-200/60 dark:bg-theme-800/60 hover:bg-theme-200 dark:hover:bg-theme-800",
      )}
    >
      {children} {label}
    </button>
  );
}

function CMI({
  children, onSelect, disabled = false, className = "",
}: {
  children: React.ReactNode;
  onSelect: () => void;
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
        className,
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}
