"use client";

import {
  isDraggingAtom,
  uploadTasksAtom,
  uploadedItemsAtom,
  UploadTask,
} from "@/atoms/uploadAtoms";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import { useSession } from "next-auth/react";
import {
  FormEvent,
  DragEvent,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { atom, useAtom } from "jotai";
import UploadItem from "@/components/UploadItem";
import { uploadFile } from "@/lib/files";

/* ------------------------------------------------------------------ */
/*                       local derived atoms                          */
/* ------------------------------------------------------------------ */
const pendingCountAtom = atom((get) =>
  get(uploadTasksAtom).filter((t) => t.status === "pending").length
);

/* ------------------------------------------------------------------ */
/*                            HELPERS                                 */
/* ------------------------------------------------------------------ */
const parseUploadError = (raw: string | null): string =>
  raw ? raw : "Upload failed";

/* ------------------------------------------------------------------ */
/*                             COMPONENT                              */
/* ------------------------------------------------------------------ */
export default function Home() {
  const { data: session } = useSession();
  const { push } = useToast();

  const [isDragging, setIsDragging] = useAtom(isDraggingAtom);
  const [tasks, setTasks] = useAtom(uploadTasksAtom);
  const [, setUploadedItems] = useAtom(uploadedItemsAtom);
  const [, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);
  const pendingCount = useAtom(pendingCountAtom)[0];

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------------
   *  Selecting / appending new File objects
   * ------------------------------------------------------------------ */
  const appendFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const newTasks: UploadTask[] = Array.from(fileList).map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        progress: 0,
        status: "pending",
      }));
      setTasks((prev) => [...prev, ...newTasks]);
    },
    [setTasks]
  );

  /* ------------------------------------------------------------------
   *  Clipboard paste → treat like file selection
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input,textarea,[contenteditable='true']")) return;

      const files = e.clipboardData?.files;
      if (files && files.length) {
        e.preventDefault();
        appendFiles(files);
        push({
          title: `Added ${files.length} file${files.length > 1 ? "s" : ""} from clipboard`,
          variant: "info",
        });
      }
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [appendFiles, push]);

  /* ------------------------------------------------------------------
   *  Drag & Drop
   * ------------------------------------------------------------------ */
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    appendFiles(e.dataTransfer.files);
  };

  /* ------------------------------------------------------------------
   *  Upload
   * ------------------------------------------------------------------ */
  const handleUpload = (e: FormEvent) => {
    e.preventDefault();
    tasks.filter((t) => t.status === "pending").forEach(startUpload);
  };

  const startUpload = (task: UploadTask) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: "uploading", progress: 0 } : t
      )
    );

    uploadFile(task.file, {
      token: session?.accessToken,
      onProgress: (pct) =>
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, progress: pct } : t
          )
        ),
    })
      .then((result) => {
        // success
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "done", progress: 100, result }
              : t
          )
        );
        setUploadedItems((prev) => [result, ...prev]);
        setNeedsRefresh(true);
      })
      .catch((e) => {
        // failure => mark error, show toast
        const msg = parseUploadError(e?.message ?? null);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "error", error: msg } : t
          )
        );
        push({ title: "Upload failed", description: msg, variant: "error" });
      });
  };

  /* ------------------------------------------------------------------
   *  JSX
   * ------------------------------------------------------------------ */
  return (
    <div className="relative bg-theme-50 dark:bg-theme-950">
      {/* Hero + Upload section – guaranteed ≥ viewport height */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="mb-10 flex flex-col items-center">
          <h1
            className={cn(
              "text-3xl sm:text-4xl font-extrabold text-center",
              "text-theme-900 dark:text-theme-100",
              "flex items-center flex-wrap justify-center gap-2 mb-4"
            )}
          >
            Welcome!
          </h1>
          <p className="max-w-2xl text-center text-theme-700 dark:text-theme-300 text-lg mb-8">
            Host and manage your files.
          </p>
        </div>

        {/* Upload portal */}
        <div className="w-full max-w-3xl mx-auto mb-16">
          <form
            onSubmit={handleUpload}
            className={cn(
              "bg-white dark:bg-theme-900 rounded-xl overflow-hidden",
              "shadow-sm hover:shadow-md transition-all duration-300",
              "border border-dashed border-theme-300 dark:border-theme-700"
            )}
          >
            <div
              className={cn(
                "p-8 cursor-pointer flex flex-col items-center justify-center",
                "border-2 border-dashed border-theme-200 dark:border-theme-700 rounded-lg text-center",
                "bg-theme-50/50 dark:bg-theme-800/30",
                isDragging
                  ? "bg-theme-100/70 dark:bg-theme-800/70"
                  : "hover:bg-theme-100/50 dark:hover:bg-theme-800/50",
                "transition-colors duration-200"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <svg
                className="w-16 h-16 text-theme-400 dark:text-theme-600 mb-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-theme-700 dark:text-theme-300 text-lg font-medium mb-1">
                Drag & drop files here, paste, or click to browse
              </p>
              <p className="text-theme-500 dark:text-theme-400 text-sm">
                Supports ⌘ V / Ctrl V from clipboard
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => appendFiles(e.target.files)}
              />
            </div>

            {/* ------------ ACTION BUTTON ------------- */}
            <div className="p-6">
              <button
                type="submit"
                disabled={pendingCount === 0}
                className={cn(
                  "py-3 px-6 rounded-lg w-full",
                  pendingCount === 0
                    ? "bg-theme-300 dark:bg-theme-700 cursor-not-allowed"
                    : "bg-theme-500 hover:bg-theme-600",
                  "text-white font-medium transition-all duration-200"
                )}
              >
                {pendingCount === 0
                  ? "Select files first"
                  : `Upload ${pendingCount} file${pendingCount > 1 ? "s" : ""}`}
              </button>
            </div>
          </form>

          {/* ------------ TASK LIST ------------- */}
          {tasks.length > 0 && (
            <div className="mt-6 space-y-4">
              {tasks.map((t) => (
                <UploadItem key={t.id} taskId={t.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
