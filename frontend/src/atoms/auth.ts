import { atom } from "jotai";

/**
 * Login form fields
 */
export const usernameAtom = atom("");
export const passwordAtom = atom("");

/**
 * Auth state
 */
export const tokenAtom = atom<string | null>(null);

/**
 * Error handling
 */
export const loginErrorAtom = atom("");

/**
 * Track user sessions (array of sessions from the backend)
 */
export const sessionsAtom = atom<any[]>([]); // or a custom type

/**
 * A basic loading indicator for user data
 */
export const loadingAtom = atom<boolean>(true);

