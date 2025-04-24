"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { cn } from "@/utils/cn";
import { ReactNode, useState } from "react";

/**
 * Thin wrapper around Radix `AlertDialog`.
 *
 * ```tsx
 * <ConfirmDialog
 *     trigger={<button>Delete</button>}
 *     title="Delete file?"
 *     description="This action cannot be undone."
 *     danger
 *     onConfirm={handleDelete}
 * />
 * ```
 */
export default function ConfirmDialog({
  trigger,
  open: controlled,
  onOpenChange,
  title,
  description,
  children,            // optional extra body (checkbox etc.)
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  danger = false,
  onConfirm,
  confirmDisabled = false,
}: {
  /** If supplied we render it as `<AlertDialog.Trigger>` */
  trigger?: ReactNode;
  /** Controlled mode (optional) */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;

  title: ReactNode;
  description?: ReactNode;
  /** Extra body between description and footer  */
  children?: ReactNode;

  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + red title */
  danger?: boolean;
  /** Called on confirm click. If it returns a promise we await it before closing. */
  onConfirm: () => void | Promise<void>;
  /** Disable confirm button  */
  confirmDisabled?: boolean;
}) {
  /* ── internal uncontrolled state ─────────────────────────────── */
  const [_open, _setOpen] = useState(false);
  const open       = controlled ?? _open;
  const setOpen    = onOpenChange ?? _setOpen;

  /* ── inner handlers ──────────────────────────────────────────── */
  const handleConfirm = async () => {
    await onConfirm?.();
    setOpen(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}

      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4",
          )}
        >
          <AlertDialog.Title
            className={cn(
              "text-lg font-medium",
              danger ? "text-red-600 dark:text-red-400" : "text-theme-900 dark:text-theme-100",
            )}
          >
            {title}
          </AlertDialog.Title>

          {description && (
            <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300">
              {description}
            </AlertDialog.Description>
          )}

          {children}

          <div className="flex justify-end gap-3 pt-2">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700"
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>

            <button
              disabled={confirmDisabled}
              onClick={handleConfirm}
              className={cn(
                "px-4 py-2 rounded text-white",
                danger
                  ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                  : "bg-theme-500 hover:bg-theme-600 disabled:bg-theme-300",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
