"use client";

/* ────────────────────────────────────────────────────────────────── */
/*                              IMPORTS                              */
/* ────────────────────────────────────────────────────────────────── */
import { atom, useAtom } from "jotai";
import { useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { FiLoader } from "react-icons/fi";

import { cn } from "@/utils/cn";
import { ByteValueTooltip } from "./ByteValueTooltip";
import AddGroupDialog from "./AddGroupDialog";
import EditGroupDialog from "./EditGroupDialog";
import ConfirmDeleteGroupDialog from "./ConfirmDeleteGroupDialog";
import ViewUsersDialog from "./ViewUsersDialog";
import ViewGroupFilesDialog from "./ViewGroupFilesDialog";
import type { GroupItem } from "@/types/sharedTypes";

/* ────────────────────────────────────────────────────────────────── */
/*                “per-instance” Jotai atoms via useMemo             */
/* ────────────────────────────────────────────────────────────────── */
function useLocalAtoms() {
  /* each call creates a *fresh* atom, so different <GroupsTab> mounts
     never share state                                                    */
  return {
    groupsAtom:  useMemo(() => atom<GroupItem[]>([]), []),
    fetchedAtom: useMemo(() => atom(false), []),
    loadingAtom: useMemo(() => atom(false), []),
    errorAtom:   useMemo(() => atom(""), []),
  };
}

/* immutable groups that can’t be removed */
const IMMUTABLE: readonly string[] = ["SUPER_ADMIN", "GUEST"];

/* =================================================================== */
/*                           COMPONENT                                 */
/* =================================================================== */
export default function GroupsTab() {
  const { data: session } = useSession();
  const { groupsAtom, fetchedAtom, loadingAtom, errorAtom } = useLocalAtoms();

  /* Jotai state */
  const [groups,  setGroups]  = useAtom(groupsAtom);
  const [fetched, setFetched] = useAtom(fetchedAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [error,   setError]   = useAtom(errorAtom);

  /* ─── initial fetch ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!session?.accessToken || fetched) return;
    void fetchGroups();      // fire and forget
    setFetched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, fetched]);

  async function fetchGroups() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch groups");
      const data: GroupItem[] = await res.json();
      setGroups(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  /* ─── helpers to update list after dialogs ──────────────────────── */
  const add = (g: GroupItem)      => setGroups((p) => [...p, g]);
  const upd = (g: GroupItem)      =>
    setGroups((p) => p.map((r) => (r.id === g.id ? g : r)));
  const del = (id: number)        =>
    setGroups((p) => p.filter((g) => g.id !== id));

  /* ─── derived flags ─────────────────────────────────────────────── */
  const normal          = groups.filter((g) => !IMMUTABLE.includes(g.name));
  const lockDeleteAny   = normal.length <= 1;
  const firstLoad       = loading && groups.length === 0;

  /* ───────────────────────────────────────────────────────────────── */
  /*                               UI                                 */
  /* ───────────────────────────────────────────────────────────────── */
  return (
    <div>
      <h3
        className={cn(
          "text-lg font-medium mb-2",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        Groups Management
      </h3>

      {error && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded mb-4">
          {error}
        </p>
      )}

      {/* top bar ---------------------------------------------------- */}
      <div className="flex items-center justify-between mb-6 relative">
        <span className="text-sm">
          {loading ? "Loading…" : `${groups.length} groups`}
        </span>
        {loading && groups.length > 0 && (
          <FiLoader className="absolute -top-0.5 left-20 w-4 h-4 animate-spin text-theme-600" />
        )}
        <AddGroupDialog
          sessionToken={session?.accessToken ?? ""}
          onCreated={add}
        />
      </div>

      {/* main panel ------------------------------------------------- */}
      <Tooltip.Provider delayDuration={100}>
        <div
          className={cn(
            "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
            "border border-theme-200/50 dark:border-theme-800/50"
          )}
        >
          {/* first-load skeleton */}
          {firstLoad && <SkeletonList />}

          {/* no data */}
          {!firstLoad && groups.length === 0 && (
            <p>No groups found.</p>
          )}

          {/* real list */}
          {!firstLoad && groups.length > 0 && (
            <ul className="space-y-3">
              {groups.map((g) => {
                const isSuper = g.name === "SUPER_ADMIN";
                const isGuest = g.name === "GUEST";
                const deleteDisabled =
                  isSuper || isGuest || (lockDeleteAny && !isSuper && !isGuest);

                return (
                  <li
                    key={g.id}
                    className={cn(
                      "p-3 rounded border",
                      "border-theme-200/50 dark:border-theme-800/50",
                      "bg-theme-50/20 dark:bg-theme-900/20 space-y-2"
                    )}
                  >
                    {/* header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="font-medium">{g.name}</p>

                      {/* controls */}
                      <div
                        className={cn(
                          "grid grid-cols-2 gap-2",
                          "sm:flex sm:flex-wrap sm:items-center"
                        )}
                      >
                        <ViewGroupFilesDialog
                          groupId={g.id}
                          groupName={g.name}
                          sessionToken={session?.accessToken ?? ""}
                          className="w-full sm:w-auto"
                        />
                        <ViewUsersDialog
                          group={g}
                          sessionToken={session?.accessToken ?? ""}
                          onChanged={fetchGroups}
                          className="w-full sm:w-auto"
                        />
                        <EditGroupDialog
                          group={g}
                          sessionToken={session?.accessToken ?? ""}
                          onUpdated={upd}
                          className="w-full sm:w-auto"
                        />

                        {deleteDisabled ? (
                          <button
                            disabled
                            title={
                              isSuper
                                ? "Cannot delete SUPER_ADMIN"
                                : isGuest
                                ? "Cannot delete GUEST"
                                : "At least one group must remain"
                            }
                            className="w-full sm:w-auto px-3 py-1.5 rounded text-white bg-gray-400 cursor-not-allowed"
                          >
                            Delete
                          </button>
                        ) : (
                          <ConfirmDeleteGroupDialog
                            group={g}
                            sessionToken={session?.accessToken ?? ""}
                            onDeleted={() => del(g.id)}
                            className="w-full sm:w-auto"
                          />
                        )}
                      </div>
                    </div>

                    {/* limits */}
                    <p className="text-sm text-theme-600 dark:text-theme-400 flex flex-wrap gap-x-1.5">
                      Max file:&nbsp;
                      {g.max_file_size === null ? (
                        "Unlimited"
                      ) : (
                        <ByteValueTooltip bytes={g.max_file_size} />
                      )}
                      &nbsp;|&nbsp;Max storage:&nbsp;
                      {g.max_storage_size === null ? (
                        "Unlimited"
                      ) : (
                        <ByteValueTooltip bytes={g.max_storage_size} />
                      )}
                    </p>

                    {/* usage */}
                    <p className="text-sm text-theme-600 dark:text-theme-400">
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

/* ────────────────────────────────────────────────────────────────── */
/*             simple pulse animation while first page loads          */
/* ────────────────────────────────────────────────────────────────── */
function SkeletonList() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_x, idx) => (
        <li
          key={idx}
          className="h-24 rounded border
                     border-theme-200/50 dark:border-theme-800/50
                     bg-theme-200/40 dark:bg-theme-800/40
                     animate-pulse"
        />
      ))}
    </ul>
  );
}
