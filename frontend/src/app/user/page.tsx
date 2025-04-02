"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { useSession } from "next-auth/react";
import { sessionsAtom, loadingAtom } from "@/atoms/auth";

interface SessionItem {
  session_id: number;
  token: string;
  created_at: string;
  last_accessed: string;
}

export default function UserPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  // status is "loading" | "authenticated" | "unauthenticated"

  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [loading, setLoading] = useAtom(loadingAtom);

  // 1) If user is unauthenticated, redirect to /login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    // We do NOT do anything if status === "loading"
    // or status === "authenticated"
  }, [status, router]);

  // 2) If user is authenticated, fetch sessions
  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    // If we somehow have no accessToken, bail out (edge case)
    if (!session?.accessToken) {
      return;
    }

    setLoading(true);

    async function fetchSessions() {
      try {
        const res = await fetch("http://localhost:8000/auth/sessions", {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        });
        if (!res.ok) {
          throw new Error("Failed to fetch sessions");
        }
        const data: SessionItem[] = await res.json();
        setSessions(data);
      } catch (error) {
        console.error("Fetching sessions error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [status, session?.accessToken, setLoading, setSessions]);

  // ---- RENDER PHASE ----
  // status === "loading" => NextAuth is still checking tokens
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">Checking session...</p>
      </div>
    );
  }

  // status === "unauthenticated" => We trigger redirect in useEffect,
  // but we can show a quick placeholder here:
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">Redirecting to login...</p>
      </div>
    );
  }

  // status === "authenticated" but we haven't finished fetching sessions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">Loading sessions...</p>
      </div>
    );
  }

  // Finally, render user dashboard
  return (
    <div className="min-h-screen p-4 bg-theme-50 dark:bg-theme-950">
      <h1 className="text-2xl font-bold mb-4 text-theme-900 dark:text-theme-100">
        User Dashboard
      </h1>

      <div className="bg-white dark:bg-theme-900 p-4 rounded shadow-md">
        <h2 className="text-lg font-semibold mb-2 text-theme-900 dark:text-theme-100">
          Active Sessions
        </h2>
        {sessions.length > 0 ? (
          <ul className="space-y-4">
            {sessions.map((s) => (
              <li
                key={s.session_id}
                className="border-b border-theme-200/50 dark:border-theme-800/50 pb-2"
              >
                <p className="text-theme-700 dark:text-theme-300">
                  <strong>Token:</strong>{" "}
                  <span className="break-all text-sm">{s.token}</span>
                </p>
                <p className="text-sm text-theme-600 dark:text-theme-400">
                  <strong>Created:</strong>{" "}
                  {new Date(s.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-theme-600 dark:text-theme-400">
                  <strong>Last accessed:</strong>{" "}
                  {new Date(s.last_accessed).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-theme-600 dark:text-theme-300">No active sessions.</p>
        )}
      </div>
    </div>
  );
}
