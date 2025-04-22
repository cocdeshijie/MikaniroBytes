"use client";

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { cn } from "@/utils/cn";
import { iconFor } from "@/utils/fileIcons";
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
import { useLasso } from "@/hooks/useLasso";
import { useToast } from "@/providers/toast-provider";

/* ----------------------------------------------------------------- */
export interface RemoteFile {
  file_id: number;
  original_filename: string | null;
  direct_link: string;
}

interface Props {
  fetchEndpoint: string;
  sessionToken?: string;          /** JWT – useSession().accessToken */
  readOnly?: boolean;
  title?: string;                 /** optional heading shown above the toolbar */
}

/* ---------- helpers ------------------------------------------------ */
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
function absolute(link: string): string {
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}${link}`;
}

/* =================================================================== */
export default function FileViewer({
  fetchEndpoint,
  sessionToken,
  readOnly = false,
  title,
}: Props) {
  const { push } = useToast();

  /* ---------------- state ---------------- */
  const [files, setFiles]           = useState<RemoteFile[]>([]);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErr]          = useState("");
  const [selectedIds, setSel]       = useState<Set<number>>(new Set());
  const [downloadingId, setDL]      = useState<number | null>(null);
  const [zipBusy, setZipBusy]       = useState(false);               // ← NEW
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* ---------------- fetch list ---------------- */
  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const res = await fetch(fetchEndpoint, {
          headers: sessionToken
            ? { Authorization: `Bearer ${sessionToken}` }
            : undefined,
        });
        if (!res.ok) throw new Error("Failed to fetch files");
        setFiles(await res.json());
      } catch (e: any) {
        setErr(e.message || "Load error");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchEndpoint, sessionToken]);

  /* ---------------- selection helpers ---------------- */
  const toggleSelect = useCallback(
    (id: number, additive: boolean) =>
      setSel((prev) => {
        const next = new Set(additive ? prev : []);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    []
  );
  const clearSel = () => setSel(new Set());

  /* ---------------- lasso ---------------- */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    boxStyle,
    isVisible: lassoVisible,
    onMouseDown: lassoMouseDown,
    registerTile,
  } = useLasso((ids) => setSel(new Set(ids)), containerRef);

  /* ---------------- keyboard: Del ---------------- */
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (e.key === "Delete" && selectedIds.size > 0) {
        e.preventDefault();
        setConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [selectedIds.size, readOnly]);

  /* ---------------- helpers ---------------- */
  const copySelected = async () => {
    if (selectedIds.size === 0) return;
    const map = new Map(files.map((f) => [f.file_id, f.direct_link]));
    const urls = Array.from(selectedIds)
      .map((id) => absolute(map.get(id)!))
      .join("\n");
    await navigator.clipboard.writeText(urls);
    push({ title: "URLs copied", variant: "success" });
  };

  const downloadOne = async (file: RemoteFile) => {
    setDL(file.file_id);
    try {
      const res = await fetch(absolute(file.direct_link));
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: file.original_filename ?? `file_${file.file_id}`,
      }).click();
      URL.revokeObjectURL(href);
    } catch (e: any) {
      push({ title: e.message ?? "Download error", variant: "error" });
    } finally {
      setDL(null);
    }
  };

  /* -------- NEW: batch‑download ZIP -------- */
  const downloadZip = async () => {
    if (zipBusy || selectedIds.size < 2) return;
    setZipBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-download`,
        {
          method : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
          },
          body: JSON.stringify({ ids }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "ZIP download failed");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: `files_${Date.now()}.zip`,
      }).click();
      URL.revokeObjectURL(href);
      push({ title: "ZIP downloaded", variant: "success" });
    } catch (e: any) {
      push({ title: e.message ?? "ZIP failed", variant: "error" });
    } finally {
      setZipBusy(false);
    }
  };

  /* ------------ unified batch delete -------- */
  async function batchDelete() {
    if (readOnly || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-delete`,
        {
          method : "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
          },
          body: JSON.stringify({ ids }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Delete failed");
      }
      const { deleted } = await res.json();   // -> { deleted: [...] }
      setFiles((p) => p.filter((f) => !deleted.includes(f.file_id)));
      clearSel();
      push({
        title: `${deleted.length} file${deleted.length !== 1 ? "s" : ""} deleted`,
        variant: "success",
      });
    } catch (e: any) {
      push({ title: e.message ?? "Delete failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Tile component ---------------- */
  function Tile({ file }: { file: RemoteFile }) {
    const divRef = useRef<HTMLDivElement>(null);
    const selected = selectedIds.has(file.file_id);
    const Icon = useMemo(
      () => iconFor(file.original_filename || "file"),
      [file.original_filename]
    );

    useEffect(() => {
      const el = divRef.current;
      if (!el) return;
      const measure = () =>
        registerTile(file.file_id, el.getBoundingClientRect());
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }, [registerTile]);

    const handleClick = (e: React.MouseEvent) => {
      toggleSelect(file.file_id, e.ctrlKey || e.metaKey);
      e.stopPropagation();
    };
    const handleCtx = () => {
      if (!selected) setSel(new Set([file.file_id]));
    };

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
  }

  /* ---------------- derived ---------------- */
  const selCount     = selectedIds.size;
  const firstId      = Array.from(selectedIds)[0];
  const selectedOne  =
    selCount === 1 ? files.find((f) => f.file_id === firstId) : null;

  /* ---------------- render ---------------- */
  return (
    <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
      <div>
        {title && (
          <h4 className="text-lg font-medium mb-3">{title}</h4>
        )}

        {/* toolbar */}
        <div className="mb-3 flex items-center gap-3 min-h-[34px]">
          {selCount > 0 ? (
            <>
              <span className="text-sm">{selCount} selected</span>

              <button
                onClick={copySelected}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded
                           bg-theme-200/60 dark:bg-theme-800/60
                           hover:bg-theme-200 dark:hover:bg-theme-800"
              >
                <FiCopy /> Copy
              </button>

              {selCount === 1 ? (
                <button
                  onClick={() => selectedOne && downloadOne(selectedOne)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded
                             bg-theme-200/60 dark:bg-theme-800/60
                             hover:bg-theme-200 dark:hover:bg-theme-800"
                >
                  <FiDownload /> Download
                </button>
              ) : (
                <button
                  disabled={zipBusy}
                  onClick={downloadZip}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded",
                    zipBusy
                      ? "bg-theme-300 dark:bg-theme-800/40 cursor-not-allowed"
                      : "bg-theme-200/60 dark:bg-theme-800/60 hover:bg-theme-200 dark:hover:bg-theme-800"
                  )}
                >
                  <FiArchive /> ZIP
                </button>
              )}

              {!readOnly && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded
                             bg-red-600 text-white hover:bg-red-700"
                >
                  <FiTrash /> Delete
                </button>
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

        {/* error / loading */}
        {errorMsg && (
          <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
            {errorMsg}
          </p>
        )}
        {loading && <p>Loading…</p>}

        {/* grid + context menu */}
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div
              ref={containerRef}
              onMouseDown={(e) => {
                if (e.ctrlKey || e.metaKey) return;
                lassoMouseDown(e);
              }}
              className="relative min-h-[300px]"
            >
              {lassoVisible && (
                <div
                  style={boxStyle}
                  className="pointer-events-none absolute z-50
                             bg-blue-500/20 border-2 border-blue-500"
                />
              )}

              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                {files.map((f) => (
                  <Tile key={f.file_id} file={f} />
                ))}
              </div>
            </div>
          </ContextMenu.Trigger>

          <ContextMenu.Content
            className="min-w-[180px] bg-theme-50 dark:bg-theme-900 rounded-md
                       shadow-lg p-1 z-50 border border-theme-200 dark:border-theme-700
                       data-[side=right]:ml-1 data-[side=left]:mr-1
                       data-[side=top]:mb-1 data-[side=bottom]:mt-1"
          >
            {/* open in new tab */}
            <CMI onSelect={() => selectedOne && window.open(absolute(selectedOne.direct_link), "_blank")}>
              <FiExternalLink className="mr-2" /> Open in new tab
            </CMI>

            <CMI onSelect={copySelected}>
              <FiCopy className="mr-2" /> Copy URL{selCount > 1 && "s"}
            </CMI>

            <CMI
              onSelect={() => selectedOne && downloadOne(selectedOne)}
              className={cn(selCount !== 1 && "opacity-40 pointer-events-none")}
            >
              <FiDownload className="mr-2" /> Download
            </CMI>

            {selCount > 1 && (
              <CMI
                onSelect={downloadZip}
                className={cn(zipBusy && "opacity-40 pointer-events-none")}
              >
                <FiArchive className="mr-2" /> ZIP
              </CMI>
            )}

            {!readOnly && (
              <>
                <ContextMenu.Separator className="h-px my-1 bg-theme-200 dark:bg-theme-700" />
                <CMI onSelect={() => setConfirmOpen(true)} className="text-red-600">
                  <FiTrash className="mr-2" /> Delete
                </CMI>
              </>
            )}
          </ContextMenu.Content>
        </ContextMenu.Root>
      </div>

      {/* ---------- delete confirmation ------------ */}
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
              <button
                className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700"
              >
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

/* ---- tiny helper for ContextMenu items -------------------------- */
function CMI({
  children,
  onSelect,
  className = "",
}: {
  children: React.ReactNode;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center px-2 py-1.5 text-sm rounded cursor-pointer outline-none",
        "text-theme-800 dark:text-theme-200 hover:bg-theme-200/50 dark:hover:bg-theme-800/50",
        className
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}
