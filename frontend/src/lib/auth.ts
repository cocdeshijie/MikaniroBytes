import { useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import {
  tokenAtom,
  userInfoAtom,
  isAuthenticatedAtom,
  authLoadedAtom,
} from "@/atoms/auth";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";

const STORAGE_KEY = "mb_token";

/* ------------------------------------------------------------------ */
/*  SINGLE bootstrap guard (module-level, shared by every hook call)  */
/* ------------------------------------------------------------------ */
let bootstrapStarted  = false;
let bootstrapFinished = false;
let bootstrapPromise: Promise<void> | null = null;

/* ------------------------------------------------------------------ */
/*                             useAuth()                              */
/* ------------------------------------------------------------------ */
export function useAuth() {
  const { push }               = useToast();
  const [token, setToken]      = useAtom(tokenAtom);
  const [userInfo, setUser]    = useAtom(userInfoAtom);
  const [isAuthed]             = useAtom(isAuthenticatedAtom);
  const [, setLoaded]          = useAtom(authLoadedAtom);

  /* ================================================================
     1) Initial bootstrap – guaranteed to run **once** per tab
  =================================================================== */
  useEffect(() => {
    /* SSR guard */
    if (typeof window === "undefined") return;

    /* If we already finished bootstrapping => nothing to do */
    if (bootstrapFinished) {
      setLoaded(true);
      return;
    }

    /* If bootstrap not yet started ➜ kick it off */
    if (!bootstrapStarted) {
      bootstrapStarted = true;

      const saved = localStorage.getItem(STORAGE_KEY);

      /* Expose the saved token *immediately* so subsequent hook
         instances don’t spawn their own network call. */
      if (saved) setToken(saved);

      bootstrapPromise = (async () => {
        if (!saved) {
          /* No token stored → done */
          return;
        }

        try {
          const me = await api<{
            id: number;
            username: string;
            email?: string;
            group?: { name: string };
          }>("/auth/me", { token: saved });

          setUser({
            id: me.id,
            username: me.username,
            email: me.email,
            groupName: me.group?.name,
          });
        } catch (err) {
          /* Invalid / expired token */
          localStorage.removeItem(STORAGE_KEY);
          setToken(undefined);
          setUser(null);

          if (
            err instanceof ApiError &&
            (err.status === 401 || err.status === 403)
          ) {
            push({
              title: "Session expired",
              description: "Please log in again.",
              variant: "error",
            });
          }
        }
      })()
        .finally(() => {
          bootstrapFinished = true;
        });
    }

    /* For every hook instance: when bootstrap completes ➜ mark ready */
    bootstrapPromise!
      .finally(() => setLoaded(true));
  }, [setToken, setUser, setLoaded, push]);

  /* ================================================================
     2) Login
  =================================================================== */
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

  /* ================================================================
     3) Logout
  =================================================================== */
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

  /* ---------------------------------------------------------------- */
  return {
    token,
    userInfo,
    isAuthenticated: isAuthed,
    ready:           useAtom(authLoadedAtom)[0],
    login,
    logout,
  };
}
