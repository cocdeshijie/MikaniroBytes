"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  FiUpload,
  FiCheck,
  FiX,
  FiFile,
  FiLoader,
} from "react-icons/fi";
import { cn } from "@/utils/cn";
import { useToast } from "@/lib/toast";
import { filesNeedsRefreshAtom } from "@/atoms/fileAtoms";
import { atom, useAtom } from "jotai";

type Phase = "idle" | "selected" | "uploading" | "done" | "error";

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

/* ─────────── local jotai atoms ─────────── */
const phaseA = () => atom<Phase>("idle");
const fileA = () => atom<File | null>(null);
const progressA = () => atom(0);
const txtUrlA = () => atom<string | null>(null);
const infoLineA = () => atom("");
const errorMsgA = () => atom("");

export default function BulkUpload() {
  const { data: session } = useSession();
  const { push } = useToast();

  const [, setNeedsRefresh] = useAtom(filesNeedsRefreshAtom);

  const [phase, setPhase] = useAtom(useMemo(phaseA, []));
  const [file, setFile] = useAtom(useMemo(fileA, []));
  const [progress, setProgress] = useAtom(useMemo(progressA, []));
  const [txtUrl, setTxtUrl] = useAtom(useMemo(txtUrlA, []));
  const [infoLine, setInfoLine] = useAtom(useMemo(infoLineA, []));
  const [errorMsg, setErr] = useAtom(useMemo(errorMsgA, []));

  /* revoke blob when component unmounts or new TXT arrives */
  useEffect(
    () => () => {
      if (txtUrl) URL.revokeObjectURL(txtUrl);
    },
    [txtUrl],
  );

  /* ---------- handlers ---------- */
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
    setErr("");

    /* ◀──── XMLHttpRequest gives us upload-progress events */
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/files/bulk-upload`);

    if (session?.accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setProgress(pct);
      }
    };

    xhr.onload = () => {
      /* viewer must reload irrespective of outcome */
      setNeedsRefresh((v) => !v);

      if (xhr.status < 200 || xhr.status >= 300) {
        const { detail = "Upload failed" } = safeJSON(xhr.responseText);
        handleError(detail);
        return;
      }

      try {
        const payload: ApiOk = safeJSON(xhr.responseText);

        const total =
          payload.total ??
          (Array.isArray(payload.failed)
            ? payload.failed.length + payload.success
            : (payload.failed as number) + payload.success);

        const failedNum = Array.isArray(payload.failed)
          ? payload.failed.length
          : (payload.failed as number);

        const txt =
          payload.result_text ??
          [
            `${payload.success}/${total} success`,
            `${failedNum} failed`,
            "",
            ...(Array.isArray(payload.failed)
              ? payload.failed.map((f) => `${f.path} — ${f.reason}`)
              : []),
          ].join("\n");

        const blob = new Blob([txt], { type: "text/plain" });
        setTxtUrl(URL.createObjectURL(blob));
        setInfoLine(`${payload.success}/${total} succeeded | ${failedNum} failed`);
        setPhase("done");
        push({ title: "Bulk upload finished", variant: "success" });
      } catch {
        handleError("Invalid server response");
      }
    };

    xhr.onerror = () => handleError("Network error");

    const form = new FormData();
    form.append("archive", file);
    xhr.send(form);
  };

  const handleError = (msg: string) => {
    setErr(msg);
    setPhase("error");
    push({ title: "Bulk upload failed", description: msg, variant: "error" });
  };

  /* ---------- UI ---------- */
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
        {phase === "uploading" && <ProgressBar progress={progress} />}

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
          {phase === "uploading" ? (
            <span className="flex items-center gap-2 justify-center">
              <FiLoader className="animate-spin" /> Uploading…
            </span>
          ) : (
            "Start upload"
          )}
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

/* safe JSON helper */
function safeJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
