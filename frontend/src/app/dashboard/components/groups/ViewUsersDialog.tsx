"use client";

import { useEffect, useMemo, useState } from "react";
import { atom, useAtom } from "jotai";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { FiX } from "react-icons/fi";
import { BiTrash } from "react-icons/bi";
import { cn } from "@/utils/cn";
import { useToast } from "@/lib/toast";
import ViewUserFilesDialog from "../users/ViewUserFilesDialog";
import MoveUserSelect from "../users/MoveUserSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  getGroups,
  getUsers,
  updateUserGroup,
  deleteUser as apiDeleteUser,
  UserItem,
} from "@/lib/admin";

/* ---------- local types for group prop ---------- */
interface GroupInfo {
  id: number;
  name: string;
  file_count: number;
  storage_bytes: number;
}

/* =================================================================== */
export default function ViewUsersDialog({
  group,
  sessionToken,
  onChanged,
}: {
  group: GroupInfo;
  sessionToken: string;
  onChanged: () => void;
}) {
  const { push } = useToast();

  /* ---- local atoms (scoped per dialog) ---- */
  const openA    = useMemo(() => atom(false), []);
  const loadingA = useMemo(() => atom(false), []);
  const errorA   = useMemo(() => atom(""), []);
  const usersA   = useMemo(() => atom<UserItem[]>([]), []);
  const groupsA  = useMemo(() => atom<{ id: number; name: string }[]>([]), []);

  const [open, setOpen]       = useAtom(openA);
  const [loading, setLoading] = useAtom(loadingA);
  const [errorMsg, setError]  = useAtom(errorA);
  const [users, setUsers]     = useAtom(usersA);
  const [groups, setGroups]   = useAtom(groupsA);

  /* ---------- pull data whenever dialog opens ---------- */
  useEffect(() => {
    if (!open) return;
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchAll() {
    setLoading(true); setError("");
    try {
      setUsers(await getUsers(sessionToken, group.id));
      setGroups(
        (await getGroups(sessionToken)).filter(
          (g) => !["SUPER_ADMIN", "GUEST"].includes(g.name),
        ).map(({ id, name }) => ({ id, name })),
      );
    } catch (e) { // Remove ': any'
      const errorMessage = e instanceof Error ? e.message : "Load error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- helpers ---------- */
  const isImmutable = (u: UserItem) =>
    u.group?.name === "SUPER_ADMIN" || u.group?.name === "GUEST";

  async function moveUser(userId: number, newGroupId: number) {
    if (newGroupId === group.id) return;
    setLoading(true); setError("");
    try {
      await updateUserGroup(userId, newGroupId, sessionToken);
      setUsers((p) => p.filter((u) => u.id !== userId));
      push({ title: "User moved", variant: "success" });
      onChanged();
    } catch (e) { // Remove ': any'
      const errorMessage = e instanceof Error ? e.message : "Move failed";
      setError(errorMessage);
      push({ title: "Move failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(user: UserItem, deleteFiles: boolean) {
    setLoading(true); setError("");
    try {
      await apiDeleteUser(user.id, deleteFiles, sessionToken);
      setUsers((p) => p.filter((u) => u.id !== user.id));
      push({ title: "User deleted", variant: "success" });
      onChanged();
    } catch (e) { // Remove ': any'
      const errorMessage = e instanceof Error ? e.message : "Delete failed";
      setError(errorMessage);
      push({ title: "Delete failed", variant: "error" });
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
        <button className="px-3 py-1.5 rounded bg-theme-500 text-white hover:bg-theme-600">
          View users
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <Dialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-xl shadow-xl",
            "w-[92vw] max-w-3xl max-h-[85vh] overflow-y-auto p-6",
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Users in “{group.name}”</h3>
            <Dialog.Close asChild>
              <button className="p-2 rounded hover:bg-theme-200/50 dark:hover:bg-theme-800/50">
                <FiX className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {errorMsg && (
            <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded mb-3">
              {errorMsg}
            </p>
          )}

          {loading ? (
            <p>Loading…</p>
          ) : users.length === 0 ? (
            <p>No users in this group.</p>
          ) : (
            <Tooltip.Provider delayDuration={80}>
              <ul className="space-y-3">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className={cn(
                      "p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
                      "border-theme-200/50 dark:border-theme-800/50 bg-theme-50/20 dark:bg-theme-900/20",
                    )}
                  >
                    {/* LEFT column */}
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">
                        {u.username}
                        {u.group?.name === "SUPER_ADMIN" && <Label>ADMIN</Label>}
                        {u.group?.name === "GUEST"        && <Label>GUEST</Label>}
                      </p>
                      <p className="text-sm text-theme-600 dark:text-theme-400">
                        {u.email || "(no email)"}
                      </p>
                      <p className="text-sm text-theme-600 dark:text-theme-400">
                        Files:&nbsp;{u.file_count}&nbsp;/&nbsp;
                        {(u.storage_bytes / 1e6).toFixed(1)} MB
                      </p>
                    </div>

                    {/* RIGHT controls (skip immutable) */}
                    {!isImmutable(u) && (
                      <div className="flex items-center gap-3">
                        <ViewUserFilesDialog
                          userId={u.id}
                          username={u.username}
                          sessionToken={sessionToken}
                        />

                        <MoveUserSelect
                          currentGroupId={group.id}
                          groups={groups}
                          onSelect={(gid) => moveUser(u.id, gid)}
                        />

                        <DeleteUserBtn user={u} onDelete={deleteUser} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Tooltip.Provider>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------- helper sub-components ---------- */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-theme-300 dark:bg-theme-700">
      {children}
    </span>
  );
}

function DeleteUserBtn({
  user,
  onDelete,
}: {
  user: UserItem;
  onDelete: (user: UserItem, deleteFiles: boolean) => void;
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
        />
        Also delete all uploaded files
      </label>
    </ConfirmDialog>
  );
}
