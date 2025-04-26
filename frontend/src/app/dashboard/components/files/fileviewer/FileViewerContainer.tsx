"use client";

/* ─────────────────────────────────────────────────────────── */
/*                               IMPORTS                      */
/* ─────────────────────────────────────────────────────────── */
import {
  useEffect,
  useLayoutEffect,
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
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useAtom } from "jotai";

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
  pageA,
  totalA,
  colsA,
} from "./atoms";
import type { RemoteFile, PaginatedFiles } from "./types";

/* ---------------------------------------------------------- */
/*                   Helper – absolutise URL                  */
/* ---------------------------------------------------------- */
const absolute = (link: string) =>
  /^(https?:)?\/\//.test(link)
    ? link
    : `${NEXT_PUBLIC_BACKEND_URL}${link.startsWith("/") ? "" : "/"}${link}`;

/* ---------------------------------------------------------- */
/*            Calculate number of columns for 120-px tiles    */
/* ---------------------------------------------------------- */
function calcColumns(containerWidth = 0) {
  const TILE = 120;                     // tile min-width + padding
  const GAP  = 16;                      // Tailwind “gap-4”
  const usable = containerWidth || window.innerWidth;
  return Math.max(1, Math.floor((usable + GAP) / (TILE + GAP)));
}

/* ========================================================== */
/*                      MAIN COMPONENT                        */
/* ========================================================== */
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

  /* ---------------- state via scoped atoms ---------------- */
  const [files,        setFiles]   = useAtom(useMemo(filesA, []));
  const [loading,      setLoading] = useAtom(useMemo(loadingA, []));
  const [errorMsg,     setErr]     = useAtom(useMemo(errorA, []));
  const [selectedIds,  setSel]     = useAtom(useMemo(selectedIdsA, []));
  const [downloadingId,setDL]      = useAtom(useMemo(downloadingA, []));
  const [zipBusy,      setZipBusy] = useAtom(useMemo(zipBusyA, []));
  const [wantsDelete,  setWantsDelete] =
    useAtom(useMemo(wantsDeleteA, []));
  const [needsRefresh, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  /* pagination */
  const [page,       setPage]  = useAtom(useMemo(pageA, []));
  const [totalItems, setTotal] = useAtom(useMemo(totalA, []));
  const [columns,    setCols]  = useAtom(useMemo(colsA, []));

  /* ---------------------------------------------------------- */
  /*        Measure container → derive #columns + page size     */
  /* ---------------------------------------------------------- */
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const measure = () =>
      setCols(calcColumns(containerRef.current?.clientWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [setCols]);

  const pageSize   = columns ? columns * 5 : 0;            // 5 rows
  const totalPages = pageSize ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  /* ---------------------------------------------------------- */
  /*                         FETCH LIST                         */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!pageSize) return;                // wait for first measurement

    setLoading(true);
    setErr("");

    (async () => {
      try {
        const data = await api<PaginatedFiles>(
          `${fetchEndpoint}?page=${page}&page_size=${pageSize}`,
          { token: sessionToken },
        );

        setFiles(data.items);
        setTotal(data.total);

        // if page became empty (e.g. after deletions) step back
        if (!data.items.length && page > 1) {
          setPage((p) => p - 1);
        } else {
          setLoading(false);
          if (needsRefresh) setNeedsRefresh(false);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Load error");
        setLoading(false);
      }
    })();
  }, [
    page,
    pageSize,
    fetchEndpoint,
    sessionToken,
    needsRefresh,
    setNeedsRefresh,
    setFiles,
    setTotal,
    setPage,
  ]);

  /* ---------------------------------------------------------- */
  /*                       SELECTION                            */
  /* ---------------------------------------------------------- */
  const toggleSelect = useCallback(
    (id: number, additive: boolean) =>
      setSel((prev) => {
        const next = new Set<number>(additive ? prev : []);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    [setSel],
  );
  const clearSel     = () => setSel(new Set<number>());
  const setExclusive = (id: number) => setSel(new Set<number>([id]));

  /* ---------------------------------------------------------- */
  /*                       LASSO SELECT                         */
  /* ---------------------------------------------------------- */
  const {
    boxStyle,
    isVisible: lassoVisible,
    onMouseDown: lassoDown,
    registerTile,
  } = useLasso(
    (ids) => setSel(new Set<number>(ids)),
    containerRef,
  );

  /* ---------------------------------------------------------- */
  /*                       ACTIONS                              */
  /* ---------------------------------------------------------- */
  const selCount    = selectedIds.size;
  const selectedOne = selCount === 1
    ? files.find((f) => f.file_id === Array.from(selectedIds)[0])
    : null;

  const copySelected = async () => {
    if (!selCount) return;
    const urlMap = new Map(files.map((f) => [f.file_id, f.direct_link]));
    await navigator.clipboard.writeText(
      Array.from(selectedIds).map((id) => absolute(urlMap.get(id)!)).join("\n"),
    );
    push({ title: "URLs copied", variant: "success" });
  };

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
    } catch {
      push({ title: "Download error", variant: "error" });
    } finally {
      setDL(null);
    }
  };

  const downloadZip = async () => {
    if (zipBusy || selCount < 2) return;
    setZipBusy(true);
    try {
      const blob = await api<Blob>("/files/batch-download", {
        method: "POST",
        token : sessionToken,
        json  : { ids: Array.from(selectedIds) },
      });
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href,
        download: `files_${Date.now()}.zip`,
      }).click();
      URL.revokeObjectURL(href);
      push({ title: "ZIP ready", variant: "success" });
    } catch {
      push({ title: "ZIP failed", variant: "error" });
    } finally {
      setZipBusy(false);
    }
  };

  /* ---------- delete & refill page ---------- */
  async function batchDelete() {
    if (readOnly || !selCount) return;

    setLoading(true);
    try {
      await api("/files/batch-delete", {
        method: "DELETE",
        token : sessionToken,
        json  : { ids: Array.from(selectedIds) },
      });

      // optimistic local update
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.file_id)));
      setTotal((t) => t - selCount);
      clearSel();

      /* mark viewer for refresh so the page is re-filled */
      setNeedsRefresh(true);
      push({ title: "Deleted", variant: "success" });
    } catch {
      push({ title: "Delete failed", variant: "error" });
      setLoading(false);
    } finally {
      setWantsDelete(false);
    }
  }

  /* ---------------------------------------------------------- */
  /*                    PAGINATION COMPONENT                    */
  /* ---------------------------------------------------------- */
  function Pagination() {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className={cn(
            "px-3 py-1.5 rounded flex items-center gap-1 text-sm",
            page <= 1
              ? "bg-theme-300 cursor-not-allowed"
              : "bg-theme-200 dark:bg-theme-800 hover:bg-theme-200/70 dark:hover:bg-theme-800/70",
          )}
        >
          <FiChevronLeft /> Prev
        </button>
        <span className="text-sm">
          Page {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className={cn(
            "px-3 py-1.5 rounded flex items-center gap-1 text-sm",
            page >= totalPages
              ? "bg-theme-300 cursor-not-allowed"
              : "bg-theme-200 dark:bg-theme-800 hover:bg-theme-200/70 dark:hover:bg-theme-800/70",
          )}
        >
          Next <FiChevronRight />
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------- */
  /*                         SKELETON                           */
  /* ---------------------------------------------------------- */
  const SkeletonGrid = () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
      {Array.from({ length: 8 }).map((_ , i) => (
        <div
          key={i}
          className="h-32 rounded-lg bg-theme-200 dark:bg-theme-800 animate-pulse"
        />
      ))}
    </div>
  );

  const deleteDialogOpen = wantsDelete && selCount > 0;

  /* ---------------------------------------------------------- */
  /*                            UI                              */
  /* ---------------------------------------------------------- */
  return (
    <AlertDialog.Root
      open={deleteDialogOpen}
      onOpenChange={setWantsDelete}
    >
      <div className="relative">
        {loading && files.length > 0 && (
          <FiLoader className="absolute top-0 right-0 w-4 h-4 animate-spin text-theme-600" />
        )}

        {title && <h4 className="text-lg font-medium mb-3">{title}</h4>}

        {/* toolbar */}
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
                <ToolbarBtn
                  onClick={downloadZip}
                  disabled={zipBusy}
                  label="ZIP"
                >
                  <FiArchive />
                </ToolbarBtn>
              )}

              {!readOnly && (
                <ToolbarBtn
                  onClick={() => setWantsDelete(true)}
                  label="Delete"
                  danger
                >
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

        {/* content */}
        {loading && files.length === 0 ? (
          <SkeletonGrid />
        ) : (
          <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
              <div
                ref={containerRef}
                onClick={(e) => {
                  if (
                    e.target === containerRef.current &&
                    !(e.ctrlKey || e.metaKey)
                  )
                    clearSel();
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

            {/* context menu */}
            <ContextMenu.Portal>
              <ContextMenu.Content
                className="min-w-[180px] bg-theme-50 dark:bg-theme-900 rounded-md
                           shadow-lg p-1 z-50 border border-theme-200 dark:border-theme-700"
              >
                <CMI
                  disabled={selCount !== 1}
                  onSelect={() =>
                    selectedOne &&
                    window.open(absolute(selectedOne.direct_link), "_blank")
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
            </ContextMenu.Portal>
          </ContextMenu.Root>
        )}

        {/* pagination */}
        <Pagination />
      </div>

      {/* delete confirm dialog */}
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
  onClick,
  label,
  children,
  disabled = false,
  danger = false,
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
  children,
  onSelect,
  disabled = false,
  className = "",
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
