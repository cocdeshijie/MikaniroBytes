"use client";

import * as Progress from "@radix-ui/react-progress";
import {
  FiCopy,
  FiLoader,
  FiLink,
  FiCode,
  FiX,
  FiCheck,
} from "react-icons/fi";
import {
  UploadTask,
  uploadedItemsAtom,
  uploadTasksAtom,
} from "@/atoms/uploadAtoms";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import { iconFor } from "@/utils/fileIcons";
import { formatBytes } from "@/utils/formatBytes";

/* ------------------------------------------------------------------ */
/*                          MAIN COMPONENT                            */
/* ------------------------------------------------------------------ */

export default function UploadItem({ taskId }: { taskId: string }) {
  /* isolate single‑task state */
  const taskAtom = useMemo(
    () => atom((get) => get(uploadTasksAtom).find((t) => t.id === taskId)!),
    [taskId],
  );
  const task = useAtom(taskAtom)[0];
  const { push } = useToast();
  const [, setUploadedItems] = useAtom(uploadedItemsAtom);

  const FileIcon = iconFor(task.file.name);
  const niceSize = formatBytes(task.file.size);

  /* ------------------------------------------------------------------ */
  /*                               RENDER                               */
  /* ------------------------------------------------------------------ */

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        "border-theme-200 dark:border-theme-800",
        "bg-theme-50/30 dark:bg-theme-900/30",
      )}
    >
      {/* ------------ COMMON HEADER (shows for all states) ------------- */}
      <div className="flex items-start gap-3">
        {/* file‑type icon */}
        <FileIcon className="w-6 h-6 text-theme-700 dark:text-theme-300 shrink-0" />

        {/* name + size */}
        <div className="flex-1">
          <p
            className={cn(
              "truncate font-medium text-sm",
              "text-theme-800 dark:text-theme-200",
            )}
            title={task.file.name}
          >
            {task.file.name}
          </p>
          <p className="text-xs text-theme-600 dark:text-theme-400">
            {niceSize}
          </p>
        </div>

        {/* right status icon */}
        {task.status === "uploading" && (
          <FiLoader className="w-4 h-4 animate-spin text-theme-500 mt-0.5" />
        )}
        {task.status === "error" && (
          <FiX
            className="w-4 h-4 text-red-500 mt-0.5"
            title={task.error}
          />
        )}
        {task.status === "done" && (
          <FiCheck className="w-4 h-4 text-green-600 mt-0.5" />
        )}
      </div>

      {/* ------------ BODY BY STATE ------------- */}
      {task.status === "uploading" && (
        <Progress.Root
          value={task.progress}
          className="h-2 w-full rounded bg-theme-200 dark:bg-theme-800 overflow-hidden"
        >
          <Progress.Indicator
            style={{ width: `${task.progress}%` }}
            className="h-full bg-theme-500 transition-all"
          />
        </Progress.Root>
      )}

      {task.status === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {task.error}
        </p>
      )}

      {task.status === "done" && task.result && (
        <div className="space-y-1">
          {/* direct link */}
          <LinkLine
            icon={<FiLink className="w-4 h-4" />}
            label={task.result.direct_link}
            copy={task.result.direct_link}
            onSuccess={() => push({ title: "URL copied", variant: "success" })}
          />
          {/* markdown */}
          <LinkLine
            icon={<FiCode className="w-4 h-4" />}
            label={`[${task.result.original_filename}](${task.result.direct_link})`}
            copy={`[${task.result.original_filename}](${task.result.direct_link})`}
            onSuccess={() =>
              push({ title: "Markdown copied", variant: "success" })
            }
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                       SMALL REUSABLE LINE                          */
/* ------------------------------------------------------------------ */
function LinkLine({
  icon,
  label,
  copy,
  onSuccess,
}: {
  icon: React.ReactNode;
  label: string;
  copy: string;
  onSuccess: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs rounded px-2 py-1",
        "bg-theme-100/40 dark:bg-theme-800/40",
      )}
    >
      {icon}
      <p className="truncate flex-1">{label}</p>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(copy);
            onSuccess();
          } catch {
            /* ignore */
          }
        }}
        className="p-1 rounded hover:bg-theme-200/60 dark:hover:bg-theme-700/60 transition"
      >
        <FiCopy className="w-4 h-4" />
      </button>
    </div>
  );
}
