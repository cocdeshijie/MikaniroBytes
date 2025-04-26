import { useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import {
  tokenAtom,
  userInfoAtom,
  isAuthenticatedAtom,
} from "@/atoms/auth";
import { api } from "@/lib/api";

const STORAGE_KEY = "mb_token";

/* ------------------------------------------------------------------ */
/*  Hook that wires together login / logout / re-hydration            */
/* ------------------------------------------------------------------ */
export function useAuth() {
  const [token,      setToken]   = useAtom(tokenAtom);
  const [userInfo,   setUser]    = useAtom(userInfoAtom);
  const [isAuthed]               = useAtom(isAuthenticatedAtom);

  /* ① ─ Re-hydrate once after hard-refresh -------------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (token) return;                       // already initialised

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

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
      } catch {
        localStorage.removeItem(STORAGE_KEY); // stale token – drop it silently
      }
    })();
  }, [token, setToken, setUser]);

  /* ② ─ Login ------------------------------------------------------------- */
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

  /* ③ ─ Logout ------------------------------------------------------------ */
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

  /* ④ ─ public API -------------------------------------------------------- */
  return {
    token,
    userInfo,
    isAuthenticated: isAuthed,
    login,
    logout,
  };
}
