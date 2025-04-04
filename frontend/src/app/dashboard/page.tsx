"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";

// Main tab: either "my-images" or "site-settings"
const mainTabAtom = atom<"my-images" | "site-settings">("my-images");

// Sub-tab for site settings: "groups", "users", or "configs"
const siteSubTabAtom = atom<"groups" | "users" | "configs">("groups");

// Flag if user is admin
const isAdminAtom = atom<boolean>(false);

// Optional: store error/ loading states
const loadingAtom = atom<boolean>(false);
const errorAtom = atom<string>("");

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useAtom(isAdminAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorAtom);

  const [mainTab, setMainTab] = useAtom(mainTabAtom);
  const [siteSubTab, setSiteSubTab] = useAtom(siteSubTabAtom);

  // If unauthenticated => redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  // On mount (or whenever the token changes), fetch user info to check admin
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) return;

    async function fetchUserGroup() {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load user info");
        const data = await res.json();

        // If group.name === "SUPER_ADMIN", user is admin
        if (data?.group?.name === "SUPER_ADMIN") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Error fetching user info");
      } finally {
        setLoading(false);
      }
    }

    fetchUserGroup();
    // Important: only [status, session?.accessToken], NOT setLoading, setErrorMsg, setIsAdmin
  }, [status, session?.accessToken]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <div
          className={cn(
            "relative p-6 md:p-8 rounded-xl",
            "bg-theme-100/75 dark:bg-theme-900/75",
            "backdrop-blur-lg",
            "ring-1 ring-theme-200/50 dark:ring-theme-700/50",
            "shadow-lg shadow-theme-500/10",
            "max-w-md w-full"
          )}
        >
          <p className="text-theme-800 dark:text-theme-200 text-center text-lg">
            {status === "loading" ? "Checking session..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <div
          className={cn(
            "relative p-6 md:p-8 rounded-xl",
            "bg-theme-100/75 dark:bg-theme-900/75",
            "backdrop-blur-lg",
            "ring-1 ring-theme-200/50 dark:ring-theme-700/50",
            "shadow-lg shadow-theme-500/10",
            "max-w-md w-full"
          )}
        >
          <p className="text-theme-800 dark:text-theme-200 text-center text-lg">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Top gradient header */}
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
            {errorMsg && (
              <div
                className={cn(
                  "bg-red-100/80 dark:bg-red-900/30",
                  "text-red-700 dark:text-red-300",
                  "p-3 my-4 rounded-lg",
                  "border border-red-200 dark:border-red-800",
                  "backdrop-blur-sm"
                )}
              >
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content layout */}
      <section className="relative bg-theme-50 dark:bg-theme-950">
        <div
          className={cn(
            "hidden md:block absolute inset-0",
            "bg-theme-100 dark:bg-theme-900",
            "opacity-20"
          )}
        />
        <div className={cn("relative py-6", "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8")}>
          <div className="md:grid md:grid-cols-12 md:gap-6">
            {/* Left: tab list */}
            <div className="md:col-span-4 space-y-6 mb-6 md:mb-0">
              <div
                className={cn(
                  "rounded-xl overflow-hidden",
                  "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                  "bg-theme-50 dark:bg-theme-950",
                  "shadow-md shadow-theme-500/5 p-5"
                )}
              >
                {/* Mobile dropdown */}
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
                    onChange={(e) => setMainTab(e.target.value as any)}
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
                        onChange={(e) => setSiteSubTab(e.target.value as any)}
                      >
                        <option value="groups">Groups</option>
                        <option value="users">Users</option>
                        <option value="configs">Configs</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Desktop tabs */}
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

            {/* Right: Tab content */}
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

const imagesAtom = atom([
  { id: 1, name: "cat.jpg", url: "https://example.com/cat.jpg" },
  { id: 2, name: "dog.png", url: "https://example.com/dog.png" },
]);

function MyImagesTab() {
  const [images] = useAtom(imagesAtom);

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Copied image URL to clipboard!");
    } catch {
      alert("Failed to copy.");
    }
  }

  return (
    <div>
      <h2
        className={cn(
          "text-xl font-semibold mb-4",
          "text-theme-900 dark:text-theme-100",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        My Images
      </h2>
      <p className="text-theme-600 dark:text-theme-400 mb-6">
        (Placeholder) Below is a mock list of images. Click to copy URL.
      </p>

      <div className="space-y-4">
        {images.map((img) => (
          <div
            key={img.id}
            onClick={() => copyUrl(img.url)}
            className={cn(
              "border border-theme-200/50 dark:border-theme-800/50 rounded-lg",
              "p-4 bg-theme-100/25 dark:bg-theme-900/25",
              "transition-all duration-200 hover:shadow-md cursor-pointer"
            )}
          >
            <p className="font-medium text-theme-700 dark:text-theme-300 mb-1">
              {img.name}
            </p>
            <p className="text-sm text-theme-500 dark:text-theme-400 break-all">{img.url}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteSettingsTab({ currentSubTab }: { currentSubTab: string }) {
  return (
    <div>
      <h2
        className={cn(
          "text-xl font-semibold mb-4",
          "text-theme-900 dark:text-theme-100",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        Site Settings
      </h2>

      {currentSubTab === "groups" && <GroupsTab />}
      {currentSubTab === "users" && <UsersTab />}
      {currentSubTab === "configs" && <ConfigsTab />}
    </div>
  );
}

function GroupsTab() {
  return (
    <div
      className={cn(
        "p-4 bg-theme-100/25 dark:bg-theme-900/25",
        "rounded-lg border border-theme-200/50 dark:border-theme-800/50"
      )}
    >
      <h3 className="text-lg font-medium text-theme-700 dark:text-theme-300 mb-2">
        Groups Management (Placeholder)
      </h3>
      <p className="text-sm text-theme-500 dark:text-theme-400">
        Here you might list all groups, create/edit them, etc.
      </p>
    </div>
  );
}

function UsersTab() {
  return (
    <div
      className={cn(
        "p-4 bg-theme-100/25 dark:bg-theme-900/25",
        "rounded-lg border border-theme-200/50 dark:border-theme-800/50"
      )}
    >
      <h3 className="text-lg font-medium text-theme-700 dark:text-theme-300 mb-2">
        Users Management (Placeholder)
      </h3>
      <p className="text-sm text-theme-500 dark:text-theme-400">
        Here you could show a table of all users, etc.
      </p>
    </div>
  );
}

function ConfigsTab() {
  return (
    <div
      className={cn(
        "p-4 bg-theme-100/25 dark:bg-theme-900/25",
        "rounded-lg border border-theme-200/50 dark:border-theme-800/50"
      )}
    >
      <h3 className="text-lg font-medium text-theme-700 dark:text-theme-300 mb-2">
        Site Configurations (Placeholder)
      </h3>
      <p className="text-sm text-theme-500 dark:text-theme-400">
        Here you could adjust site-wide settings, etc.
      </p>
    </div>
  );
}
