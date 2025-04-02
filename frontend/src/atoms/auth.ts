import { atom } from "jotai";

/** Basic user info retrieved from /auth/me */
export interface UserInfo {
  id: number;
  username: string;
  email?: string;
}

export const userInfoAtom = atom<UserInfo | null>(null);

export interface SessionItem {
  session_id: number;
  token: string;
  ip_address?: string;
  client_name?: string;
  created_at: string;
  last_accessed: string;
}

export const sessionsAtom = atom<SessionItem[]>([]);

export const loadingAtom = atom<boolean>(false);
export const errorAtom = atom<string>("");

