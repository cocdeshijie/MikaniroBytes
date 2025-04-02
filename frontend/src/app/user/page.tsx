"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import {
  tokenAtom,
  sessionsAtom,
  loadingAtom,
} from "@/atoms/auth";

interface Session {
  session_id: number;
  token: string;
  created_at: string;
  last_accessed: string;
}

export default function UserPage() {
  const router = useRouter();
  const [token] = useAtom(tokenAtom);        // read-only
  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [loading, setLoading] = useAtom(loadingAtom);

  useEffect(() => {
    if (!token) {
      // No token in store => push to login
      router.replace("/login");
      return;
    }

    async function fetchSessions() {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:8000/auth/sessions", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          throw new Error("Failed to fetch sessions");
        }
        const data: Session[] = await res.json();
        setSessions(data);
      } catch (error) {
        console.error("Fetching sessions error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [router, token, setSessions, setLoading]);

  if (!token) {
    // While the effect tries to reroute, show nothing or a placeholder
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">Loading sessions...</p>
      </div>
    );
  }

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
            {sessions.map((session) => (
              <li
                key={session.session_id}
                className="border-b border-theme-200/50 dark:border-theme-800/50 pb-2"
              >
                <p className="text-theme-700 dark:text-theme-300">
                  <strong>Token:</strong>{" "}
                  <span className="break-all text-sm">{session.token}</span>
                </p>
                <p className="text-sm text-theme-600 dark:text-theme-400">
                  <strong>Created:</strong>{" "}
                  {new Date(session.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-theme-600 dark:text-theme-400">
                  <strong>Last accessed:</strong>{" "}
                  {new Date(session.last_accessed).toLocaleString()}
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
