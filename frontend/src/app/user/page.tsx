"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  userInfoAtom,
  sessionsAtom,
  loadingAtom,
  errorAtom,
  SessionItem,
} from "@/atoms/auth";

export default function UserPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [userInfo, setUserInfo] = useAtom(userInfoAtom);
  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorAtom);

  // Local state for "change password" form:
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // 1) If user is unauthenticated, redirect to /login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  // 2) Once authenticated, load user info and sessions
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) return;

    async function fetchUserInfoAndSessions() {
      setLoading(true);
      setErrorMsg("");

      try {
        // Fetch user info from /auth/me
        const meRes = await fetch("http://localhost:8000/auth/me", {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        });
        if (!meRes.ok) {
          throw new Error("Failed to fetch user info");
        }
        const meData = await meRes.json();
        setUserInfo(meData);

        // Fetch sessions from /auth/sessions
        const sessRes = await fetch("http://localhost:8000/auth/sessions", {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        });
        if (!sessRes.ok) {
          throw new Error("Failed to fetch sessions");
        }
        const sessData: SessionItem[] = await sessRes.json();
        setSessions(sessData);
      } catch (err: any) {
        setErrorMsg(err.message || "Error loading user data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserInfoAndSessions();
  }, [
    status,
    session?.accessToken,
    setLoading,
    setErrorMsg,
    setUserInfo,
    setSessions,
  ]);

  // 3) Handle logout single session
  async function handleLogoutSession(sessionId: number) {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `http://localhost:8000/auth/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      if (!res.ok) {
        throw new Error("Failed to revoke session");
      }
      // Refresh sessions
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (err: any) {
      setErrorMsg(err.message || "Error revoking session");
    } finally {
      setLoading(false);
    }
  }

  // 4) Handle logout ALL sessions
  async function handleLogoutAll() {
    if (!confirm("Are you sure you want to logout from all devices?")) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("http://localhost:8000/auth/logout-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to logout all sessions");
      }
      // Clear local sessions
      setSessions([]);
    } catch (err: any) {
      setErrorMsg(err.message || "Error logging out all sessions");
    } finally {
      setLoading(false);
    }
  }

  // 5) Handle password change
  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("http://localhost:8000/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to change password");
      }
      alert("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "Error changing password");
    } finally {
      setLoading(false);
    }
  }

  // --- RENDER ---

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">Checking session...</p>
      </div>
    );
  }
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">
          Redirecting to login...
        </p>
      </div>
    );
  }

  // If we are loading data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-800 dark:text-theme-200">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-theme-50 dark:bg-theme-950">
      <h1 className="text-2xl font-bold mb-4 text-theme-900 dark:text-theme-100">
        User Dashboard
      </h1>

      {/* Show error if any */}
      {errorMsg && (
        <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">
          {errorMsg}
        </div>
      )}

      {/* Basic User Info */}
      <div className="bg-white dark:bg-theme-900 p-4 rounded shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-2 text-theme-900 dark:text-theme-100">
          Account Information
        </h2>
        {userInfo ? (
          <div className="space-y-2">
            <p className="text-theme-700 dark:text-theme-300">
              <strong>ID:</strong> {userInfo.id}
            </p>
            <p className="text-theme-700 dark:text-theme-300">
              <strong>Username:</strong> {userInfo.username}
            </p>
            <p className="text-theme-700 dark:text-theme-300">
              <strong>Email:</strong> {userInfo.email || "(none)"}
            </p>
          </div>
        ) : (
          <p>No user info loaded.</p>
        )}
      </div>

      {/* Change Password Form */}
      <div className="bg-white dark:bg-theme-900 p-4 rounded shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-2 text-theme-900 dark:text-theme-100">
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-theme-700 dark:text-theme-300">
              Old Password
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-theme-200 rounded dark:bg-theme-800 focus:outline-none"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-theme-700 dark:text-theme-300">
              New Password
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-theme-200 rounded dark:bg-theme-800 focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Update Password
          </button>
        </form>
      </div>

      {/* Active Sessions */}
      <div className="bg-white dark:bg-theme-900 p-4 rounded shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-theme-900 dark:text-theme-100">
            Active Sessions
          </h2>
          <button
            onClick={handleLogoutAll}
            className="py-1 px-3 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout All
          </button>
        </div>
        {sessions.length > 0 ? (
          <ul className="space-y-4">
            {sessions.map((s) => (
              <li
                key={s.session_id}
                className="border-b border-theme-200/50 dark:border-theme-800/50 pb-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-theme-700 dark:text-theme-300">
                      <strong>Token:</strong>{" "}
                      <span className="break-all text-sm">{s.token}</span>
                    </p>
                    <p className="text-sm text-theme-600 dark:text-theme-400">
                      <strong>Device/Browser:</strong>{" "}
                      {s.client_name || "Unknown"}
                    </p>
                    <p className="text-sm text-theme-600 dark:text-theme-400">
                      <strong>IP:</strong> {s.ip_address || "N/A"}
                    </p>
                    <p className="text-sm text-theme-600 dark:text-theme-400">
                      <strong>Created:</strong>{" "}
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-theme-600 dark:text-theme-400">
                      <strong>Last accessed:</strong>{" "}
                      {new Date(s.last_accessed).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLogoutSession(s.session_id)}
                    className="py-1 px-3 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    Logout
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-theme-600 dark:text-theme-300">
            No active sessions.
          </p>
        )}
      </div>
    </div>
  );
}
