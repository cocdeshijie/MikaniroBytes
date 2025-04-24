"use client";

import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FiUpload, FiCheck, FiX, FiFile } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";
import { useAtom } from "jotai";

type Phase = "idle" | "selected" | "uploading" | "done" | "error";

/*  ─── Server may return either of these shapes ──────────────────────
 *  {
 *    "success": 99,
 *    "failed" : 0,
 *    "result_text": "…"
 *  }
 *  or
 *  {
 *    "success": 95,
 *    "failed" : [{ path:"…", reason:"…" }, … ],
 *    "total"  : 100
 *  }
 */
interface FailedItem {
  path: string;
  reason: string;
}
interface ApiOk {
  success: number;
  failed: number | FailedItem[];
  total?: number;
  result_text?: string;
}

export default function BulkUpload() {
  const { data: session } = useSession();
  const { push } = useToast();
  const [, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [txtUrl, setTxtUrl] = useState<string | null>(null);
  const [infoLine, setInfoLine] = useState<string>(""); // “95/100 succeeded | 5 failed”
  const [errorMsg, setErr] = useState("");

  /* revoke blob when component unmounts or new TXT arrives */
  useEffect(() => {
    return () => { txtUrl && URL.revokeObjectURL(txtUrl); };
  }, [txtUrl]);

  /* ---------------- handlers ---------------- */
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (txtUrl) URL.revokeObjectURL(txtUrl);
    setTxtUrl(null);
    setFile(f);
    setErr("");
    setPhase(f ? "selected" : "idle");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setPhase("uploading");
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/bulk-upload`);
    if (session?.accessToken)
      xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable)
        setProgress(Math.round((ev.loaded / ev.total) * 100));
    });

    xhr.onload = () => {
      /* always refresh the viewer, no matter how we parse the response */
      setNeedsRefresh(true);

      if (xhr.status < 200 || xhr.status >= 300) {
        const detail =
          JSON.parse(xhr.responseText || "{}").detail || "Upload failed";
        setErr(detail);
        setPhase("error");
        push({ title: "Bulk upload failed", description: detail, variant: "error" });
        return;
      }

      /* ---------- 200 OK ---------- */
      try {
        const data: ApiOk = JSON.parse(xhr.responseText ?? "{}");

        const total =
          data.total ??
          (Array.isArray(data.failed)
            ? data.failed.length + data.success
            : (data.failed as number) + data.success);

        /* build result text (use server-supplied version if given) */
        let txt = data.result_text ?? "";
        if (!txt) {
          txt = `${data.success}/${total} success\n`;
          const failedArr: FailedItem[] = Array.isArray(data.failed)
            ? data.failed
            : [];
          const failedNum =
            Array.isArray(data.failed) ? data.failed.length : (data.failed as number);
          txt += `${failedNum} failed\n\n`;
          failedArr.forEach((f) => (txt += `${f.path} — ${f.reason}\n`));
        }

        const blob = new Blob([txt], { type: "text/plain" });
        setTxtUrl(URL.createObjectURL(blob));
        setInfoLine(`${data.success}/${total} succeeded | ${
          Array.isArray(data.failed) ? data.failed.length : data.failed
        } failed`);
        setPhase("done");
        push({ title: "Bulk upload finished", variant: "success" });
      } catch {
        setErr("Invalid server response");
        setPhase("error");
      }
    };

    xhr.onerror = () => {
      setErr("Network error");
      setPhase("error");
    };

    const form = new FormData();
    form.append("archive", file);
    xhr.send(form);
  };

  /* ---------------- UI ---------------- */
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
        {/* file picker */}
        <label
          className={cn(
            "flex items-center gap-3 cursor-pointer px-4 py-3 rounded-lg",
            "border border-theme-200 dark:border-theme-700",
            "bg-theme-100/40 dark:bg-theme-800/40 hover:bg-theme-100/60 dark:hover:bg-theme-800/60"
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
              className="h-full bg-theme-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {phase === "done" && txtUrl && (
          <div
            className={cn(
              "p-3 rounded border text-sm flex items-start gap-3",
              "border-green-500/40 bg-green-100/30 dark:bg-green-900/30"
            )}
          >
            <FiCheck className="mt-0.5 text-green-600" />
            <div>
              <p>{infoLine}</p>
              <a
                href={txtUrl}
                download="result.txt"
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
              "p-3 rounded border text-sm flex items-start gap-3",
              "border-red-500/40 bg-red-100/30 dark:bg-red-900/30"
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
            "w-full py-2 px-6 rounded-lg text-white font-medium transition-all",
            phase === "selected"
              ? "bg-theme-500 hover:bg-theme-600"
              : "bg-theme-300 dark:bg-theme-700 cursor-not-allowed"
          )}
        >
          {phase === "uploading" ? "Uploading…" : "Start upload"}
        </button>
      </form>
    </div>
  );
}
