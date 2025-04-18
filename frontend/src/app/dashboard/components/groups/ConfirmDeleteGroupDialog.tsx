"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider"; // ★ NEW

interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

export default function ConfirmDeleteGroupDialog({
  group,
  sessionToken,
  onDeleted,
}: {
  group: GroupItem;
  sessionToken: string;
  onDeleted: (groupId: number, deleteFiles: boolean) => void;
}) {
  const { push } = useToast(); // ★ NEW
  const [open, setOpen] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups/${group.id}?delete_files=${deleteFiles}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to delete group");
      }
      onDeleted(group.id, deleteFiles);
      setOpen(false);
      push({ title: "Group deleted", description: group.name, variant: "success" }); // ★
    } catch (err: any) {
      alert(err.message || "Error deleting group");
      push({ title: "Delete failed", variant: "error" }); // ★
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          className={cn(
            "px-3 py-1.5 rounded text-white bg-red-600 hover:bg-red-700",
            "transition"
          )}
        >
          Delete
        </button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className={cn("bg-black/30 backdrop-blur-sm fixed inset-0 z-50")}
        />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900",
            "rounded-lg shadow-lg max-w-sm w-full p-6"
          )}
        >
          <AlertDialog.Title className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
            Delete Group "{group.name}"?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300 mb-4">
            Deleting a group also deletes all users in that group. Optionally,
            you can also remove all their files.
          </AlertDialog.Description>

          <div className="mb-4 flex items-center space-x-2">
            <input
              type="checkbox"
              id="delete_files"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="cursor-pointer"
            />
            <label
              htmlFor="delete_files"
              className="text-sm text-theme-700 dark:text-theme-200 cursor-pointer"
            >
              Also delete all user files?
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <AlertDialog.Cancel asChild>
              <button
                className={cn(
                  "px-4 py-2 rounded border",
                  "border-theme-300 dark:border-theme-700 text-theme-700 dark:text-theme-200",
                  "bg-theme-200/50 dark:bg-theme-800/50 hover:bg-theme-200 dark:hover:bg-theme-800"
                )}
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
                  "disabled:bg-red-300"
                )}
              >
                {loading ? "Deleting..." : "Yes, delete"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
