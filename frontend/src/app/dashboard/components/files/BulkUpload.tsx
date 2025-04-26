"use client";

import { ChangeEvent, FormEvent, useMemo } from "react";
import { FiUpload, FiCheck, FiX } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { useToast } from "@/lib/toast";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";
import { atom, useAtom } from "jotai";
import { bulkUpload } from "@/lib/files";
import { useAuth } from "@/lib/auth";

/* ─────────── local jotai atoms ─────────── */
const phaseA     = () => atom<"idle" | "selected" | "uploading" | "done" | "error">("idle");
const fileA      = () => atom<File | null>(null);
const progressA  = () => atom(0);
const txtUrlA    = () => atom<string | null>(null);
const infoLineA  = () => atom("");
const errorMsgA  = () => atom("");

export default function BulkUpload() {
  const { token } = useAuth();
  const { push } = useToast();

  const [, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  const [phase, setPhase]       = useAtom(useMemo(phaseA, []));
  const [file, setFile]         = useAtom(useMemo(fileA, []));
  const [progress, setProgress] = useAtom(useMemo(progressA, []));
  const [txtUrl, setTxtUrl]     = useAtom(useMemo(txtUrlA, []));
  const [infoLine, setInfo]     = useAtom(useMemo(infoLineA, []));
  const [errorMsg, setErr]      = useAtom(useMemo(errorMsgA, []));

  const reset = () => {
    if (txtUrl) URL.revokeObjectURL(txtUrl);
    setTxtUrl(null);
    setErr("");
    setInfo("");
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    reset();
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPhase(f ? "selected" : "idle");
  };

  /* ------------------------------------------------------------------
   *                         SUBMIT / UPLOAD
   * ------------------------------------------------------------------ */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setPhase("uploading");
    setProgress(0);
    setErr("");

    try {
      // Pass your Jotai-based token => fallback to undefined if needed
      const realToken = token ?? undefined;

      const res = await bulkUpload(file, {
        token: realToken,
        onProgress: setProgress,
      });

      const total =
        res.total ??
        (Array.isArray(res.failed)
          ? res.failed.length + res.success
          : (res.failed as number) + res.success);

      const failedNum = Array.isArray(res.failed)
        ? res.failed.length
        : (res.failed as number);

      /* build result.txt blob */
      const txt =
        res.result_text ??
        [
          `${res.success}/${total} success`,
          `${failedNum} failed`,
          "",
          ...(Array.isArray(res.failed) ? res.failed.map((f) => `${f.path} — ${f.reason}`) : []),
        ].join("\n");

      const blob = new Blob([txt], { type: "text/plain" });
      setTxtUrl(URL.createObjectURL(blob));
      setInfo(`${res.success}/${total} succeeded | ${failedNum} failed`);
      setPhase("done");
      push({ title: "Bulk upload finished", variant: "success" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setErr(errorMessage);
      setPhase("error");
      push({
        title: "Bulk upload failed",
        description: errorMessage,
        variant: "error"
      });
    } finally {
      /* always refresh viewer list */
      setNeedsRefresh(true);
    }
  }

  /* ------------------------------------------------------------------
   *                                UI
   * ------------------------------------------------------------------ */
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden mt-8",
        "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
        "bg-theme-50 dark:bg-theme-950 shadow-sm hover:shadow-md",
        "transition-all duration-300 p-6 space-y-4",
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
            "bg-theme-100/40 dark:bg-theme-800/40 hover:bg-theme-100/60 dark:hover:bg-theme-800/60",
          )}
        >
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
          <ProgressBar progress={progress} />
        )}

        {phase === "done" && txtUrl && (
          <InfoBox
            icon={<FiCheck className="mt-0.5 text-green-600" />}
            color="green"
            text={
              <>
                <p>{infoLine}</p>
                <a
                  href={txtUrl}
                  download="result.txt"
                  className="underline text-green-700 dark:text-green-400"
                >
                  Download result.txt
                </a>
              </>
            }
          />
        )}

        {phase === "error" && (
          <InfoBox
            icon={<FiX className="mt-0.5 text-red-600" />}
            color="red"
            text={errorMsg}
          />
        )}

        {/* submit */}
        <button
          type="submit"
          disabled={phase !== "selected"}
          className={cn(
            "w-full py-2 px-6 rounded-lg text-white font-medium transition-all",
            phase === "selected"
              ? "bg-theme-500 hover:bg-theme-600"
              : "bg-theme-300 dark:bg-theme-700 cursor-not-allowed",
          )}
        >
          {phase === "uploading" ? "Uploading…" : "Start upload"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- small helpers ---------------- */
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-theme-200 dark:bg-theme-800 rounded h-2 overflow-hidden">
      <div
        className="h-full bg-theme-500 transition-all"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function InfoBox({
  icon,
  color,
  text,
}: {
  icon: React.ReactNode;
  color: "red" | "green";
  text: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded border text-sm flex items-start gap-3",
        color === "green"
          ? "border-green-500/40 bg-green-100/30 dark:bg-green-900/30"
          : "border-red-500/40 bg-red-100/30 dark:bg-red-900/30",
      )}
    >
      {icon}
      <div>{text}</div>
    </div>
  );
}
