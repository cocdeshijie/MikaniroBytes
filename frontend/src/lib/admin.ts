import { api } from "./api";
import type { GroupItem } from "@/types/sharedTypes";

/* ---------- local narrow types (only what admin pages need) -------- */
export interface UserItem {
  id: number;
  username: string;
  email?: string | null;
  group: { id: number; name: string } | null;
  file_count: number;
  storage_bytes: number;
}

/* ------------------------------------------------------------------ */
/*                             GROUPS                                 */
/* ------------------------------------------------------------------ */

export async function getGroups(token?: string): Promise<GroupItem[]> {
  return api<GroupItem[]>("/admin/groups", { token });
}

export async function createGroup(
  payload: Partial<GroupItem>,
  token?: string,
): Promise<GroupItem> {
  return api<GroupItem>("/admin/groups", { method: "POST", token, json: payload });
}

export async function updateGroup(
  id: number,
  payload: Partial<GroupItem>,
  token?: string,
): Promise<GroupItem> {
  return api<GroupItem>(`/admin/groups/${id}`, { method: "PUT", token, json: payload });
}

export async function deleteGroup(
  id: number,
  deleteFiles: boolean,
  token?: string,
): Promise<void> {
  await api(`/admin/groups/${id}?delete_files=${deleteFiles}`, { method: "DELETE", token });
}

/* ------------------------------------------------------------------ */
/*                              USERS                                 */
/* ------------------------------------------------------------------ */

export async function getUsers(token?: string, groupId?: number): Promise<UserItem[]> {
  const qs = groupId ? `?group_id=${groupId}` : "";
  return api<UserItem[]>(`/admin/users${qs}`, { token });
}

export async function updateUserGroup(
  userId: number,
  newGroupId: number,
  token?: string,
): Promise<UserItem> {
  return api<UserItem>(`/admin/users/${userId}/group`, {
    method: "PUT",
    token,
    json: { group_id: newGroupId },
  });
}

export async function deleteUser(
  userId: number,
  deleteFiles: boolean,
  token?: string,
): Promise<void> {
  await api(`/admin/users/${userId}?delete_files=${deleteFiles}`, {
    method: "DELETE",
    token,
  });
}
