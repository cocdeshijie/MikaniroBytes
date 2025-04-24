"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { FiUpload, FiCheck, FiX, FiFile } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";

type Phase = "idle" | "selected" | "uploading" | "done" | "error";

interface ResultInfo {
  success: number;
  failed: number;
  result_txt: string;
}

export default function BulkUpload() {
  const { data: session } = useSession();
  const { push } = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  /* ------------------------------------------------------------------ */
  /*                             handlers                               */
  /* ------------------------------------------------------------------ */
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setErrorMsg("");
    setPhase(f ? "selected" : "idle");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setPhase("uploading");
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/bulk-upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${session?.accessToken || ""}`);

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        setProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setResult(data as ResultInfo);
          setPhase("done");
          push({ title: "Bulk upload finished", variant: "success" });
        } catch {
          setErrorMsg("Invalid server response");
          setPhase("error");
        }
      } else {
        const detail =
          JSON.parse(xhr.responseText || "{}").detail || "Upload failed";
        setErrorMsg(detail);
        setPhase("error");
        push({ title: "Bulk upload failed", description: detail, variant: "error" });
      }
    };

    xhr.onerror = () => {
      setErrorMsg("Network error");
      setPhase("error");
    };

    const form = new FormData();
    form.append("archive", file);
    xhr.send(form);
  };

  /* ------------------------------------------------------------------ */
  /*                                UI                                  */
  /* ------------------------------------------------------------------ */
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden mt-8",
        "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
        "bg-theme-50 dark:bg-theme-950 shadow-sm hover:shadow-md",
        "transition-all duration-300 p-6 space-y-4"
      )}
    >
      <h4 className="text-lg font-medium flex items-center gap-2 mb-2">
        <FiUpload /> Bulk Upload (.zip / .tar.gz)
      </h4>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* file selector */}
        <label
          className={cn(
            "flex items-center gap-3 cursor-pointer",
            "px-4 py-3 rounded-lg",
            "border border-theme-200 dark:border-theme-700",
            "bg-theme-100/40 dark:bg-theme-800/40 hover:bg-theme-100/60 dark:hover:bg-theme-800/60",
            "transition-colors"
          )}
        >
          <FiFile className="w-5 h-5 text-theme-600 dark:text-theme-400 shrink-0" />
          <span className="flex-1 truncate">
            {file ? file.name : "Choose archive…"}
          </span>
          <input
            type="file"
            accept=".zip,.tar,.tar.gz,.tgz,application/zip,application/gzip"
            className="hidden"
            onChange={onFileChange}
          />
        </label>

        {/* progress / result / error */}
        {phase === "uploading" && (
          <div className="w-full bg-theme-200 dark:bg-theme-800 rounded h-2 overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-theme-500 transition-all"
            />
          </div>
        )}

        {phase === "done" && result && (
          <div
            className={cn(
              "p-3 rounded border",
              "border-green-500/40 bg-green-100/30 dark:bg-green-900/30",
              "flex items-start gap-3 text-sm"
            )}
          >
            <FiCheck className="mt-0.5 text-green-600" />
            <div>
              <p>
                {result.success}/{result.success + result.failed} succeeded &nbsp;|&nbsp;
                {result.failed} failed
              </p>
              <a
                href={result.result_txt}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-green-700 dark:text-green-400"
              >
                Download result.txt
              </a>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div
            className={cn(
              "p-3 rounded border",
              "border-red-500/40 bg-red-100/30 dark:bg-red-900/30",
              "flex items-start gap-3 text-sm"
            )}
          >
            <FiX className="mt-0.5 text-red-600" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* submit */}
        <button
          type="submit"
          disabled={phase !== "selected"}
          className={cn(
            "w-full py-2 px-6 rounded-lg",
            phase === "selected"
              ? "bg-theme-500 hover:bg-theme-600"
              : "bg-theme-300 dark:bg-theme-700 cursor-not-allowed",
            "text-white font-medium transition-all"
          )}
        >
          {phase === "uploading" ? "Uploading…" : "Start upload"}
        </button>
      </form>
    </div>
  );
}
