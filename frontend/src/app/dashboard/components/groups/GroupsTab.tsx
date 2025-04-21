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

/* ---------- TYPES ---------- */
interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

/* ---------- ATOMS ---------- */
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

  /* ---------- fetch once ---------- */
  useEffect(() => {
    if (!session?.accessToken || hasFetched) return;
    fetchGroups();
    setHasFetched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, hasFetched]);

  async function fetchGroups() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } },
      );
      if (!res.ok) throw new Error("Failed to fetch groups");
      setGroups(await res.json());
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally { setLoading(false); }
  }

  /* helpers to mutate local state after CRUD */
  const onCreated = (g: GroupItem) => setGroups((p) => [...p, g]);
  const onDeleted = (id: number) =>
    setGroups((p) => p.filter((g) => g.id !== id));
  const onUpdated = (u: GroupItem) =>
    setGroups((p) => p.map((g) => (g.id === u.id ? u : g)));

  const normalGroups = groups.filter((g) => g.name !== "SUPER_ADMIN");
  const deletionLocked = normalGroups.length <= 1; // can't drop the last one

  /* ---------- RENDER ---------- */
  return (
    <div>
      <h3 className={cn(
        "text-lg font-medium text-theme-700 dark:text-theme-300 mb-2",
        "border-b border-theme-200 dark:border-theme-800 pb-2"
      )}>
        Groups Management
      </h3>
      <p className="text-sm text-theme-500 dark:text-theme-400 mb-4">
        Create, edit, or remove groups. At least one non‑admin group must exist.
      </p>

      {errorMsg && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded mb-4">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center justify-between mb-6">
        <span className="text-sm">
          {loading ? "Loading…" : `${groups.length} groups`}
        </span>
        <AddGroupDialog sessionToken={session?.accessToken || ""} onCreated={onCreated} />
      </div>

      {/* ---------- list ---------- */}
      <Tooltip.Provider delayDuration={100}>
        <div className={cn(
          "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
          "border border-theme-200/50 dark:border-theme-800/50"
        )}>
          {groups.length === 0 ? (
            <p>No groups found.</p>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => {
                const isSuper = g.name === "SUPER_ADMIN";
                const isLastNormal = !isSuper && deletionLocked;
                return (
                  <li key={g.id} className={cn(
                    "p-3 rounded border bg-theme-50/20 dark:bg-theme-900/20",
                    "border-theme-200/50 dark:border-theme-800/50"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{g.name}</p>
                      <div className="flex items-center gap-2">
                        <EditGroupDialog
                          group={g}
                          sessionToken={session?.accessToken || ""}
                          onUpdated={onUpdated}
                        />
                        {isSuper || isLastNormal ? (
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
                            onDeleted={(_, __) => onDeleted(g.id)}
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-theme-600 dark:text-theme-400 mb-1">
                      Max file size:&nbsp;
                      <ByteValueTooltip bytes={g.max_file_size} />
                    </p>
                    <p className="text-sm text-theme-600 dark:text-theme-400">
                      Max storage:&nbsp;
                      {g.max_storage_size == null
                        ? "Unlimited"
                        : <ByteValueTooltip bytes={g.max_storage_size} />}
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
