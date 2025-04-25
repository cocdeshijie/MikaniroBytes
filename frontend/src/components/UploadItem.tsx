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
  uploadTasksAtom,
} from "@/atoms/uploadAtoms";
import { cn } from "@/utils/cn";
import { useToast } from "@/lib/toast";
import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import { iconFor } from "@/utils/fileIcons";
import { formatBytes } from "@/utils/formatBytes";

export default function UploadItem({ taskId }: { taskId: string }) {
  // find the relevant task in the global jotai store
  const taskAtom = useMemo(
    () => atom((get) => get(uploadTasksAtom).find((t) => t.id === taskId)!),
    [taskId],
  );
  const task = useAtom(taskAtom)[0];
  const { push } = useToast();

  if (!task) return null;

  const FileIcon = iconFor(task.file.name);
  const sizeLabel = formatBytes(task.file.size);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        "border-theme-200 dark:border-theme-800",
        "bg-theme-50/30 dark:bg-theme-900/30",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {task.status === "uploading" ? (
          <FiLoader className="w-5 h-5 animate-spin text-theme-500 mt-0.5" />
        ) : task.status === "error" ? (
          <FiX className="w-5 h-5 text-red-500 mt-0.5" />
        ) : task.status === "done" ? (
          <FiCheck className="w-5 h-5 text-green-600 mt-0.5" />
        ) : (
          /* pending or unknown => show icon */
          <FileIcon className="w-5 h-5 text-theme-700 dark:text-theme-300" />
        )}

        <div className="flex-1">
          <p
            className={cn(
              "truncate font-medium text-sm",
              "text-theme-800 dark:text-theme-100"
            )}
            title={task.file.name}
          >
            {task.file.name}
          </p>
          <p className="text-xs text-theme-600 dark:text-theme-400">
            {sizeLabel}
          </p>
        </div>
      </div>

      {/* Body by status */}
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
/*  small subcomponent for link lines                                 */
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
        "bg-theme-100/40 dark:bg-theme-800/40"
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
            /* no-op */
          }
        }}
        className="p-1 rounded hover:bg-theme-200/60 dark:hover:bg-theme-700/60 transition"
      >
        <FiCopy className="w-4 h-4" />
      </button>
    </div>
  );
}
