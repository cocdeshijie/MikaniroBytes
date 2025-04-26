import { atom } from "jotai";

/* ---------- minimal user-info ---------- */
export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  groupName?: string;
}

/* ---------- session ---------- */
const STORAGE_KEY = "mb_token";

/**
 * Hold the JWT token while the tab is open.
 * Initial value is synchronised with localStorage
 * so that pages rendered after a hard-refresh can
 * already see a tentative token.
 */
export const tokenAtom = atom<string | undefined>(undefined);

/** simple helper */
export const isAuthenticatedAtom = atom((get) => Boolean(get(tokenAtom)));

/** user info (populated by useAuth) */
export const userInfoAtom = atom<UserInfo | null>(null);

/**
 * `true`  – we have finished the 1st re-hydration attempt
 * `false` – still checking localStorage / /auth/me
 */
export const authLoadedAtom = atom(false);
