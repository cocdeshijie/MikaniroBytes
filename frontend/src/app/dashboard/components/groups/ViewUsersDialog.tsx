"use client";

import { useEffect, useMemo } from "react";
import { atom, useAtom } from "jotai";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  BiChevronDown,
  BiChevronUp,
  BiCheck,
  BiTrash,
} from "react-icons/bi";
import { FiX } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { ByteValueTooltip } from "./ByteValueTooltip";
import { useToast } from "@/providers/toast-provider";
import ViewUserFilesDialog from "../users/ViewUserFilesDialog";

/* ---------- types ---------- */
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

  /* ---------------- local atoms ---------------- */
  const openA = useMemo(() => atom(false), []);
  const loadingA = useMemo(() => atom(false), []);
  const errorA = useMemo(() => atom(""), []);
  const usersA = useMemo(() => atom<UserItem[]>([]), []);
  const groupsA = useMemo(() => atom<{ id: number; name: string }[]>([]), []);

  const [open, setOpen] = useAtom(openA);
  const [loading, setLoad] = useAtom(loadingA);
  const [error, setError] = useAtom(errorA);
  const [users, setUsers] = useAtom(usersA);
  const [groups, setGroups] = useAtom(groupsA);

  /* ------------ fetch each open ------------ */
  useEffect(() => {
    if (open) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchAll() {
    setLoad(true);
    setError("");
    try {
      /* users */
      const uRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      if (!uRes.ok) throw new Error("Failed to fetch users");
      const all: UserItem[] = await uRes.json();
      setUsers(all.filter((u) => u.group?.id === group.id));

      /* groups (for move‑to select) */
      const gRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      if (!gRes.ok) throw new Error("Failed to fetch groups");
      const list: any[] = await gRes.json();
      setGroups(
        list
          .filter((g) => !["SUPER_ADMIN", "GUEST"].includes(g.name))
          .map(({ id, name }) => ({ id, name }))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoad(false);
    }
  }

  /* ------------ helpers ------------ */
  const isSuper = (u: UserItem) => u.group?.name === "SUPER_ADMIN";

  async function moveUser(userId: number, newGroupId: number) {
    if (newGroupId === group.id) return;
    setLoad(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users/${userId}/group`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ group_id: newGroupId }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Update failed");
      }
      setUsers((p) => p.filter((u) => u.id !== userId));
      push({ title: "User moved", variant: "success" });
      onChanged(); // update group stats in parent
    } catch (e: any) {
      setError(e.message || "Move error");
      push({ title: "Move failed", variant: "error" });
    } finally {
      setLoad(false);
    }
  }

  async function deleteUser(userId: number, deleteFiles: boolean) {
    if (!confirm("Delete this user?")) return;
    setLoad(true);
    setError("");
    try {
      const url =
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users/${userId}` +
        `?delete_files=${deleteFiles}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Delete failed");
      }
      setUsers((p) => p.filter((u) => u.id !== userId));
      push({ title: "User deleted", variant: "success" });
      onChanged();
    } catch (e: any) {
      setError(e.message || "Delete error");
      push({ title: "Delete failed", variant: "error" });
    } finally {
      setLoad(false);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="px-3 py-1.5 rounded bg-theme-500 text-white hover:bg-theme-600">
          View users
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <Dialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-xl shadow-xl",
            "w-[92vw] max-w-3xl max-h-[85vh] overflow-y-auto p-6"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">
              Users in “{group.name}”
            </h3>
            <Dialog.Close asChild>
              <button className="p-2 rounded hover:bg-theme-200/50 dark:hover:bg-theme-800/50">
                <FiX className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded mb-3">
              {error}
            </p>
          )}

          {loading ? (
            <p>Loading…</p>
          ) : users.length === 0 ? (
            <p>No users in this group.</p>
          ) : (
            <Tooltip.Provider delayDuration={100}>
              <ul className="space-y-3">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className={cn(
                      "p-4 rounded-lg border bg-theme-50/20 dark:bg-theme-900/20",
                      "border-theme-200/50 dark:border-theme-800/50",
                      "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    )}
                  >
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">
                        {u.username}
                        {isSuper(u) && (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-theme-300 dark:bg-theme-700">
                            ADMIN
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-theme-600 dark:text-theme-400">
                        {u.email || "(no email)"}
                      </p>
                      <p className="text-sm text-theme-600 dark:text-theme-400">
                        Files:&nbsp;{u.file_count}&nbsp;–&nbsp;
                        <ByteValueTooltip bytes={u.storage_bytes} />
                      </p>
                    </div>

                    {!isSuper(u) && (
                      <div className="flex items-center gap-3">
                        {/* ★ NEW – open file viewer for this user */}
                        <ViewUserFilesDialog
                          userId={u.id}
                          username={u.username}
                          sessionToken={sessionToken}
                        />

                        {/* move user to another group */}
                        <Select.Root
                          value={(u.group?.id ?? "").toString()}
                          onValueChange={(v) => moveUser(u.id, +v)}
                        >
                          <Select.Trigger
                            className={cn(
                              "inline-flex items-center justify-between min-w-[7rem] px-3 py-1.5 rounded border",
                              "border-theme-200 dark:border-theme-700 bg-theme-50 dark:bg-theme-800 text-sm"
                            )}
                          >
                            <Select.Value />
                            <Select.Icon>
                              <BiChevronDown className="h-4 w-4" />
                            </Select.Icon>
                          </Select.Trigger>

                          <Select.Portal>
                            <Select.Content
                              side="bottom"
                              className={cn(
                                "overflow-hidden rounded-lg shadow-lg z-[60]",
                                "bg-theme-50 dark:bg-theme-900 border border-theme-200 dark:border-theme-700"
                              )}
                            >
                              <Select.ScrollUpButton className="flex items-center justify-center py-1">
                                <BiChevronUp />
                              </Select.ScrollUpButton>

                              <Select.Viewport className="max-h-60">
                                {groups.map((g) => (
                                  <Select.Item
                                    key={g.id}
                                    value={g.id.toString()}
                                    className={cn(
                                      "flex items-center px-3 py-2 text-sm cursor-pointer",
                                      "radix-state-checked:bg-theme-200 dark:radix-state-checked:bg-theme-700"
                                    )}
                                  >
                                    <Select.ItemText>{g.name}</Select.ItemText>
                                    <Select.ItemIndicator className="ml-auto">
                                      <BiCheck />
                                    </Select.ItemIndicator>
                                  </Select.Item>
                                ))}
                              </Select.Viewport>

                              <Select.ScrollDownButton className="flex items-center justify-center py-1">
                                <BiChevronDown />
                              </Select.ScrollDownButton>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>

                        {/* delete user */}
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              onClick={() => deleteUser(u.id, false)}
                              className="p-2 rounded bg-red-600 text-white hover:bg-red-700"
                            >
                              <BiTrash className="h-4 w-4" />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="top"
                              sideOffset={4}
                              className="bg-theme-900 text-white px-2 py-1 rounded text-xs"
                            >
                              Delete user
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
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
