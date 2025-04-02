import { atom } from "jotai";

/**
 * Login form fields
 */
export const usernameAtom = atom("");
export const passwordAtom = atom("");

/**
 * Auth state
 */
const baseTokenAtom = atom<string | null>(null);
export const tokenAtom = atom(
  // READ
  (get) => {
    // If baseTokenAtom is null, see if localStorage has a saved token
    const currentValue = get(baseTokenAtom);
    if (currentValue === null && typeof window !== "undefined") {
      const stored = localStorage.getItem("token");
      return stored ?? null;
    }
    return currentValue;
  },

  // WRITE
  (get, set, newToken: string | null) => {
    // Update the in-memory atom
    set(baseTokenAtom, newToken);

    // Also update localStorage
    if (typeof window !== "undefined") {
      if (newToken) {
        localStorage.setItem("token", newToken);
      } else {
        localStorage.removeItem("token");
      }
    }
  }
);

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

