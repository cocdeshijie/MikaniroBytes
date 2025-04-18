"use client";

import {
  FormEvent,
  DragEvent,
  AwaitedReactNode,
  JSXElementConstructor,
  Key,
  ReactElement,
  ReactNode,
  ReactPortal,
} from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAtom } from "jotai";
import {
  selectedFileAtom,
  isDraggingAtom,
  uploadingAtom,
  uploadProgressAtom,
  uploadErrorAtom,
  uploadedItemsAtom,
  UploadedItem,
} from "@/atoms/uploadAtoms";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider"; // ★ NEW

/* ------------------------------------------------------------------ */
/*                      helper: copy‑to‑clipboard                      */
/* ------------------------------------------------------------------ */

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*                             COMPONENT                              */
/* ------------------------------------------------------------------ */

export default function Home() {
  const { data: session } = useSession();
  const { push } = useToast(); // ★ NEW

  // Upload‑portal atoms
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [isDragging, setIsDragging] = useAtom(isDraggingAtom);
  const [uploading, setUploading] = useAtom(uploadingAtom);
  const [uploadProgress, setUploadProgress] = useAtom(uploadProgressAtom);
  const [uploadError, setUploadError] = useAtom(uploadErrorAtom);
  const [uploadedItems, setUploadedItems] = useAtom(uploadedItemsAtom);

  // tell dashboard to refresh once a file is uploaded
  const [, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  /* ---------------- Drag & Drop handlers ---------------- */
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }

  /* ---------------- File input handler ---------------- */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  }

  /* ---------------- Upload ---------------- */
  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("No file selected");
      return;
    }

    // Reset
    setUploadError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/upload`);

      // If user is logged in, attach Bearer token
      if (session?.accessToken) {
        xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);
      }

      // Track progress
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) {
          const percent = Math.round((ev.loaded / ev.total) * 100);
          setUploadProgress(percent);
        }
      });

      // On load
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const errData = JSON.parse(xhr.responseText);
            setUploadError(errData.detail || "Upload failed");
            push({
              title: "Upload failed",
              description: errData.detail || undefined,
              variant: "error",
            });
          } catch {
            setUploadError("Upload failed");
            push({ title: "Upload failed", variant: "error" });
          }
          return;
        }

        // Success
        const data = JSON.parse(xhr.responseText);
        const newItem: UploadedItem = {
          file_id: data.file_id,
          original_filename: data.original_filename,
          direct_link: data.direct_link,
        };
        setUploadedItems((prev) => [newItem, ...prev]);
        setSelectedFile(null);
        setUploadProgress(100);

        // ★ Mark the dashboard file list as stale so it refetches
        setNeedsRefresh(true);

        push({
          title: "Upload complete",
          description: data.original_filename,
          variant: "success",
        });
      };

      // On error
      xhr.onerror = () => {
        setUploading(false);
        setUploadError("Network or server error.");
        push({ title: "Upload error", variant: "error" });
      };

      // Send form
      xhr.send(formData);
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.message || "Error uploading file");
      push({
        title: "Upload error",
        description: err?.message,
        variant: "error",
      });
    }
  }

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
            <div className="h-1 w-16 bg-theme-500 rounded-full inline-block ml-2"></div>
          </h1>
          <p className="max-w-2xl text-center text-theme-700 dark:text-theme-300 text-lg mb-8">
            Host and manage your files with the power of FastAPI + Next.js.
          </p>
        </div>

        {/* Upload portal area */}
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
                "border-b border-theme-100 dark:border-theme-800 px-6 py-4",
                "flex items-center justify-between"
              )}
            >
              <h2 className="text-lg font-medium text-theme-900 dark:text-theme-100">
                Upload File
              </h2>
              <div className="h-1 w-8 bg-theme-500 rounded-full"></div>
            </div>

            <div
              className={cn(
                "p-8 cursor-pointer",
                "flex flex-col items-center justify-center",
                "border-2 border-dashed border-theme-200 dark:border-theme-700",
                "rounded-lg text-center",
                "bg-theme-50/50 dark:bg-theme-800/30",
                isDragging
                  ? "bg-theme-100/70 dark:bg-theme-800/70"
                  : "hover:bg-theme-100/50 dark:hover:bg-theme-800/50",
                "transition-colors duration-200"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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
                Drag & drop a file here
              </p>
              <p className="text-theme-500 dark:text-theme-400 text-sm">
                or click to browse
              </p>

              {/* Hidden file input to handle "click to browse" */}
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {selectedFile && (
              <div className="px-6 py-4">
                <p className="text-sm text-theme-600 dark:text-theme-400">
                  Selected File:
                </p>
                <p className="text-theme-800 dark:text-theme-100 font-medium">
                  {selectedFile.name}
                </p>
              </div>
            )}

            {uploadError && (
              <div
                className={cn(
                  "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
                  "p-4 mb-2 mx-6 rounded-lg",
                  "border border-red-100 dark:border-red-800/50"
                )}
              >
                {uploadError}
              </div>
            )}

            {/* Progress bar */}
            {uploading && (
              <div className="px-6 mb-4">
                <div className="relative h-2 bg-theme-200 dark:bg-theme-700 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-2 bg-theme-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="mt-1 text-sm text-theme-600 dark:text-theme-400">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <div className="p-6">
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className={cn(
                  "py-3 px-6 rounded-lg",
                  uploading
                    ? "bg-theme-300 dark:bg-theme-700 text-white cursor-not-allowed"
                    : "bg-theme-500 hover:bg-theme-600 text-white",
                  "font-medium transition-all duration-200 flex items-center justify-center gap-2"
                )}
              >
                <span>{uploading ? "Uploading..." : "Upload"}</span>
                <div className="w-1 h-4 bg-white/50 rounded-full"></div>
              </button>
            </div>
          </form>

          {/* Once uploaded, show the list of items (stacked) */}
          {uploadedItems.length > 0 && (
            <div className="mt-6 space-y-4">
              {uploadedItems.map(
                (item: {
                  file_id: Key | null | undefined;
                  direct_link:
                    | string
                    | number
                    | bigint
                    | boolean
                    | ReactElement<
                        any,
                        string | JSXElementConstructor<any>
                      >
                    | Iterable<React.ReactNode>
                    | Promise<AwaitedReactNode>
                    | null
                    | undefined;
                  original_filename:
                    | string
                    | number
                    | bigint
                    | boolean
                    | ReactElement<
                        any,
                        string | JSXElementConstructor<any>
                      >
                    | Iterable<React.ReactNode>
                    | ReactPortal
                    | Promise<AwaitedReactNode>
                    | null
                    | undefined;
                }) => (
                  <div
                    key={item.file_id}
                    onClick={async () => {
                      const ok = await copyToClipboard(
                        item.direct_link as string
                      );
                      push({
                        title: ok ? "URL copied" : "Copy failed",
                        description: ok
                          ? undefined
                          : "Could not write to clipboard",
                        variant: ok ? "success" : "error",
                      });
                    }}
                    className={cn(
                      "p-4 bg-theme-50 dark:bg-theme-900 rounded-lg border",
                      "border-theme-200 dark:border-theme-700 hover:bg-theme-100/50 dark:hover:bg-theme-800/50",
                      "transition-colors duration-200 cursor-pointer"
                    )}
                  >
                    <p className="font-medium text-theme-700 dark:text-theme-300 mb-1">
                      {item.original_filename}
                    </p>
                    <p className="text-sm text-theme-500 dark:text-theme-400 break-all">
                      {item.direct_link}
                    </p>
                    <p className="text-xs text-theme-400 dark:text-theme-600 mt-1">
                      (Click to copy URL)
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Learn more link */}
        <Link
          href="#features"
          className={cn(
            "inline-flex items-center px-6 py-3",
            "bg-white dark:bg-theme-900 rounded-lg",
            "text-theme-800 dark:text-theme-200",
            "border border-theme-200 dark:border-theme-700",
            "hover:bg-theme-100 dark:hover:bg-theme-800",
            "transition-colors"
          )}
        >
          Learn More
          <svg
            className="ml-2 w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0
              111.414 1.414l-4 4a1 1 0 01-1.414
              0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>

      {/* Features section (anchor = #features) */}
      <div id="features" className="bg-white dark:bg-theme-900 py-16 px-6">
        {/* … feature cards unchanged … */}
      </div>

      {/* Footer */}
      <footer
        className="text-center py-8 bg-theme-50 dark:bg-theme-950
                 text-theme-600 dark:text-theme-400 border-t border-theme-200 dark:border-theme-800"
      >
        <p>
          Made with&nbsp;
          <span className="text-red-500">&hearts;</span>
          &nbsp; by You
        </p>
      </footer>
    </div>
  );
}
