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
import ViewUsersDialog from "./ViewUsersDialog";
import ViewGroupFilesDialog from "./ViewGroupFilesDialog";           // ★ NEW
import type { GroupItem } from "@/types/sharedTypes";

/* ---------- atoms ---------- */
const groupsAtom  = atom<GroupItem[]>([]);
const fetchedAtom = atom(false);
const loadingAtom = atom(false);
const errorAtom   = atom("");

export default function GroupsTab() {
  const { data: session }     = useSession();
  const [groups, setGroups]   = useAtom(groupsAtom);
  const [fetched, setFetched] = useAtom(fetchedAtom);
  const [loading, setLoad]    = useAtom(loadingAtom);
  const [error, setError]     = useAtom(errorAtom);

  /* -------- initial fetch -------- */
  useEffect(() => {
    if (!session?.accessToken || fetched) return;
    fetchGroups();
    setFetched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, fetched]);

  async function fetchGroups() {
    setLoad(true); setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } },
      );
      if (!res.ok) throw new Error("Failed to fetch groups");
      setGroups(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally { setLoad(false); }
  }

  /* -------- local mutators -------- */
  const add = (g: GroupItem) => setGroups((p) => [...p, g]);
  const upd = (g: GroupItem) => setGroups((p) => p.map((r) => (r.id === g.id ? g : r)));
  const del = (id: number)   => setGroups((p) => p.filter((g) => g.id !== id));

  /* -------- derived -------- */
  const normal      = groups.filter((g) => g.name !== "SUPER_ADMIN");
  const lockDelete  = normal.length <= 1;

  /* -------- UI -------- */
  return (
    <div>
      <h3 className={cn(
        "text-lg font-medium mb-2",
        "border-b border-theme-200 dark:border-theme-800 pb-2",
      )}>
        Groups Management
      </h3>

      {error && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded mb-4">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between mb-6">
        <span className="text-sm">
          {loading ? "Loading…" : `${groups.length} groups`}
        </span>
        <AddGroupDialog
          sessionToken={session?.accessToken || ""}
          onCreated={add}
        />
      </div>

      <Tooltip.Provider delayDuration={100}>
        <div className={cn(
          "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
          "border border-theme-200/50 dark:border-theme-800/50",
        )}>
          {groups.length === 0 ? (
            <p>No groups found.</p>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => {
                const isSuper   = g.name === "SUPER_ADMIN";
                const prevent   = !isSuper && lockDelete;

                return (
                  <li key={g.id} className={cn(
                    "p-3 rounded border bg-theme-50/20 dark:bg-theme-900/20",
                    "border-theme-200/50 dark:border-theme-800/50",
                  )}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-medium">{g.name}</p>
                      <div className="flex items-center gap-2">
                        {/* ★ NEW – open dialog to browse all files in group */}
                        <ViewGroupFilesDialog
                          groupId={g.id}
                          groupName={g.name}
                          sessionToken={session?.accessToken || ""}
                        />

                        {/* existing – view users list */}
                        <ViewUsersDialog
                          group={g}
                          sessionToken={session?.accessToken || ""}
                          onChanged={fetchGroups}
                        />

                        <EditGroupDialog
                          group={g}
                          sessionToken={session?.accessToken || ""}
                          onUpdated={upd}
                        />
                        {isSuper || prevent ? (
                          <button
                            disabled
                            title={isSuper
                              ? "Cannot delete SUPER_ADMIN"
                              : "At least one group must remain"}
                            className="px-3 py-1.5 rounded text-white bg-gray-400 cursor-not-allowed"
                          >
                            Delete
                          </button>
                        ) : (
                          <ConfirmDeleteGroupDialog
                            group={g}
                            sessionToken={session?.accessToken || ""}
                            onDeleted={() => del(g.id)}
                          />
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-theme-600 dark:text-theme-400">
                      Max file:&nbsp;
                      {g.max_file_size === null
                        ? "Unlimited"
                        : <ByteValueTooltip bytes={g.max_file_size} />}
                      &nbsp;|&nbsp;Max storage:&nbsp;
                      {g.max_storage_size === null
                        ? "Unlimited"
                        : <ByteValueTooltip bytes={g.max_storage_size} />}
                    </p>
                    <p className="text-sm text-theme-600 dark:text-theme-400 mt-0.5">
                      Stored:&nbsp;{g.file_count} files –&nbsp;
                      <ByteValueTooltip bytes={g.storage_bytes} />
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Tooltip.Provider>
    </div>
  );
}

