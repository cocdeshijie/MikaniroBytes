"use client";

import { useSession } from "next-auth/react";
import { cn } from "@/utils/cn";
import { useEffect, useState } from "react";
import ConfirmDeleteGroupDialog from "./ConfirmDeleteGroupDialog";

interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

export default function GroupsTab() {
  const { data: session } = useSession();

  // local states for simpler logic
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [groupName, setGroupName] = useState("");
  const [allowedExt, setAllowedExt] = useState("jpg,png,gif");
  const [maxFileSize, setMaxFileSize] = useState("10000000");
  const [maxStorage, setMaxStorage] = useState("");

  // Fetch the groups once
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!hasFetched) {
      fetchGroups();
      setHasFetched(true);
    }
  }, [session?.accessToken, hasFetched]);

  async function fetchGroups() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch groups");
      }
      const data: GroupItem[] = await res.json();
      setGroups(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error fetching groups");
    } finally {
      setLoading(false);
    }
  }

  // create group
  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const exts = allowedExt.split(",").map((x) => x.trim()).filter(Boolean);
      const mfs = parseInt(maxFileSize || "10000000", 10);
      let mst: number | null = null;
      if (maxStorage.trim()) {
        const val = parseInt(maxStorage.trim(), 10);
        if (!Number.isNaN(val)) {
          mst = val;
        }
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          name: groupName,
          allowed_extensions: exts,
          max_file_size: mfs,
          max_storage_size: mst,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create group");
      }
      const newGroup: GroupItem = await res.json();
      setGroups((prev) => [...prev, newGroup]);

      // clear form
      setGroupName("");
      setAllowedExt("jpg,png,gif");
      setMaxFileSize("10000000");
      setMaxStorage("");
    } catch (err: any) {
      setErrorMsg(err.message || "Error creating group");
    } finally {
      setLoading(false);
    }
  }

  // Called by the ConfirmDeleteGroupDialog if user confirms deletion
  function onDeleteConfirmed(groupId: number, deleteFiles: boolean) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    // We already performed the server delete from inside the dialog, so we just update the local list
  }

  return (
    <div>
      <h3
        className={cn(
          "text-lg font-medium text-theme-700 dark:text-theme-300 mb-2",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        Groups Management
      </h3>
      <p className="text-sm text-theme-500 dark:text-theme-400 mb-4">
        Create or remove groups. Deleting a group also removes its users and optionally their files.
      </p>

      {errorMsg && (
        <div
          className={cn(
            "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
            "p-3 rounded mb-4 border border-red-200/50 dark:border-red-800/50"
          )}
        >
          {errorMsg}
        </div>
      )}

      {/* Create group form */}
      <div
        className={cn(
          "p-4 mb-6 bg-theme-100/25 dark:bg-theme-900/25",
          "rounded-lg border border-theme-200/50 dark:border-theme-800/50",
          "shadow-sm"
        )}
      >
        <h4 className="font-semibold text-theme-800 dark:text-theme-200 mb-3">
          Add New Group
        </h4>
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
              Group Name
            </label>
            <input
              className={cn(
                "w-full px-3 py-2 rounded border",
                "border-theme-200 dark:border-theme-700",
                "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
              )}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
              Allowed Extensions (comma-separated)
            </label>
            <input
              className={cn(
                "w-full px-3 py-2 rounded border",
                "border-theme-200 dark:border-theme-700",
                "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
              )}
              value={allowedExt}
              onChange={(e) => setAllowedExt(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
              Max File Size (bytes)
            </label>
            <input
              type="number"
              className={cn(
                "w-full px-3 py-2 rounded border",
                "border-theme-200 dark:border-theme-700",
                "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
              )}
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(e.target.value)}
              min={0}
            />
            <p className="text-xs text-theme-400 mt-1">
              E.g. 10000000 = 10MB per file
            </p>
          </div>

          <div>
            <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
              Max Total Storage (bytes, blank = unlimited)
            </label>
            <input
              type="number"
              className={cn(
                "w-full px-3 py-2 rounded border",
                "border-theme-200 dark:border-theme-700",
                "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
              )}
              value={maxStorage}
              onChange={(e) => setMaxStorage(e.target.value)}
              min={0}
            />
            <p className="text-xs text-theme-400 mt-1">
              E.g. 500000000 = ~500MB total
            </p>
          </div>

          <button
            type="submit"
            disabled={!groupName || loading}
            className={cn(
              "px-4 py-2 rounded bg-theme-500 text-white",
              "hover:bg-theme-600 disabled:bg-theme-300 transition"
            )}
          >
            {loading ? "Saving..." : "Create Group"}
          </button>
        </form>
      </div>

      {/* Existing groups list */}
      <div
        className={cn(
          "p-4 bg-theme-100/25 dark:bg-theme-900/25",
          "rounded-lg border border-theme-200/50 dark:border-theme-800/50",
          "shadow-sm"
        )}
      >
        <h4 className="font-semibold text-theme-800 dark:text-theme-200 mb-3">
          Existing Groups
        </h4>
        {groups.length === 0 ? (
          <p className="text-theme-600 dark:text-theme-400">No groups found.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li
                key={g.id}
                className={cn(
                  "p-3 rounded border border-theme-200/50 dark:border-theme-800/50",
                  "bg-theme-50/20 dark:bg-theme-900/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-theme-800 dark:text-theme-200">
                    {g.name}
                  </p>
                  {g.name === "SUPER_ADMIN" ? (
                    <button
                      disabled
                      className="px-3 py-1.5 rounded text-white bg-gray-400 cursor-not-allowed"
                    >
                      Delete
                    </button>
                  ) : (
                    <ConfirmDeleteGroupDialog
                      group={g}
                      sessionToken={session?.accessToken || ""}
                      onDeleted={onDeleteConfirmed}
                    />
                  )}
                </div>
                <p className="text-sm text-theme-600 dark:text-theme-400 mb-1">
                  Allowed: {g.allowed_extensions.join(", ")}
                </p>
                <p className="text-sm text-theme-600 dark:text-theme-400 mb-1">
                  Max file size: {g.max_file_size.toLocaleString()} bytes
                </p>
                <p className="text-sm text-theme-600 dark:text-theme-400">
                  Max total storage:{" "}
                  {g.max_storage_size == null
                    ? "Unlimited"
                    : g.max_storage_size.toLocaleString() + " bytes"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
