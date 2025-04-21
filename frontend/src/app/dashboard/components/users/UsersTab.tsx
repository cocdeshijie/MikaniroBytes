"use client";

import { atom, useAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import * as Select from "@radix-ui/react-select";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  BiChevronDown,
  BiChevronUp,
  BiCheck,
  BiTrash,
} from "react-icons/bi";
import { cn } from "@/utils/cn";
import { ByteValueTooltip } from "../groups/ByteValueTooltip";
import { useToast } from "@/providers/toast-provider";
import ViewUserFilesDialog from "./ViewUserFilesDialog";

/* ---------- Types shared with backend ---------- */
interface GroupItem {
  id: number;
  name: string;
}

interface UserItem {
  id: number;
  username: string;
  email?: string | null;
  group: { id: number; name: string } | null;
  file_count: number;
  storage_bytes: number;
}

/* ---------- Local atoms ---------- */
const loadingAtom = atom(false);
const errorMsgAtom = atom("");
const usersAtom = atom<UserItem[]>([]);
const groupsAtom = atom<GroupItem[]>([]);
const hasFetchedAtom = atom(false);

/* ---------- helpers ---------- */
const EXCLUDE = ["SUPER_ADMIN", "GUEST"]; // ← filter out special groups

export default function UsersTab() {
  const { data: session } = useSession();
  const { push } = useToast(); // ★ NEW

  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);
  const [users, setUsers] = useAtom(usersAtom);
  const [groups, setGroups] = useAtom(groupsAtom);
  const [hasFetched, setHasFetched] = useAtom(hasFetchedAtom);

  /* ---------- initial fetch ---------- */
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!hasFetched) {
      fetchAll();
      setHasFetched(true);
    }
    // eslint‑disable‑next‑line react-hooks/exhaustive-deps
  }, [session?.accessToken, hasFetched]);

  async function fetchAll() {
    setLoading(true);
    setErrorMsg("");
    try {
      /* 1) Users */
      let res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users`,
        {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch users");
      }
      const userData: UserItem[] = await res.json();
      setUsers(userData);

      /* 2) Groups  (filter out SUPER_ADMIN & GUEST) */
      res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch groups");
      }
      const groupData: any[] = await res.json();
      setGroups(
        groupData
          .filter((g) => !EXCLUDE.includes(g.name))
          .map(({ id, name }) => ({ id, name }))
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- handlers ---------- */
  async function handleGroupChange(userId: number, newGroupId: number) {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users/${userId}/group`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ group_id: newGroupId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to update group");
      }
      const updated: UserItem = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      push({
        title: "Group updated",
        description: updated.username,
        variant: "success",
      }); // ★
    } catch (err: any) {
      setErrorMsg(err.message || "Error updating group");
      push({ title: "Update failed", variant: "error" }); // ★
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(
    userId: number,
    deleteFiles: boolean,
    close: () => void
  ) {
    setLoading(true);
    setErrorMsg("");
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users/${userId}?delete_files=${deleteFiles}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to delete user");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      push({ title: "User deleted", variant: "success" }); // ★
      close();
    } catch (err: any) {
      setErrorMsg(err.message || "Error deleting user");
      push({ title: "Delete failed", variant: "error" }); // ★
    } finally {
      setLoading(false);
    }
  }

  /* ---------- helpers ---------- */
  function isSuperAdmin(user: UserItem) {
    return user.group?.name === "SUPER_ADMIN";
  }

  /* ---------- render ---------- */
  return (
    <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
      <div
        className={cn(
          "p-4 bg-theme-100/25 dark:bg-theme-900/25",
          "rounded-lg border border-theme-200/50 dark:border-theme-800/50"
        )}
      >
        <h3 className="text-lg font-medium text-theme-700 dark:text-theme-300 mb-2">
          Users Management
        </h3>
        <p className="text-sm text-theme-500 dark:text-theme-400 mb-4">
          View all accounts, change groups (except SUPER_ADMIN & GUEST), or
          remove users.
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

        {loading ? (
          <p className="text-theme-600 dark:text-theme-400">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-theme-600 dark:text-theme-400">No users found.</p>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => (
              <li
                key={u.id}
                className={cn(
                  "p-4 rounded-lg border",
                  "border-theme-200/50 dark:border-theme-800/50",
                  "bg-theme-50/20 dark:bg-theme-900/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                )}
              >
                {/* LEFT block */}
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-theme-800 dark:text-theme-200">
                    {u.username}
                    {isSuperAdmin(u) && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-theme-300 dark:bg-theme-700 text-theme-900 dark:text-theme-100">
                        ADMIN
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-theme-600 dark:text-theme-400">
                    {u.email || "(no email)"}
                  </p>
                  <p className="text-sm text-theme-600 dark:text-theme-400">
                    Files:&nbsp;
                    {u.file_count} –&nbsp;
                    <ByteValueTooltip bytes={u.storage_bytes} />
                  </p>
                </div>

                {/* RIGHT controls */}
                <div className="flex items-center gap-3">
                  {!isSuperAdmin(u) && (
                    <ViewUserFilesDialog
                      userId={u.id}
                      username={u.username}
                      sessionToken={session?.accessToken || ""}
                    />
                  )}
                  {/* Group select */}
                  {isSuperAdmin(u) ? (
                    <span className="text-theme-700 dark:text-theme-300 text-sm">
                      {u.group?.name}
                    </span>
                  ) : (
                    <Select.Root
                      value={(u.group?.id ?? "").toString()}
                      onValueChange={(val: string) =>
                        handleGroupChange(u.id, parseInt(val, 10))
                      }
                    >
                      <Select.Trigger
                        className={cn(
                          "inline-flex items-center justify-between min-w-[7rem] px-3 py-1.5 rounded border",
                          "border-theme-200 dark:border-theme-700",
                          "bg-theme-50 dark:bg-theme-800",
                          "text-theme-900 dark:text-theme-100 text-sm",
                          "focus:outline-none"
                        )}
                      >
                        <Select.Value />
                        <Select.Icon>
                          <BiChevronDown className="h-4 w-4 text-theme-500" />
                        </Select.Icon>
                      </Select.Trigger>

                      <Select.Portal>
                        <Select.Content
                          side="bottom"
                          className={cn(
                            "overflow-hidden rounded-lg shadow-lg z-50",
                            "bg-theme-50 dark:bg-theme-900",
                            "border border-theme-200 dark:border-theme-700"
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
                                  "flex items-center px-3 py-2 text-sm select-none cursor-pointer",
                                  "text-theme-700 dark:text-theme-300",
                                  "radix-state-checked:bg-theme-200 dark:radix-state-checked:bg-theme-700",
                                  "hover:bg-theme-100 dark:hover:bg-theme-800"
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
                  )}

                  {/* Delete user */}
                  {!isSuperAdmin(u) && (
                    <DeleteUserButton
                      user={u}
                      onDelete={(deleteFiles, close) =>
                        handleDeleteUser(u.id, deleteFiles, close)
                      }
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Tooltip.Provider>
  );
}

/* ---------- helper: delete button component ---------- */
function DeleteUserButton({
  user,
  onDelete,
}: {
  user: UserItem;
  onDelete: (deleteFiles: boolean, close: () => void) => void;
}) {
  const [deleteFiles, setDeleteFiles] = useAtom(useMemo(() => atom(false), []));
  const [open, setOpen] = useAtom(useMemo(() => atom(false), []));

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          className={cn(
            "p-2 rounded bg-red-600 text-white hover:bg-red-700",
            "transition"
          )}
        >
          <BiTrash className="h-4 w-4" />
        </button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-black/30 backdrop-blur-sm fixed inset-0 z-50" />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6"
          )}
        >
          <AlertDialog.Title className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
            Delete user “{user.username}”?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-theme-600 dark:text-theme-300 mb-4">
            This action cannot be undone.
          </AlertDialog.Description>

          <div className="mb-4 flex items-center space-x-2">
            <input
              id={`del_${user.id}`}
              type="checkbox"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="cursor-pointer"
            />
            <label
              htmlFor={`del_${user.id}`}
              className="text-sm text-theme-700 dark:text-theme-200 cursor-pointer"
            >
              Also delete all uploaded files?
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                className={cn(
                  "px-4 py-2 rounded border",
                  "border-theme-300 dark:border-theme-700 text-theme-700 dark:text-theme-200",
                  "bg-theme-200/50 dark:bg-theme-800/50 hover:bg-theme-200 dark:hover:bg-theme-800",
                )}
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={() => onDelete(deleteFiles, () => setOpen(false))}
                className={cn(
                  "px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700",
                )}
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
