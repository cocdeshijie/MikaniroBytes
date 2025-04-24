"use client";

import { useEffect, useMemo } from "react";
import { atom, useAtom } from "jotai";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { FiX } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import ViewUserFilesDialog from "../users/ViewUserFilesDialog";
import ConfirmDeleteUserDialog from "../users/ConfirmDeleteUserDialog";
import MoveUserSelect from "../users/MoveUserSelect";
import { api, ApiError } from "@/lib/api";

/* ---------- local types ---------- */
interface GroupInfo {
  id: number;
  name: string;
  file_count: number;
  storage_bytes: number;
}
interface UserItem {
  id: number;
  username: string;
  email: string | null;
  group: { id: number; name: string } | null;
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

  const openA    = useMemo(() => atom(false), [group.id]);
  const loadingA = useMemo(() => atom(false), [group.id]);
  const errorA   = useMemo(() => atom(""), [group.id]);
  const usersA   = useMemo(() => atom<UserItem[]>([]), [group.id]);
  const groupsA  = useMemo(() => atom<{ id: number; name: string }[]>([]), [group.id]);

  const [open, setOpen]       = useAtom(openA);
  const [loading, setLoading] = useAtom(loadingA);
  const [errorMsg, setError]  = useAtom(errorA);
  const [users, setUsers]     = useAtom(usersA);
  const [groups, setGroups]   = useAtom(groupsA);

  /* ---------- fetch each time dialog opens ---------- */
  useEffect(() => {
    if (!open) return;
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const u = await api<UserItem[]>(
        `/admin/users?group_id=${group.id}`,
        { token: sessionToken },
      );
      setUsers(u);

      const gRaw = await api<any[]>("/admin/groups", { token: sessionToken });
      setGroups(
        gRaw
          .filter((g) => !["SUPER_ADMIN", "GUEST"].includes(g.name))
          .map(({ id, name }) => ({ id, name })),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Load error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- helpers ---------- */
  const isImmutable = (u: UserItem) =>
    u.group?.name === "SUPER_ADMIN" || u.group?.name === "GUEST";

  async function moveUser(userId: number, newGroupId: number) {
    if (newGroupId === group.id) return;
    setLoading(true);
    setError("");
    try {
      await api(
        `/admin/users/${userId}/group`,
        { method: "PUT", token: sessionToken, json: { group_id: newGroupId } },
      );
      setUsers((p) => p.filter((u) => u.id !== userId));
      push({ title: "User moved", variant: "success" });
      onChanged();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Move failed";
      setError(msg);
      push({ title: "Move failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  function localDelete(userId: number) {
    setUsers((p) => p.filter((u) => u.id !== userId));
    onChanged();
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
                      "p-4 rounded-lg border bg-theme-50/20 dark:bg-theme-900/20",
                      "border-theme-200/50 dark:border-theme-800/50",
                      "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
                    )}
                  >
                    {/* LEFT */}
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

                    {/* RIGHT */}
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
                        <ConfirmDeleteUserDialog
                          user={u}
                          sessionToken={sessionToken}
                          afterDelete={localDelete}
                        />
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

/* helper badge */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-theme-300 dark:bg-theme-700">
      {children}
    </span>
  );
}
