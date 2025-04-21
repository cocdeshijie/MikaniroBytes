"use client";

import {
  filesAtom,
  filesNeedsRefreshAtom,
  selectedIdsAtom,
  FileItem,
} from "@/atoms/fileAtoms";
import { cn } from "@/utils/cn";
import { iconFor } from "@/utils/fileIcons";
import { useLasso } from "@/hooks/useLasso";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
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
  useCallback,
} from "react";
import { useToast } from "@/providers/toast-provider";

/* ------------------------------------------------------------------ */
/*                        LOCAL JOTAI ATOMS                           */
/* ------------------------------------------------------------------ */
const loadingAtom     = atom(false);
const errorMsgAtom    = atom("");
const downloadingAtom = atom<number | null>(null);
const confirmOpenAtom = atom(false);          // delete dialog flag

/* ------------------------------------------------------------------ */
/*                       FILENAME SHORTENER                           */
/* ------------------------------------------------------------------ */
function shortenFilename(full: string, limit = 26): string {
  if (full.length <= limit) return full;

  const dot  = full.lastIndexOf(".");
  const ext  = dot !== -1 ? full.slice(dot) : "";
  const base = dot !== -1 ? full.slice(0, dot) : full;

  const tail = Math.min(3, base.length);
  const avail = limit - ext.length - 3 - tail; // “...” is 3 chars

  if (avail <= 0) {
    return base.slice(0, 1) + "..." + ext;
  }
  return base.slice(0, avail) + "..." + base.slice(-tail) + ext;
}

/* ------------------------------------------------------------------ */
/*                              COMPONENT                             */
/* ------------------------------------------------------------------ */
export default function MyFileTab() {
  const { data: session } = useSession();
  const { push } = useToast();

  /* -------- global atoms -------- */
  const [files, setFiles]       = useAtom(filesAtom);
  const [needsRefresh, setNR]   = useAtom(filesNeedsRefreshAtom);
  const [selectedIds, setSel]   = useAtom(selectedIdsAtom);

  /* -------- local atoms -------- */
  const [loading, setLoading]   = useAtom(loadingAtom);
  const [errorMsg, setErr]      = useAtom(errorMsgAtom);
  const [downloadingId, setDL]  = useAtom(downloadingAtom);
  const [confirmOpen, setConfirmOpen] = useAtom(confirmOpenAtom);

  /* ------------------ fetch list ------------------ */
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
        setNR(false);
      } catch (e: any) {
        setErr(e.message || "Error loading files");
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.accessToken, needsRefresh]);

  /* ---------------- selection helpers ---------------- */
  const toggleSelect = useCallback(
    (id: number, additive: boolean) =>
      setSel((prev) => {
        const next = new Set(additive ? prev : []);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    [setSel]
  );
  const clearSel = () => setSel(new Set());

  /* ---------------- lasso hook ---------------- */
  const {
    overlayRef,
    boxStyle,
    isVisible: lassoVisible,
    onMouseDown: lassoMouseDown,
    registerTile,
  } = useLasso((ids) => setSel(new Set(ids)));

  /* ---------------- keyboard delete ---------------- */
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedIds.size > 0) {
        e.preventDefault();
        setConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [selectedIds.size, setConfirmOpen]);

  /* ------------------------------------------------------------------ */
  /*                        ACTION HELPERS                              */
  /* ------------------------------------------------------------------ */
  const copySelected = async () => {
    if (selectedIds.size === 0) return;
    const map = new Map(files.map((f) => [f.file_id, f.direct_link]));
    const urls = Array.from(selectedIds).map((id) => map.get(id)).join("\n");
    try {
      await navigator.clipboard.writeText(urls);
      push({ title: "URLs copied", description: `${selectedIds.size} copied`, variant: "success" });
    } catch {
      push({ title: "Copy failed", variant: "error" });
    }
  };

  const batchDownload = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const url =
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/batch-download?ids=${ids.join(",")}` +
      (session?.accessToken ? `&token=${session.accessToken}` : "");
    try {
      setDL(-1);
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
      setErr(e.message || "ZIP error");
      push({ title: "ZIP failed", variant: "error" });
    } finally {
      setDL(null);
    }
  };

  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
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
      clearSel();
      push({ title: `${data.deleted.length} file(s) deleted`, variant: "success" });
    } catch (e: any) {
      setErr(e.message || "Delete error");
      push({ title: "Delete failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const downloadOne = async (file: FileItem) => {
    const url =
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/download/${file.file_id}` +
      (session?.accessToken ? `?token=${session.accessToken}` : "");
    try {
      setDL(file.file_id);
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
      setErr(e.message || "Download error");
      push({ title: "Download failed", variant: "error" });
    } finally {
      setDL(null);
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
      const measure = () => {
        const rect = divRef.current?.getBoundingClientRect() ?? null;
        registerTile(file.file_id, rect);
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(divRef.current);
      return () => ro.disconnect();
    }, [registerTile]);

    const handleClick = (e: ReactMouseEvent) => {
      toggleSelect(file.file_id, e.ctrlKey || e.metaKey);
      e.stopPropagation();
    };
    const handleCtx = () => {
      if (!selectedIds.has(file.file_id)) {
        setSel(new Set([file.file_id]));
      }
    };

    return (
      <div
        ref={divRef}
        onClick={handleClick}
        onContextMenu={handleCtx}
        className={cn(
          "h-32 w-full", // uniform height
          "relative flex flex-col items-center justify-center gap-2 p-4",
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

        <p
          className={cn(
            "text-xs text-center leading-tight break-all",
            "line-clamp-2 max-h-8 overflow-hidden text-theme-700 dark:text-theme-300"
          )}
        >
          {shortenFilename(file.original_filename || `file_${file.file_id}`)}
        </p>

        {selected && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-theme-500" />
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*                         TOP ACTION BAR                            */
  /* ------------------------------------------------------------------ */
  const selCount = selectedIds.size;
  const firstId = Array.from(selectedIds)[0];
  const selectedOne = 
      selCount === 1 ? files.find((f) => f.file_id === firstId) : null;

  /* ------------------------------------------------------------------ */
  /*                               JSX                                  */
  /* ------------------------------------------------------------------ */
  return (
    <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
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

        {/* ---------------- TOP BAR (reserved height) ------------------ */}
        <div className="mb-3 flex items-center gap-3 min-h-[34px]">
          {selCount > 0 ? (
            <>
              <span className="text-sm">{selCount} selected</span>

              <button
                onClick={copySelected}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-theme-200/60 dark:bg-theme-800/60 hover:bg-theme-200 dark:hover:bg-theme-800"
              >
                <FiCopy /> Copy
              </button>

              <button
                onClick={selCount === 1 ? () => downloadOne(selectedOne!) : batchDownload}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-theme-200/60 dark:bg-theme-800/60 hover:bg-theme-200 dark:hover:bg-theme-800"
              >
                <FiDownload /> {selCount === 1 ? "Download" : "ZIP"}
              </button>

              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
              >
                <FiTrash /> Delete
              </button>

              <button
                onClick={clearSel}
                className="text-xs px-2 py-0.5 bg-theme-200 dark:bg-theme-800 rounded"
              >
                Clear
              </button>
            </>
          ) : (
            /* keeps bar height even when nothing selected */
            <span className="text-sm opacity-0 select-none">placeholder</span>
          )}
        </div>

        {/* ---------------- ERROR / LOADING ------------------ */}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
            {errorMsg}
          </div>
        )}
        {loading && <p>Loading…</p>}

        {/* ---------------- FILE GRID / CONTEXT‑MENU ------------------ */}
        {!loading && files.length === 0 ? (
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

            {/* ----------------- CONTEXT MENU ----------------- */}
            <ContextMenu.Content
              className={cn(
                "min-w-[180px] bg-theme-50 dark:bg-theme-900 p-1 border",
                "border-theme-200 dark:border-theme-700 rounded-md shadow-lg z-50"
              )}
            >
              {selCount <= 1 ? (
                <>
                  {selectedOne && (
                    <>
                      <CMI onSelect={() => window.open(selectedOne.direct_link, "_blank")}>
                        <FiExternalLink className="mr-2" /> Open
                      </CMI>
                      <CMI
                        onSelect={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedOne.direct_link);
                            push({ title: "URL copied", variant: "success" });
                          } catch {
                            push({ title: "Copy failed", variant: "error" });
                          }
                        }}
                      >
                        <FiCopy className="mr-2" /> Copy URL
                      </CMI>
                      <CMI onSelect={() => downloadOne(selectedOne)}>
                        <FiDownload className="mr-2" /> Download
                      </CMI>
                      <ContextMenu.Separator className="my-1 h-px bg-theme-200 dark:bg-theme-700" />
                      <CMI
                        onSelect={() => setConfirmOpen(true)}
                        className="text-red-600 dark:text-red-400"
                      >
                        <FiTrash className="mr-2" /> Delete
                      </CMI>
                    </>
                  )}
                </>
              ) : (
                <>
                  <CMI onSelect={copySelected}>
                    <FiCopy className="mr-2" /> Copy&nbsp;{selCount}&nbsp;URLs
                  </CMI>
                  <CMI onSelect={batchDownload}>
                    <FiDownload className="mr-2" /> Download ZIP
                  </CMI>
                  <ContextMenu.Separator className="my-1 h-px bg-theme-200 dark:bg-theme-700" />
                  <CMI
                    onSelect={() => setConfirmOpen(true)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <FiTrash className="mr-2" /> Delete&nbsp;{selCount}
                  </CMI>
                </>
              )}
            </ContextMenu.Content>
          </ContextMenu.Root>
        )}
      </div>

      {/* ---------------- DELETE CONFIRMATION ---------------- */}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6"
          )}
        >
          <AlertDialog.Title className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
            Delete {selCount} file{selCount > 1 ? "s" : ""}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300 mb-4">
            This action cannot be undone.
          </AlertDialog.Description>

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  batchDelete();
                }}
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
/*                       SMALL HELPER COMPONENT                       */
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
