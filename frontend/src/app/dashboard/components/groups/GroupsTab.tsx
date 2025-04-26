"use client";

import { atom, useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { FiLoader, FiTrash } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { ByteValueTooltip } from "./ByteValueTooltip";
import AddGroupDialog from "./AddGroupDialog";
import EditGroupDialog from "./EditGroupDialog";
import ViewUsersDialog from "./ViewUsersDialog";
import ViewGroupFilesDialog from "./ViewGroupFilesDialog";
import type { GroupItem } from "@/types/sharedTypes";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  getGroups,
  deleteGroup as apiDeleteGroup,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*                         LOCAL ATOMS                                */
/* ------------------------------------------------------------------ */
function useLocalAtoms() {
  return {
    groupsAtom : useMemo(() => atom<GroupItem[]>([]), []),
    fetchedA   : useMemo(() => atom(false), []),
    loadingA   : useMemo(() => atom(false), []),
    errorA     : useMemo(() => atom(""), []),
  };
}

const IMMUTABLE = ["SUPER_ADMIN", "GUEST"];

/* ================================================================== */
export default function GroupsTab() {
  const { token } = useAuth();
  const { groupsAtom, fetchedA, loadingA, errorA } = useLocalAtoms();

  const [groups, setGroups]   = useAtom(groupsAtom);
  const [fetched, setFetched] = useAtom(fetchedA);
  const [loading, setLoading] = useAtom(loadingA);
  const [error, setError]     = useAtom(errorA);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Provide token as a fallback empty string if it's undefined
      const realToken = token ?? "";
      const data = await getGroups(realToken);
      setGroups(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch groups";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [token, setGroups, setLoading, setError]);

  /* ---------- first fetch ---------- */
  useEffect(() => {
    // If no token or we've already fetched => skip
    if (!token || fetched) return;
    void fetchGroups();
    setFetched(true);
  }, [token, fetched, setFetched, fetchGroups]);

  /* helpers to mutate list locally */
  const add = (g: GroupItem) => setGroups((p) => [...p, g]);
  const upd = (g: GroupItem) => setGroups((p) => p.map((x) => (x.id === g.id ? g : x)));
  const del = (id: number)   => setGroups((p) => p.filter((g) => g.id !== id));

  const normal        = groups.filter((g) => !IMMUTABLE.includes(g.name));
  const lockDeleteAny = normal.length <= 1;
  const firstLoad     = loading && groups.length === 0;

  /* ------------------------------------------------------------ */
  async function deleteGroup(g: GroupItem, deleteFiles: boolean) {
    setLoading(true);
    setError("");
    try {
      await apiDeleteGroup(g.id, deleteFiles, token ?? "");
      del(g.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*                                UI                                  */
  /* ------------------------------------------------------------------ */
  return (
    <div>
      <h3 className="text-lg font-medium mb-2">Groups Management</h3>

      {error && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
          {error}
        </p>
      )}

      {/* top-bar */}
      <div className="flex items-center justify-between mb-6 relative">
        <span className="text-sm">
          {loading ? "Loading…" : `${groups.length} groups`}
        </span>
        {loading && groups.length > 0 && (
          <FiLoader className="absolute -top-0.5 left-20 w-4 h-4 animate-spin text-theme-600" />
        )}
        <AddGroupDialog
          sessionToken={token ?? ""}
          onCreated={add}
        />
      </div>

      <Tooltip.Provider delayDuration={100}>
        <div
          className={cn(
            "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
            "border border-theme-200/50 dark:border-theme-800/50",
          )}
        >
          {firstLoad && <SkeletonList />}
          {!firstLoad && groups.length === 0 && <p>No groups found.</p>}

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
                    "p-3 rounded border space-y-2",
                    "border-theme-200/50 dark:border-theme-800/50",
                    "bg-theme-50/20 dark:bg-theme-900/20",
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-medium">{g.name}</p>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                      <ViewGroupFilesDialog
                        groupId={g.id}
                        groupName={g.name}
                        sessionToken={token ?? ""}
                      />
                      <ViewUsersDialog
                        group={g}
                        sessionToken={token ?? ""}
                        onChanged={fetchGroups}
                      />
                      <EditGroupDialog
                        group={g}
                        sessionToken={token ?? ""}
                        onUpdated={upd}
                      />

                      {deleteDisabled ? (
                        <button
                          disabled
                          title="Cannot delete"
                          className="px-3 py-1.5 rounded text-white bg-gray-400 cursor-not-allowed"
                        >
                          Delete
                        </button>
                      ) : (
                        <DeleteGroupButton group={g} onDelete={deleteGroup} />
                      )}
                    </div>
                  </div>

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

                  <p className="text-sm text-theme-600 dark:text-theme-400">
                    Stored:&nbsp;{g.file_count} files –&nbsp;
                    <ByteValueTooltip bytes={g.storage_bytes} />
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </Tooltip.Provider>
    </div>
  );
}

/* ---------- per-row delete button ---------- */
function DeleteGroupButton({
  group,
  onDelete,
}: {
  group: GroupItem;
  onDelete: (g: GroupItem, deleteFiles: boolean) => void;
}) {
  const [deleteFiles, setDel] = useState(false);

  return (
    <ConfirmDialog
      title={`Delete “${group.name}”?`}
      description="Deleting a group removes all its users. You can also delete every file they uploaded."
      danger
      trigger={
        <button className="px-3 py-1.5 rounded text-white bg-red-600 hover:bg-red-700">
          <FiTrash className="inline mr-1 mb-0.5" /> Delete
        </button>
      }
      confirmLabel="Delete"
      onConfirm={() => onDelete(group, deleteFiles)}
    >
      <label className="flex items-center gap-2 text-sm mt-1">
        <input
          type="checkbox"
          checked={deleteFiles}
          onChange={(e) => setDel(e.target.checked)}
        />
        Also delete all user files
      </label>
    </ConfirmDialog>
  );
}

/* ---------- skeleton ---------- */
function SkeletonList() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_x, i) => (
        <li
          key={i}
          className="h-24 rounded border
                     border-theme-200/50 dark:border-theme-800/50
                     bg-theme-200/40 dark:bg-theme-800/40
                     animate-pulse"
        />
      ))}
    </ul>
  );
}
