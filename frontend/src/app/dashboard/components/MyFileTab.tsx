"use client";

import { atom, useAtom } from "jotai";
import { useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/utils/cn";

interface FileItem {
  file_id: number;
  original_filename: string | null;
  direct_link: string;
}

/* ---------- Jotai atoms ---------- */
const filesAtom = atom<FileItem[]>([]);
const hasFetchedAtom = atom(false);
const loadingAtom = atom(false);
const errorMsgAtom = atom("");

export default function MyFileTab() {
  const { data: session } = useSession();

  const [files, setFiles] = useAtom(filesAtom);
  const [hasFetched, setHasFetched] = useAtom(hasFetchedAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);

  /* ---------- Clipboard helper ---------- */
  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Copied file URL to clipboard!");
    } catch {
      alert("Failed to copy.");
    }
  }, []);

  /* ---------- Initial fetch ---------- */
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!hasFetched) {
      fetchFiles();
      setHasFetched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, hasFetched]);

  async function fetchFiles() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/my-files`,
        {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch files");
      }
      const data: FileItem[] = await res.json();
      setFiles(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading files");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Render ---------- */
  return (
    <div>
      <h2
        className={cn(
          "text-xl font-semibold mb-4",
          "text-theme-900 dark:text-theme-100",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        My Files
      </h2>
      <p className="text-theme-600 dark:text-theme-400 mb-6">
        Click an item to copy its direct URL.
      </p>

      {errorMsg && (
        <div
          className={cn(
            "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
            "p-3 rounded mb-4 border border-red-200/50 dark:border-red-800/50"
          )}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="text-theme-600 dark:text-theme-400">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-theme-600 dark:text-theme-400">
          No files uploaded yet.
        </p>
      ) : (
        <div className="space-y-4">
          {files.map((file) => (
            <div
              key={file.file_id}
              onClick={() => copyUrl(file.direct_link)}
              className={cn(
                "border border-theme-200/50 dark:border-theme-800/50 rounded-lg",
                "p-4 bg-theme-100/25 dark:bg-theme-900/25",
                "transition-all duration-200 hover:shadow-md cursor-pointer"
              )}
            >
              <p className="font-medium text-theme-700 dark:text-theme-300 mb-1">
                {file.original_filename || `File #${file.file_id}`}
              </p>
              <p className="text-sm text-theme-500 dark:text-theme-400 break-all">
                {file.direct_link}
              </p>
              <p className="text-xs text-theme-400 dark:text-theme-600 mt-1">
                (click to copy)
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
