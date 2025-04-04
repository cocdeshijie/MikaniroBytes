"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";
import MyImagesTab from "./components/MyImagesTab";
import SiteSettingsTab from "./components/SiteSettingsTab";

// Dashboard tabs
const mainTabAtom = atom<"my-images" | "site-settings">("my-images");
const siteSubTabAtom = atom<"groups" | "users" | "configs">("groups");

// Are we a SUPER_ADMIN or not?
const isAdminAtom = atom<boolean>(false);

// Optional: store error state for the whole page
const pageErrorAtom = atom<string>("");

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mainTab, setMainTab] = useAtom(mainTabAtom);
  const [siteSubTab, setSiteSubTab] = useAtom(siteSubTabAtom);
  const [isAdmin, setIsAdmin] = useAtom(isAdminAtom);
  const [pageError, setPageError] = useAtom(pageErrorAtom);

  // If unauth => redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  // On mount, fetch /auth/me to see if SUPER_ADMIN
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) return;

    async function checkIfAdmin() {
      try {
        setPageError("");
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`,
          {
            headers: { Authorization: `Bearer ${session?.accessToken}` },
          }
        );
        if (!res.ok) {
          throw new Error("Failed to load user info");
        }
        const data = await res.json();
        setIsAdmin(data.group?.name === "SUPER_ADMIN");
      } catch (err: any) {
        setPageError(err.message || "Error checking admin status");
      }
    }
    checkIfAdmin();
  }, [status, session?.accessToken, setIsAdmin, setPageError]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-lg text-theme-700 dark:text-theme-300">
          Checking session...
        </p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-lg text-theme-700 dark:text-theme-300">
          Redirecting to login...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Example header styling, gradient, etc. */}
      <div
        className={cn(
          "relative pt-24 pb-6 md:pt-28 md:pb-8",
          "bg-gradient-to-br",
          "from-theme-500/15 via-theme-100/25 to-theme-300/15",
          "dark:from-theme-500/15 dark:via-theme-900/25 dark:to-theme-700/15"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={cn(
              "relative rounded-xl overflow-hidden backdrop-blur-sm",
              "border border-theme-200/25 dark:border-theme-700/25",
              "shadow-lg shadow-theme-500/10",
              "p-6 md:p-8"
            )}
          >
            <h1
              className={cn(
                "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold",
                "text-theme-950 dark:text-theme-50",
                "mb-4 leading-tight"
              )}
            >
              Dashboard
            </h1>
            {pageError && (
              <div
                className={cn(
                  "bg-red-100/80 dark:bg-red-900/30",
                  "text-red-700 dark:text-red-300",
                  "p-3 my-4 rounded-lg",
                  "border border-red-200 dark:border-red-800",
                  "backdrop-blur-sm"
                )}
              >
                {pageError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <section className="relative bg-theme-50 dark:bg-theme-950">
        <div
          className={cn(
            "hidden md:block absolute inset-0",
            "bg-theme-100 dark:bg-theme-900",
            "opacity-20"
          )}
        />
        <div
          className={cn(
            "relative py-6",
            "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          )}
        >
          <div className="md:grid md:grid-cols-12 md:gap-6">
            {/* LEFT COLUMN: Nav */}
            <div className="md:col-span-4 space-y-6 mb-6 md:mb-0">
              <div
                className={cn(
                  "rounded-xl overflow-hidden",
                  "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                  "bg-theme-50 dark:bg-theme-950",
                  "shadow-md shadow-theme-500/5 p-5"
                )}
              >
                {/* -- Mobile dropdown (optional) -- */}
                <div className="md:hidden mb-4">
                  <label className="block text-sm font-medium text-theme-700 dark:text-theme-300">
                    Main Tab
                  </label>
                  <select
                    className={cn(
                      "w-full mt-1 p-2 border border-theme-200 dark:border-theme-700",
                      "rounded bg-theme-50 dark:bg-theme-800 text-theme-700 dark:text-theme-200"
                    )}
                    value={mainTab}
                    onChange={(e) =>
                      setMainTab(e.target.value as "my-images" | "site-settings")
                    }
                  >
                    <option value="my-images">My Images</option>
                    {isAdmin && <option value="site-settings">Site Settings</option>}
                  </select>

                  {isAdmin && mainTab === "site-settings" && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-theme-700 dark:text-theme-300">
                        Sub-Tab
                      </label>
                      <select
                        className={cn(
                          "w-full mt-1 p-2 border border-theme-200 dark:border-theme-700",
                          "rounded bg-theme-50 dark:bg-theme-800 text-theme-700 dark:text-theme-200"
                        )}
                        value={siteSubTab}
                        onChange={(e) =>
                          setSiteSubTab(
                            e.target.value as "groups" | "users" | "configs"
                          )
                        }
                      >
                        <option value="groups">Groups</option>
                        <option value="users">Users</option>
                        <option value="configs">Configs</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Desktop nav buttons */}
                <div className="hidden md:block">
                  <button
                    onClick={() => setMainTab("my-images")}
                    className={cn(
                      "block w-full text-left px-3 py-2 rounded mb-2",
                      mainTab === "my-images"
                        ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
                        : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                    )}
                  >
                    My Images
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setMainTab("site-settings")}
                      className={cn(
                        "block w-full text-left px-3 py-2 rounded",
                        mainTab === "site-settings"
                          ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
                          : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                      )}
                    >
                      Site Settings
                    </button>
                  )}

                  {isAdmin && mainTab === "site-settings" && (
                    <div className="mt-4 ml-4 border-l-2 border-theme-300 dark:border-theme-700 pl-2 space-y-2">
                      <button
                        onClick={() => setSiteSubTab("groups")}
                        className={cn(
                          "block w-full text-left px-2 py-1 rounded",
                          siteSubTab === "groups"
                            ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
                            : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                        )}
                      >
                        Groups
                      </button>
                      <button
                        onClick={() => setSiteSubTab("users")}
                        className={cn(
                          "block w-full text-left px-2 py-1 rounded",
                          siteSubTab === "users"
                            ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
                            : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                        )}
                      >
                        Users
                      </button>
                      <button
                        onClick={() => setSiteSubTab("configs")}
                        className={cn(
                          "block w-full text-left px-2 py-1 rounded",
                          siteSubTab === "configs"
                            ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
                            : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                        )}
                      >
                        Configs
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: content */}
            <div className="md:col-span-8">
              <div
                className={cn(
                  "rounded-xl overflow-hidden",
                  "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                  "bg-theme-50 dark:bg-theme-950",
                  "shadow-md shadow-theme-500/5",
                  "h-full"
                )}
              >
                <div className="p-5">
                  {mainTab === "my-images" && <MyImagesTab />}
                  {isAdmin && mainTab === "site-settings" && (
                    <SiteSettingsTab currentSubTab={siteSubTab} />
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
