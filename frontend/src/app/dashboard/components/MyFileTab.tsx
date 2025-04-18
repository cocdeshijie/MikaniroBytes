"use client";

import {
  filesAtom,
  filesNeedsRefreshAtom,
  fileActionMsgAtom,
  FileItem,
  selectedIdsAtom,
} from "@/atoms/fileAtoms";
import { cn } from "@/utils/cn";
import { iconFor } from "@/utils/fileIcons";
import { useLasso } from "@/hooks/useLasso";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useSession } from "next-auth/react";
import {
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiLoader,
  FiTrash,
} from "react-icons/fi";
import { atom, useAtom } from "jotai";
import {
  useEffect,
  useMemo,
  useRef,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useToast } from "@/providers/toast-provider";

/* ------------------------------------------------------------------ */
/*                    local atoms (component‑only)                    */
/* ------------------------------------------------------------------ */
const loadingAtom = atom(false);
const errorMsgAtom = atom("");

/* ------------------------------------------------------------------ */
/*                            COMPONENT                               */
/* ------------------------------------------------------------------ */
export default function MyFileTab() {
  const { data: session } = useSession();
  const { push } = useToast();

  const [files, setFiles] = useAtom(filesAtom);
  const [needsRefresh, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setActionMsg] = useAtom(fileActionMsgAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);
  const [downloadingId, setDownloadingId] = useAtom(
    useMemo(() => atom<number | null>(null), [])
  );

  /* ------------------------------ fetch list ----------------------- */
  useEffect(() => {
    if (!session?.accessToken || !needsRefresh) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/my-files`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        if (!res.ok) throw new Error("Failed to fetch files");
        setFiles(await res.json());
        setNeedsRefresh(false);
      } catch (e: any) {
        setErrorMsg(e.message || "Error loading files");
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.accessToken, needsRefresh]);

  /* -------------------------- selection helpers -------------------- */
  const toggleSelect = (id: number, additive: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(additive ? prev : []);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  /* -------------------------- lasso select ------------------------- */
  const {
    overlayRef,
    boxStyle,
    isVisible: lassoVisible,
    onMouseDown: lassoMouseDown,
    registerTile,
  } = useLasso((ids) => setSelectedIds(new Set(ids)));

  /* -------------------------- batch actions ------------------------ */
  const copySelected = async () => {
    if (selectedIds.size === 0) return;
    const map = new Map(files.map((f) => [f.file_id, f.direct_link]));
    const urls = Array.from(selectedIds)
      .map((id) => map.get(id))
      .join("\n");
    try {
      await navigator.clipboard.writeText(urls);
      push({
        title: "URLs copied",
        description: `${selectedIds.size} copied to clipboard`,
        variant: "success",
      });
    } catch {
      push({ title: "Copy failed", variant: "error" });
    }
  };

  const batchDownload = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const url =
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-download?ids=${ids.join(
        ","
      )}` + (session?.accessToken ? `&token=${session.accessToken}` : "");
    try {
      setDownloadingId(-1);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: "files.zip",
      }).click();
      URL.revokeObjectURL(href);
      push({ title: "ZIP download started", variant: "success" });
    } catch (e: any) {
      setErrorMsg(e.message || "ZIP error");
      push({ title: "ZIP failed", variant: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} files?`)) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        }
      );
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      setFiles((prev) => prev.filter((f) => !data.deleted.includes(f.file_id)));
      clearSelection();
      push({
        title: `${data.deleted.length} file(s) deleted`,
        variant: "success",
      });
    } catch (e: any) {
      setErrorMsg(e.message || "Delete error");
      push({ title: "Delete failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------- single download ---------------------- */
  const downloadOne = async (file: FileItem) => {
    const url =
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/download/${file.file_id}` +
      (session?.accessToken ? `?token=${session.accessToken}` : "");
    try {
      setDownloadingId(file.file_id);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: file.original_filename ?? `file_${file.file_id}`,
      }).click();
      URL.revokeObjectURL(href);
      push({ title: "Download started", variant: "success" });
    } catch (e: any) {
      setErrorMsg(e.message || "Download error");
      push({ title: "Download failed", variant: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

  /* ------------------------------------------------------------------ */
  /*                               TILE                                 */
  /* ------------------------------------------------------------------ */
  function Tile({ file }: { file: FileItem }) {
    const divRef = useRef<HTMLDivElement>(null);
    const selected = selectedIds.has(file.file_id);
    const Icon = useMemo(
      () => iconFor(file.original_filename || "file"),
      [file.original_filename]
    );

    /* register rect for lasso */
    useEffect(() => {
      if (!divRef.current) return;
      const measure = () =>
        registerTile(file.file_id, divRef.current!.getBoundingClientRect());
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(divRef.current);
      return () => ro.disconnect();
    }, [registerTile]);

    /** left click */
    const handleClick = (e: ReactMouseEvent) => {
      toggleSelect(file.file_id, e.ctrlKey || e.metaKey);
      e.stopPropagation();
    };

    /** right‑click – adjust selection BEFORE Radix opens menu */
    const handleCtx = () => {
      if (!selectedIds.has(file.file_id)) {
        setSelectedIds(new Set([file.file_id]));
      }
    };

    return (
      <div
        ref={divRef}
        onClick={handleClick}
        onContextMenu={handleCtx}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg cursor-pointer select-none outline-none",
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
        <p className="text-xs text-center break-all text-theme-700 dark:text-theme-300">
          {file.original_filename || `file_${file.file_id}`}
        </p>
        {selected && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-theme-500" />
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*                               RENDER                               */
  /* ------------------------------------------------------------------ */
  return (
    <div>
      {/* Heading */}
      <h2
        className={cn(
          "text-xl font-semibold mb-4",
          "text-theme-900 dark:text-theme-100",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        My Files
      </h2>

      {/* reserved bar to prevent layout shift */}
      <div className="mb-3 flex items-center gap-3 min-h-[24px]">
        {selectedIds.size > 0 && (
          <>
            <span className="text-sm">{selectedIds.size} selected</span>
            <button
              onClick={clearSelection}
              className="text-xs px-2 py-0.5 bg-theme-200 dark:bg-theme-800 rounded"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : files.length === 0 ? (
        <p>No files uploaded yet.</p>
      ) : (
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div
              onMouseDown={(e) => {
                if (e.ctrlKey || e.metaKey) return;
                lassoMouseDown(e);
              }}
              className="relative select-none outline-none"
            >
              {/* lasso rectangle */}
              {lassoVisible && (
                <div
                  ref={overlayRef}
                  style={boxStyle}
                  className="pointer-events-none fixed z-40 bg-theme-500/20 border border-theme-500"
                />
              )}

              {/* grid */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                {files.map((f) => (
                  <Tile key={f.file_id} file={f} />
                ))}
              </div>
            </div>
          </ContextMenu.Trigger>

          {/* ----------------- Context Menu Content ------------------- */}
          <ContextMenu.Content
            className={cn(
              "min-w-[180px] bg-theme-50 dark:bg-theme-900 p-1 border",
              "border-theme-200 dark:border-theme-700 rounded-md shadow-lg z-50"
            )}
          >
            {selectedIds.size <= 1 ? (
              <>
                {/* single‑file menu */}
                {(() => {
                  const id = Array.from(selectedIds)[0];
                  const file = files.find((f) => f.file_id === id);
                  if (!file) return null;
                  return (
                    <>
                      <CMI
                        onSelect={() => window.open(file.direct_link, "_blank")}
                      >
                        <FiExternalLink className="mr-2" /> Open
                      </CMI>

                      <CMI
                        onSelect={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              file.direct_link
                            );
                            push({ title: "URL copied", variant: "success" });
                          } catch {
                            push({ title: "Copy failed", variant: "error" });
                          }
                        }}
                      >
                        <FiCopy className="mr-2" /> Copy URL
                      </CMI>

                      <CMI onSelect={() => downloadOne(file)}>
                        <FiDownload className="mr-2" /> Download
                      </CMI>

                      <ContextMenu.Separator className="my-1 h-px bg-theme-200 dark:bg-theme-700" />

                      <CMI
                        onSelect={() => batchDelete()}
                        className="text-red-600 dark:text-red-400"
                      >
                        <FiTrash className="mr-2" /> Delete
                      </CMI>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                {/* batch menu */}
                <CMI onSelect={copySelected}>
                  <FiCopy className="mr-2" /> Copy&nbsp;{selectedIds.size}
                  &nbsp;URLs
                </CMI>
                <CMI onSelect={batchDownload}>
                  <FiDownload className="mr-2" /> Download ZIP
                </CMI>
                <ContextMenu.Separator className="my-1 h-px bg-theme-200 dark:bg-theme-700" />
                <CMI
                  onSelect={batchDelete}
                  className="text-red-600 dark:text-red-400"
                >
                  <FiTrash className="mr-2" /> Delete&nbsp;{selectedIds.size}
                </CMI>
              </>
            )}
          </ContextMenu.Content>
        </ContextMenu.Root>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                       small helper components                       */
/* ------------------------------------------------------------------ */
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
