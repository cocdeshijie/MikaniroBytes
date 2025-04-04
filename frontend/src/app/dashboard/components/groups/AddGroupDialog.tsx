"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/utils/cn";

/** Same as in GroupsTab; define again or import from a shared file. */
interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

/**
 * Convert a string like "10gb", "5 tb", "0.5 gb", "1000000" into bytes (number).
 * Returns null if blank or invalid.
 * You can tweak for KiB vs KB, etc.
 */
function parseSizeToBytes(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null; // blank => unlimited or null
  // e.g. "10gb", "5 tb", "0.5 gb"
  // 1 KB = 1,000 bytes, 1 MB = 1,000,000, etc.
  // For simplicity. If you want 1024-based, adjust accordingly.
  const regex = /^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/;
  const match = trimmed.match(regex);
  if (!match) {
    // try pure number => treat as bytes
    const asNumber = parseFloat(trimmed);
    if (isNaN(asNumber)) return null;
    return Math.round(asNumber);
  }
  let numericPart = parseFloat(match[1].replace(",", "."));
  if (isNaN(numericPart)) return null;
  let unit = match[2] || "b"; // if no unit => bytes

  switch (unit) {
    case "b":
      // just bytes
      break;
    case "kb":
      numericPart *= 1_000;
      break;
    case "mb":
      numericPart *= 1_000_000;
      break;
    case "gb":
      numericPart *= 1_000_000_000;
      break;
    case "tb":
      numericPart *= 1_000_000_000_000;
      break;
    default:
      // unexpected
      return null;
  }

  return Math.round(numericPart);
}

export default function AddGroupDialog({
  sessionToken,
  onCreated,
}: {
  sessionToken: string;
  onCreated: (newGroup: GroupItem) => void;
}) {
  const [open, setOpen] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [allowedExt, setAllowedExt] = useState("jpg,png,gif");
  const [maxFileSize, setMaxFileSize] = useState("10mb"); // example default
  const [maxStorage, setMaxStorage] = useState(""); // blank => unlimited
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setErrorMsg("");
    setLoading(true);

    try {
      if (!name.trim()) {
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
      // storeBytes can be null => unlimited

      // call backend
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            name,
            allowed_extensions: exts,
            max_file_size: fileBytes,
            max_storage_size: storeBytes,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create group");
      }

      const newGroup: GroupItem = await res.json();
      onCreated(newGroup);

      // clear
      setName("");
      setAllowedExt("jpg,png,gif");
      setMaxFileSize("10mb");
      setMaxStorage("");
      setOpen(false); // close dialog
    } catch (err: any) {
      setErrorMsg(err.message || "Error creating group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Trigger Button */}
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600",
            "transition shadow-sm"
          )}
        >
          + Add Group
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
            Create New Group
          </Dialog.Title>
          <Dialog.Description className="text-sm text-theme-600 dark:text-theme-400 mb-4">
            Enter information for the new group.
            You can specify file/space limits using units like “10mb”, “5tb”.
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

          {/* FORM FIELDS */}
          <div className="space-y-4">
            {/* Group Name */}
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
              />
            </div>

            {/* Allowed Extensions */}
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

            {/* Max File Size */}
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
                placeholder="e.g. 10MB (blank => unlimited?)"
              />
              <p className="text-xs text-theme-400 mt-1">
                Acceptable units: KB, MB, GB, TB. Or just enter raw bytes.
              </p>
            </div>

            {/* Max Total Storage */}
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

          {/* ACTION BUTTONS */}
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
              onClick={handleCreate}
              className={cn(
                "px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600",
                "transition disabled:bg-theme-300"
              )}
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
