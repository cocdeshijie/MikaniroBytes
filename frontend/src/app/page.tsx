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
import { FormEvent, DragEvent, useRef } from "react";
import { atom, useAtom } from "jotai";
import UploadItem from "@/components/UploadItem";

/* ------------------------------------------------------------------ */
/*                       local derived atoms                          */
/* ------------------------------------------------------------------ */

const pendingCountAtom = atom((get) =>
  get(uploadTasksAtom).filter((t) => t.status === "pending").length
);

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

  /* ---------------- Drag & Drop ------------------- */
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

  /* ---------------- select (click) ---------------- */
  const appendFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newTasks: UploadTask[] = Array.from(fileList).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      progress: 0,
      status: "pending",
    }));
    setTasks((prev) => [...prev, ...newTasks]);
  };

  /* ---------------- upload ---------------- */
  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    const toStart = tasks.filter((t) => t.status === "pending");
    toStart.forEach(startUpload);
  };

  const startUpload = (task: UploadTask) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: "uploading", progress: 0 } : t
      )
    );

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/upload`
    );

    if (session?.accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);
    }

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
        );
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        const result = {
          file_id: data.file_id,
          original_filename: data.original_filename,
          direct_link: data.direct_link,
        };
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "done", progress: 100, result }
              : t
          )
        );
        setUploadedItems((prev) => [result, ...prev]);
        setNeedsRefresh(true);
      } else {
        fail(xhr.responseText || "Upload failed");
      }
    };

    xhr.onerror = () => fail("Network error");

    const fail = (msg: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "error", error: msg } : t
        )
      );
      push({ title: "Upload error", variant: "error" });
    };

    const formData = new FormData();
    formData.append("file", task.file);
    xhr.send(formData);
  };

  /* ------------------------------------------------------------------ */
  /*                               JSX                                  */
  /* ------------------------------------------------------------------ */

  return (
    <div className="relative min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Hero section */}
      <div className="flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="mb-10 flex flex-col items-center">
          <h1
            className={cn(
              "text-3xl sm:text-4xl font-extrabold text-center",
              "text-theme-900 dark:text-theme-100",
              "flex items-center flex-wrap justify-center gap-2 mb-4"
            )}
          >
            Welcome to FileBed
            <div className="h-1 w-16 bg-theme-500 rounded-full inline-block ml-2" />
          </h1>
          <p className="max-w-2xl text-center text-theme-700 dark:text-theme-300 text-lg mb-8">
            Host and manage your files with the power of FastAPI + Next.js.
          </p>
        </div>

        {/* Upload portal */}
        <div className="w-full max-w-3xl mx-auto mb-16">
          {/* ------------ SELECT + DRAG AREA ------------- */}
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
                Drag & drop files here
              </p>
              <p className="text-theme-500 dark:text-theme-400 text-sm">
                or click to browse
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

      {/* Footer */}
      <footer
        className="text-center py-8 bg-theme-50 dark:bg-theme-950
                 text-theme-600 dark:text-theme-400 border-t border-theme-200 dark:border-theme-800"
      >
        <p>
          Made with <span className="text-red-500">&hearts;</span> by You
        </p>
      </footer>
    </div>
  );
}
