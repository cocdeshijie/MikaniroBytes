import { atom } from "jotai";

/** Error handling if needed */
export const loginErrorAtom = atom<string>("");

/**
 * Track user sessions (array of sessions from the backend)
 */
export const sessionsAtom = atom<any[]>([]);

/**
 * A basic loading indicator for user data
 */
export const loadingAtom = atom<boolean>(true);
