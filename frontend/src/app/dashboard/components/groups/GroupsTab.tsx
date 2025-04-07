"use client";

import { atom, useAtom } from "jotai";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/utils/cn";

import { ByteValueTooltip } from "./ByteValueTooltip";
import AddGroupDialog from "./AddGroupDialog";
import EditGroupDialog from "./EditGroupDialog";
import ConfirmDeleteGroupDialog from "./ConfirmDeleteGroupDialog";

/** The Group shape, used across all group components */
interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

// ---------- Jotai Atoms ----------
// We'll keep these outside the component so they aren't recreated each render.
const groupsAtom = atom<GroupItem[]>([]);
const hasFetchedAtom = atom(false);
const loadingAtom = atom(false);
const errorMsgAtom = atom("");

export default function GroupsTab() {
  const { data: session } = useSession();

  const [groups, setGroups] = useAtom(groupsAtom);
  const [hasFetched, setHasFetched] = useAtom(hasFetchedAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);

  // Fetch the groups once
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!hasFetched) {
      fetchGroups();
      setHasFetched(true);
    }
  }, [session?.accessToken, hasFetched, setHasFetched]);

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

  // After a successful CREATE or DELETE or UPDATE, we update local state:
  function onGroupCreated(newGroup: GroupItem) {
    setGroups((prev) => [...prev, newGroup]);
  }
  function onDeleteConfirmed(groupId: number, _deleteFiles: boolean) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }
  function onGroupUpdated(updated: GroupItem) {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
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
        Create, edit, or remove groups. Deleting a group also removes its users
        and optionally their files.
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
                    <div className="flex items-center gap-2">
                      <EditGroupDialog
                        group={g}
                        sessionToken={session?.accessToken || ""}
                        onUpdated={onGroupUpdated}
                      />
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
                  </div>

                  <p className="text-sm text-theme-600 dark:text-theme-400 mb-1">
                    Max file size:{" "}
                    <ByteValueTooltip bytes={g.max_file_size} />
                  </p>
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
