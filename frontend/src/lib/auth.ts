import { useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import {
  tokenAtom,
  userInfoAtom,
  isAuthenticatedAtom,
  authLoadedAtom,
} from "@/atoms/auth";
import { api } from "@/lib/api";

const STORAGE_KEY = "mb_token";

/* ------------------------------------------------------------------ */
/*                             useAuth()                              */
/* ------------------------------------------------------------------ */
export function useAuth() {
  const [token,      setToken]   = useAtom(tokenAtom);
  const [userInfo,   setUser]    = useAtom(userInfoAtom);
  const [isAuthed]               = useAtom(isAuthenticatedAtom);
  const [,             setLoaded] = useAtom(authLoadedAtom);      // NEW

  /* ---------- 1) first run: try localStorage token ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (token !== undefined) {             // we already know (either null or jwt)
      setLoaded(true);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setLoaded(true);                      // nothing to do
      return;
    }

    (async () => {
      try {
        const me = await api<{
          id: number;
          username: string;
          email?: string;
          group?: { name: string };
        }>("/auth/me", { token: saved });

        setToken(saved);
        setUser({
          id: me.id,
          username: me.username,
          email: me.email,
          groupName: me.group?.name,
        });
      } finally {
        setLoaded(true);                    // whatever the result -> we're done
      }
    })();
  }, [token, setToken, setUser, setLoaded]);

  /* ---------- 2) login ---------- */
  const login = useCallback(
    async (username: string, password: string) => {
      const { access_token } = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        json: { username, password },
      });

      localStorage.setItem(STORAGE_KEY, access_token);
      setToken(access_token);

      const me = await api<{
        id: number;
        username: string;
        email?: string;
        group?: { name: string };
      }>("/auth/me", { token: access_token });

      setUser({
        id: me.id,
        username: me.username,
        email: me.email,
        groupName: me.group?.name,
      });
    },
    [setToken, setUser],
  );

  /* ---------- 3) logout ---------- */
  const logout = useCallback(async () => {
    try {
      if (token) {
        await api("/auth/logout", { method: "POST", token, json: { token } });
      }
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setToken(undefined);
      setUser(null);
    }
  }, [token, setToken, setUser]);

  /* ---------- public API ---------- */
  return {
    token,
    userInfo,
    isAuthenticated: isAuthed,
    ready:           useAtom(authLoadedAtom)[0],   // expose the flag
    login,
    logout,
  };
}
