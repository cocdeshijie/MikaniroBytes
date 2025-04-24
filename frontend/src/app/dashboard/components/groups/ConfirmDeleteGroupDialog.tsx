"use client";

import { useMemo } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Checkbox     from "@radix-ui/react-checkbox";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import type { GroupItem } from "@/types/sharedTypes";
import { BiCheck } from "react-icons/bi";
import { atom, useAtom } from "jotai";

export default function ConfirmDeleteGroupDialog({
                                                     group,
                                                     sessionToken,
                                                     onDeleted,
                                                     className
                                                 }: {
    group: GroupItem,
    sessionToken: string,
    onDeleted: (groupId: number) => void,
    className?: string
}) {
  const { push } = useToast();

  /* ---------- local atoms ---------- */
  const [open,        setOpen]        = useAtom(useMemo(() => atom(false), []));
  const [deleteFiles, setDeleteFiles] = useAtom(useMemo(() => atom(false), []));
  const [loading,     setLoading]     = useAtom(useMemo(() => atom(false), []));

  /* --------------- confirm handler --------------- */
  async function handleConfirm() {
    setLoading(true);
    try {
      const url =
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups/${group.id}` +
        `?delete_files=${deleteFiles}`;
      const res = await fetch(url, {
        method : "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to delete group");
      }

      onDeleted(group.id);
      setOpen(false);
      push({
        title      : "Group deleted",
        description: group.name,
        variant    : "success",
      });
    } catch (e: any) {
      push({ title: e.message ?? "Delete failed", variant: "error" });
    } finally { setLoading(false); }
  }

  /* ----------------------------- UI ------------------------------ */
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          className="px-3 py-1.5 rounded text-white bg-red-600 hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6"
          )}
        >
          <AlertDialog.Title className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
            Delete “{group.name}”?
          </AlertDialog.Title>

          <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300 mb-4">
            Deleting a group removes <strong>all its users</strong>. You may
            also choose to delete every file they have uploaded.
          </AlertDialog.Description>

          {/* -------- Radix checkbox -------- */}
          <div className="flex items-center gap-2 mb-4">
            <Checkbox.Root
              id={`del_group_${group.id}`}
              checked={deleteFiles}
              onCheckedChange={(v) => setDeleteFiles(!!v)}
              className={cn(
                "h-4 w-4 shrink-0 rounded border",
                "border-theme-400 dark:border-theme-600 bg-white dark:bg-theme-800",
                "flex items-center justify-center",
                "data-[state=checked]:bg-theme-500"
              )}
            >
              <Checkbox.Indicator>
                <BiCheck className="h-3 w-3 text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>

            <label
              htmlFor={`del_group_${group.id}`}
              className="text-sm text-theme-700 dark:text-theme-200 cursor-pointer"
            >
              Also delete all user files
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                disabled={loading}
                onClick={handleConfirm}
                className={cn(
                  "px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700",
                  loading && "disabled:bg-red-300"
                )}
              >
                {loading ? "Deleting…" : "Yes, delete"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
