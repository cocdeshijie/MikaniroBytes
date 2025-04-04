"use client";

import { useSession } from "next-auth/react";
import { cn } from "@/utils/cn";
import { useEffect, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import ConfirmDeleteGroupDialog from "./ConfirmDeleteGroupDialog";
import AddGroupDialog from "./AddGroupDialog";
import { ByteValueTooltip } from "./ByteValueTooltip";

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }
      );
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

  function onDeleteConfirmed(groupId: number, _deleteFiles: boolean) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function onGroupCreated(newGroup: GroupItem) {
    setGroups((prev) => [...prev, newGroup]);
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

      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-theme-700 dark:text-theme-300">
          {loading ? "Loading..." : `${groups.length} groups found.`}
        </span>
        <AddGroupDialog
          sessionToken={session?.accessToken || ""}
          onCreated={onGroupCreated}
        />
      </div>

      {/* CHANGED HERE: Wrap the group list in <Tooltip.Provider> so all tooltips work properly */}
      <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
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

                  {/* CHANGED HERE: max_file_size in a ByteValueTooltip */}
                  <p className="text-sm text-theme-600 dark:text-theme-400 mb-1">
                    Max file size:{" "}
                    <ByteValueTooltip bytes={g.max_file_size} />
                  </p>

                  {/* CHANGED HERE: max_storage_size => null => "Unlimited" else ByteValueTooltip */}
                  <p className="text-sm text-theme-600 dark:text-theme-400">
                    Max total storage:{" "}
                    {g.max_storage_size == null ? (
                      "Unlimited"
                    ) : (
                      <ByteValueTooltip bytes={g.max_storage_size} />
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Tooltip.Provider>
    </div>
  );
}
