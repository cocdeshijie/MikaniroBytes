import { atom } from "jotai";

/* ---------- minimal user-info shape ---------- */
export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  groupName?: string;
}

/* ---------- session-level atoms -------------- */
export const userInfoAtom = atom<UserInfo | null>(null);

/**
 * Holds the backend JWT while the tab is open.
 * – undefined  → logged out / not yet fetched
 * – string     → valid token
 *
 * The actual persistence (localStorage) is handled in `useAuth()`.
 */
export const tokenAtom = atom<string | undefined>(undefined);

/* handy derived flag */
export const isAuthenticatedAtom = atom((get) => Boolean(get(tokenAtom)));
