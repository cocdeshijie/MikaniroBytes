"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { FiTrash } from "react-icons/fi";
import { cn } from "@/utils/cn";

export interface DeleteDialogProps {
  /** controlled open flag from parent */
  open: boolean;
  /** number of files marked for deletion */
  count: number;
  /** parent sets `open=false` */
  onClose: () => void;
  /** perform the API call – parent receives control */
  onConfirm: () => void;
  /** while the HTTP request is running */
  loading: boolean;
}

/**
 * Generic confirmation dialog used by /dashboard/files.
 */
export default function DeleteFilesDialog({
  open,
  count,
  onClose,
  onConfirm,
  loading,
}: DeleteDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={() => onClose()}>
      {/* Overlay + panel */}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg",
            "w-[90vw] max-w-sm p-6",
            "ring-1 ring-theme-200/50 dark:ring-theme-700/50"
          )}
        >
          {/* Title + icon */}
          <AlertDialog.Title className="flex items-center gap-2 text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
            <FiTrash className="shrink-0" /> Delete&nbsp;{count}&nbsp;file
            {count > 1 ? "s" : ""}?
          </AlertDialog.Title>

          <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300 mb-6">
            This action <strong>cannot</strong> be undone.
          </AlertDialog.Description>

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                disabled={loading}
                className={cn(
                  "px-4 py-2 rounded border",
                  "border-theme-300 dark:border-theme-700",
                  "bg-theme-200/40 dark:bg-theme-800/40 hover:bg-theme-200/70 dark:hover:bg-theme-800/70"
                )}
              >
                Cancel
              </button>
            </AlertDialog.Cancel>

            <AlertDialog.Action asChild>
              <button
                disabled={loading}
                onClick={onConfirm}
                className={cn(
                  "px-4 py-2 rounded bg-red-600 text-white",
                  "hover:bg-red-700 disabled:bg-red-400"
                )}
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
