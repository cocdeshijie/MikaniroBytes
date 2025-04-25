"use client";

import { atom, useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BiTrash } from "react-icons/bi";
import { FiLoader } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { ByteValueTooltip } from "../groups/ByteValueTooltip";
import { useToast } from "@/lib/toast";
import ViewUserFilesDialog from "./ViewUserFilesDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Select, SelectOption } from "@/components/ui/Select";
import {
  getGroups,
  getUsers,
  updateUserGroup,
  deleteUser as apiDeleteUser,
  UserItem,
} from "@/lib/admin";

/* ------------------------------------------------------------------ */
/*                             ATOMS                                  */
/* ------------------------------------------------------------------ */
const loadingAtom    = atom(false);
const errorMsgAtom   = atom("");
const usersAtom      = atom<UserItem[]>([]);
const groupsAtom     = atom<{ id: number; name: string }[]>([]);
const hasFetchedAtom = atom(false);

/* ------------------------------------------------------------------ */
/*                           HELPERS                                  */
/* ------------------------------------------------------------------ */
const EXCLUDE = ["SUPER_ADMIN", "GUEST"];
const isSuperAdmin = (u: UserItem) => u.group?.name === "SUPER_ADMIN";

/* ================================================================== */
/*                             COMPONENT                              */
/* ================================================================== */
export default function UsersTab() {
  const { data: session } = useSession();
  const { push }          = useToast();

  const [loading, setLoading]   = useAtom(loadingAtom);
  const [errorMsg, setError]    = useAtom(errorMsgAtom);
  const [users, setUsers]       = useAtom(usersAtom);
  const [groups, setGroups]     = useAtom(groupsAtom);
  const [hasFetched, setFetched] = useAtom(hasFetchedAtom);

  /* ---------- first fetch ---------- */
  useEffect(() => {
    if (!session?.accessToken || hasFetched) return;
    void fetchAll();
    setFetched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, hasFetched]);

  async function fetchAll() {
    setLoading(true);  setError("");
    try {
      setUsers(await getUsers(session?.accessToken));

      const g = await getGroups(session?.accessToken);
      setGroups(g.filter((x) => !EXCLUDE.includes(x.name)).map(({ id, name }) => ({ id, name })));
    } catch (e) { // Remove ': any'
      const errorMessage = e instanceof Error ? e.message : "Load error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- mutations ---------- */
  async function handleGroupChange(userId: number, newGroupId: number) {
    setLoading(true); setError("");
    try {
      const updated = await updateUserGroup(userId, newGroupId, session?.accessToken);
      setUsers((p) => p.map((u) => (u.id === updated.id ? updated : u)));
      push({ title: "Group updated", variant: "success" });
    } catch (e) { // Remove ': any'
      const errorMessage = e instanceof Error ? e.message : "Update failed";
      setError(errorMessage);
      push({ title: "Update failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(user: UserItem, deleteFiles: boolean) {
    setLoading(true); setError("");
    try {
      await apiDeleteUser(user.id, deleteFiles, session?.accessToken);
      setUsers((p) => p.filter((u) => u.id !== user.id));
      push({ title: "User deleted", variant: "success" });
    } catch (e) { // Remove ': any'
      const errorMessage = e instanceof Error ? e.message : "Delete failed";
      setError(errorMessage);
      push({ title: "Delete failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Select options ---------- */
  const groupOpts: SelectOption[] = groups.map((g) => ({
    value: g.id.toString(),
    label: g.name,
  }));

  /* ------------------------------------------------------------------ */
  return (
    <div
      className={cn(
        "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
        "border border-theme-200/50 dark:border-theme-800/50",
      )}
    >
      <h3 className="text-lg font-medium mb-2">Users Management</h3>

      {errorMsg && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
          {errorMsg}
        </p>
      )}

      {loading && users.length === 0 && <p>Loading…</p>}

      <ul className="space-y-3">
        {users.map((u) => (
          <li
            key={u.id}
            className={cn(
              "p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
              "border-theme-200/50 dark:border-theme-800/50 bg-theme-50/20 dark:bg-theme-900/20",
            )}
          >
            {/* ---- left column ---- */}
            <div className="space-y-1 flex-1">
              <p className="font-medium">{u.username}</p>
              <p className="text-sm text-theme-600 dark:text-theme-400">
                {u.email || "(no email)"}
              </p>
              <p className="text-sm text-theme-600 dark:text-theme-400">
                Files: {u.file_count} – <ByteValueTooltip bytes={u.storage_bytes} />
              </p>
            </div>

            {/* ---- right controls ---- */}
            <div className="flex items-center gap-3">
              <ViewUserFilesDialog
                userId={u.id}
                username={u.username}
                sessionToken={session?.accessToken ?? ""}
              />

              {/* group select (skip SUPER_ADMIN) */}
              {isSuperAdmin(u) ? (
                <span className="text-sm">{u.group?.name}</span>
              ) : (
                <Select
                  minWidth="7rem"
                  value={(u.group?.id ?? "").toString()}
                  onValueChange={(v) => handleGroupChange(u.id, +v)}
                  options={groupOpts}
                />
              )}

              {/* delete */}
              {!isSuperAdmin(u) && (
                <DeleteUserButton user={u} onDelete={deleteUser} />
              )}
            </div>
          </li>
        ))}
      </ul>

      {loading && users.length > 0 && (
        <div className="flex items-center gap-2 mt-4 text-theme-600">
          <FiLoader className="animate-spin" /> working…
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                per-row Delete button  (ConfirmDialog)              */
/* ------------------------------------------------------------------ */
function DeleteUserButton({
  user,
  onDelete,
}: {
  user: UserItem;
  onDelete: (u: UserItem, deleteFiles: boolean) => void;
}) {
  const [deleteFiles, setDel] = useState(false);

  return (
    <ConfirmDialog
      title={`Delete “${user.username}”?`}
      description="This action cannot be undone."
      danger
      trigger={
        <button
          className="p-2 rounded bg-red-600 text-white hover:bg-red-700"
          title="Delete user"
        >
          <BiTrash className="h-4 w-4" />
        </button>
      }
      confirmLabel="Delete"
      onConfirm={() => onDelete(user, deleteFiles)}
    >
      <label className="flex items-center gap-2 text-sm mt-1">
        <input
          type="checkbox"
          checked={deleteFiles}
          onChange={(e) => setDel(e.target.checked)}
          className="cursor-pointer"
        />
        Also delete all uploaded files?
      </label>
    </ConfirmDialog>
  );
}
