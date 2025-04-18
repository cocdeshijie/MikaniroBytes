"use client";

import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider"; // ★ NEW

/** Same shape as in GroupsTab. */
interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

function parseSizeToBytes(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null; // blank => unlimited

  const match = trimmed.match(/^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/);
  if (!match) {
    const asNumber = parseFloat(trimmed);
    if (isNaN(asNumber)) return null;
    return Math.round(asNumber);
  }

  let numericPart = parseFloat(match[1].replace(",", "."));
  if (isNaN(numericPart)) return null;
  const unit = match[2] || "b";

  const multipliers = { b: 1, kb: 1_000, mb: 1_000_000, gb: 1_000_000_000, tb: 1_000_000_000_000 };
  return Math.round(numericPart * multipliers[unit as keyof typeof multipliers]);
}

export default function EditGroupDialog({
  group,
  sessionToken,
  onUpdated,
}: {
  group: GroupItem;
  sessionToken: string;
  onUpdated: (updated: GroupItem) => void;
}) {
  const { push } = useToast(); // ★ NEW

  /* ---------- Define stable local atoms once per dialog instance ---------- */
  const dialogOpenAtom = useMemo(() => atom(false), []);
  const nameAtom = useMemo(() => atom(group.name), [group]);
  const allowedAtom = useMemo(
    () => atom(group.allowed_extensions.join(",")),
    [group]
  );
  const maxFileAtom = useMemo(() => atom(String(group.max_file_size)), [group]);
  const maxStoreAtom = useMemo(() => {
    const val =
      group.max_storage_size != null ? String(group.max_storage_size) : "";
    return atom(val);
  }, [group]);
  const errorMsgAtom = useMemo(() => atom(""), []);
  const loadingAtom = useMemo(() => atom(false), []);

  /* ---------- Use those atoms in local state ---------- */
  const [open, setOpen] = useAtom(dialogOpenAtom);
  const [name, setName] = useAtom(nameAtom);
  const [allowedExt, setAllowedExt] = useAtom(allowedAtom);
  const [maxFileSize, setMaxFileSize] = useAtom(maxFileAtom);
  const [maxStorage, setMaxStorage] = useAtom(maxStoreAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);
  const [loading, setLoading] = useAtom(loadingAtom);

  /* ------------------------------------------------------------------ */
  /*                              update                                */
  /* ------------------------------------------------------------------ */
  async function handleUpdate() {
    setErrorMsg("");
    setLoading(true);
    try {
      const isSuperAdmin = group.name === "SUPER_ADMIN";
      // For SUPER_ADMIN, backend won't allow renaming, so we keep it the same
      let finalName = name.trim();
      if (isSuperAdmin) {
        finalName = "SUPER_ADMIN";
      } else if (!finalName) {
        throw new Error("Group name is required");
      }

      // parse allowed extensions
      const exts = allowedExt
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      // parse max file size
      const fileBytes = parseSizeToBytes(maxFileSize);
      if (fileBytes === null) {
        throw new Error(`Invalid max file size: "${maxFileSize}"`);
      }

      // parse max total storage
      const storeBytes = parseSizeToBytes(maxStorage);

      const payload = {
        name: finalName,
        allowed_extensions: exts,
        max_file_size: fileBytes,
        max_storage_size: storeBytes,
      };

      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups/${group.id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to update group");
      }
      const updatedGroup: GroupItem = await res.json();
      onUpdated(updatedGroup);

      // close
      setOpen(false);
      push({ title: "Group updated", description: updatedGroup.name, variant: "success" }); // ★
    } catch (err: any) {
      setErrorMsg(err.message || "Error updating group");
      push({ title: "Update failed", variant: "error" }); // ★
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*                                UI                                  */
  /* ------------------------------------------------------------------ */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "px-3 py-1.5 rounded text-white bg-theme-500 hover:bg-theme-600",
            "transition"
          )}
        >
          Edit
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className={cn("bg-black/30 backdrop-blur-sm fixed inset-0 z-50")}
        />
        <Dialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6"
          )}
        >
          <Dialog.Title
            className={cn(
              "text-lg font-medium text-theme-800 dark:text-theme-200 mb-2"
            )}
          >
            Edit Group “{group.name}”
          </Dialog.Title>
          <Dialog.Description className="text-sm text-theme-600 dark:text-theme-400 mb-4">
            Update the group details.
            For SUPER_ADMIN, you cannot change its name.
          </Dialog.Description>

          {errorMsg && (
            <div
              className={cn(
                "mb-3 p-3 rounded border border-red-500/50 text-red-600 text-sm"
              )}
            >
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                Group Name
              </label>
              <input
                className={cn(
                  "w-full px-3 py-2 rounded border",
                  "border-theme-200 dark:border-theme-700",
                  "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
                )}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MyGroup"
                disabled={group.name === "SUPER_ADMIN"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                Allowed Extensions
              </label>
              <input
                className={cn(
                  "w-full px-3 py-2 rounded border",
                  "border-theme-200 dark:border-theme-700",
                  "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
                )}
                value={allowedExt}
                onChange={(e) => setAllowedExt(e.target.value)}
                placeholder="comma-separated, e.g. jpg,png,gif"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                Max File Size
              </label>
              <input
                className={cn(
                  "w-full px-3 py-2 rounded border",
                  "border-theme-200 dark:border-theme-700",
                  "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
                )}
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(e.target.value)}
                placeholder="e.g. 10MB (blank => unlimited)"
              />
              <p className="text-xs text-theme-400 mt-1">
                Acceptable units: KB, MB, GB, TB (or raw bytes).
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
                Max Total Storage
              </label>
              <input
                className={cn(
                  "w-full px-3 py-2 rounded border",
                  "border-theme-200 dark:border-theme-700",
                  "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
                )}
                value={maxStorage}
                onChange={(e) => setMaxStorage(e.target.value)}
                placeholder="e.g. 1TB or 500MB or blank => unlimited"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                className={cn(
                  "px-4 py-2 rounded border",
                  "border-theme-300 dark:border-theme-700",
                  "bg-theme-200/50 dark:bg-theme-800/50 hover:bg-theme-200 dark:hover:bg-theme-800",
                  "text-theme-700 dark:text-theme-300"
                )}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={loading}
              onClick={handleUpdate}
              className={cn(
                "px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600",
                "transition disabled:bg-theme-300"
              )}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
