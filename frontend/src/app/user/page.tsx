"use client";

import { FormEvent, useEffect } from "react";
import { atom, useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/utils/cn";
import {
  userInfoAtom,
  sessionsAtom,
  loadingAtom,
  errorAtom,
  SessionItem,
} from "@/atoms/auth";

// Atoms for "change password" form
const oldPasswordAtom = atom("");
const newPasswordAtom = atom("");

export default function UserPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [userInfo, setUserInfo] = useAtom(userInfoAtom);
  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorAtom);
  const [oldPassword, setOldPassword] = useAtom(oldPasswordAtom);
  const [newPassword, setNewPassword] = useAtom(newPasswordAtom);

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

  // Loading states with styling similar to the blog
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <div className={cn(
          "relative p-6 md:p-8 rounded-xl",
          "bg-theme-100/75 dark:bg-theme-900/75",
          "backdrop-blur-lg",
          "ring-1 ring-theme-200/50 dark:ring-theme-700/50",
          "shadow-lg shadow-theme-500/10",
          "max-w-md w-full"
        )}>
          <p className="text-theme-800 dark:text-theme-200 text-center text-lg">
            {status === "loading" ? "Checking session..." : "Loading user data..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <div className={cn(
          "relative p-6 md:p-8 rounded-xl",
          "bg-theme-100/75 dark:bg-theme-900/75",
          "backdrop-blur-lg",
          "ring-1 ring-theme-200/50 dark:ring-theme-700/50",
          "shadow-lg shadow-theme-500/10",
          "max-w-md w-full"
        )}>
          <p className="text-theme-800 dark:text-theme-200 text-center text-lg">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Top section with heading - similar to the blog post headers */}
      <div className={cn(
        "relative pt-24 pb-6 md:pt-28 md:pb-8",
        "bg-gradient-to-br",
        "from-theme-500/15 via-theme-100/25 to-theme-300/15",
        "dark:from-theme-500/15 dark:via-theme-900/25 dark:to-theme-700/15"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={cn(
            "relative rounded-xl overflow-hidden backdrop-blur-sm",
            "border border-theme-200/25 dark:border-theme-700/25",
            "shadow-lg shadow-theme-500/10",
            "p-6 md:p-8"
          )}>
            <h1 className={cn(
              "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold",
              "text-theme-950 dark:text-theme-50",
              "mb-4 leading-tight"
            )}>
              User Dashboard
            </h1>

            {/* Show error if any */}
            {errorMsg && (
              <div className={cn(
                "bg-red-100/80 dark:bg-red-900/30",
                "text-red-700 dark:text-red-300",
                "p-3 my-4 rounded-lg",
                "border border-red-200 dark:border-red-800",
                "backdrop-blur-sm"
              )}>
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content section - styled like blog content */}
      <section className="relative bg-theme-50 dark:bg-theme-950">
        <div className={cn(
          "hidden md:block absolute inset-0",
          "bg-theme-100 dark:bg-theme-900",
          "opacity-20"
        )}/>

        <div className={cn(
          "relative py-6",
          "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        )}>
          <div className="md:grid md:grid-cols-12 md:gap-6">
            {/* User info and password in a column */}
            <div className="md:col-span-4 space-y-6 mb-6 md:mb-0">
              {/* Basic User Info */}
              <div className={cn(
                "rounded-xl overflow-hidden",
                "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                "bg-theme-50 dark:bg-theme-950",
                "shadow-md shadow-theme-500/5"
              )}>
                <div className="p-5">
                  <h2 className={cn(
                    "text-xl font-semibold mb-4",
                    "text-theme-900 dark:text-theme-100",
                    "border-b border-theme-200 dark:border-theme-800 pb-2"
                  )}>
                    Account Information
                  </h2>
                  {userInfo ? (
                    <div className="space-y-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm text-theme-500 dark:text-theme-400">User ID</span>
                        <p className="text-theme-700 dark:text-theme-300 font-medium">
                          {userInfo.id}
                        </p>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm text-theme-500 dark:text-theme-400">Username</span>
                        <p className="text-theme-700 dark:text-theme-300 font-medium">
                          {userInfo.username}
                        </p>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm text-theme-500 dark:text-theme-400">Email</span>
                        <p className="text-theme-700 dark:text-theme-300 font-medium">
                          {userInfo.email || "(none)"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-theme-600 dark:text-theme-400 italic">
                      No user information available.
                    </p>
                  )}
                </div>
              </div>

              {/* Change Password Form */}
              <div className={cn(
                "rounded-xl overflow-hidden",
                "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                "bg-theme-50 dark:bg-theme-950",
                "shadow-md shadow-theme-500/5"
              )}>
                <div className="p-5">
                  <h2 className={cn(
                    "text-xl font-semibold mb-4",
                    "text-theme-900 dark:text-theme-100",
                    "border-b border-theme-200 dark:border-theme-800 pb-2"
                  )}>
                    Change Password
                  </h2>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-theme-700 dark:text-theme-300">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className={cn(
                          "w-full px-4 py-2 rounded-lg",
                          "bg-theme-100/50 dark:bg-theme-800/50",
                          "border border-theme-200 dark:border-theme-700",
                          "focus:ring-2 focus:ring-theme-500/50 focus:outline-none",
                          "text-theme-900 dark:text-theme-100"
                        )}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-theme-700 dark:text-theme-300">
                        New Password
                      </label>
                      <input
                        type="password"
                        className={cn(
                          "w-full px-4 py-2 rounded-lg",
                          "bg-theme-100/50 dark:bg-theme-800/50",
                          "border border-theme-200 dark:border-theme-700",
                          "focus:ring-2 focus:ring-theme-500/50 focus:outline-none",
                          "text-theme-900 dark:text-theme-100"
                        )}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className={cn(
                        "w-full py-2 px-6 rounded-lg",
                        "bg-theme-500 hover:bg-theme-600",
                        "text-white font-medium",
                        "shadow-md shadow-theme-500/20",
                        "transition-all duration-200 transform hover:-translate-y-0.5"
                      )}
                    >
                      Update Password
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Active Sessions - wider column */}
            <div className="md:col-span-8">
              <div className={cn(
                "rounded-xl overflow-hidden",
                "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                "bg-theme-50 dark:bg-theme-950",
                "shadow-md shadow-theme-500/5",
                "h-full"
              )}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={cn(
                      "text-xl font-semibold",
                      "text-theme-900 dark:text-theme-100"
                    )}>
                      Active Sessions
                    </h2>
                    <button
                      onClick={handleLogoutAll}
                      className={cn(
                        "py-1.5 px-4 rounded-lg",
                        "bg-red-500 hover:bg-red-600",
                        "text-white text-sm font-medium",
                        "shadow-md shadow-red-500/20",
                        "transition-all duration-200"
                      )}
                    >
                      Logout All Devices
                    </button>
                  </div>

                  <div className="border-b border-theme-200 dark:border-theme-800 mb-4"></div>

                  {sessions.length > 0 ? (
                    <ul className="space-y-4">
                      {sessions.map((s) => (
                        <li
                          key={s.session_id}
                          className={cn(
                            "border border-theme-200/50 dark:border-theme-800/50 rounded-lg",
                            "p-4 bg-theme-100/25 dark:bg-theme-900/25",
                            "transition-all duration-200 hover:shadow-md"
                          )}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-col">
                                <span className="text-sm text-theme-500 dark:text-theme-400">Token</span>
                                <p className="text-theme-700 dark:text-theme-300 text-sm font-mono overflow-hidden text-ellipsis">
                                  {s.token.length > 20 ? s.token.substring(0, 20) + '...' : s.token}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                <div>
                                  <span className="text-sm text-theme-500 dark:text-theme-400">Device</span>
                                  <p className="text-theme-700 dark:text-theme-300">
                                    {s.client_name || "Unknown"}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-sm text-theme-500 dark:text-theme-400">IP Address</span>
                                  <p className="text-theme-700 dark:text-theme-300">
                                    {s.ip_address || "N/A"}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-sm text-theme-500 dark:text-theme-400">Created</span>
                                  <p className="text-theme-700 dark:text-theme-300">
                                    {new Date(s.created_at).toLocaleString()}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-sm text-theme-500 dark:text-theme-400">Last Access</span>
                                  <p className="text-theme-700 dark:text-theme-300">
                                    {new Date(s.last_accessed).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="md:self-center">
                              <button
                                onClick={() => handleLogoutSession(s.session_id)}
                                className={cn(
                                  "py-1.5 px-4 rounded-lg",
                                  "bg-red-500/80 hover:bg-red-600",
                                  "text-white text-sm font-medium",
                                  "shadow hover:shadow-md shadow-red-500/10",
                                  "transition-all duration-200"
                                )}
                              >
                                Logout
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={cn(
                      "text-center py-8",
                      "bg-theme-100/25 dark:bg-theme-900/25",
                      "border border-theme-200/50 dark:border-theme-800/50 rounded-lg"
                    )}>
                      <p className="text-theme-600 dark:text-theme-400">
                        No active sessions found.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}