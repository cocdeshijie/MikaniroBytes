"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";

import Link from "next/link";

// (Optional) We can store a pageError in Jotai if you want:
const pageErrorAtom = atom<string>("");
// (Optional) store if user is admin:
const isAdminAtom = atom<boolean>(false);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // optional: global error or isAdmin states
  const [pageError, setPageError] = useAtom(pageErrorAtom);
  const [isAdmin, setIsAdmin] = useAtom(isAdminAtom);

  // If not logged in => redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  // On mount, check if SUPER_ADMIN
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) return;

    (async () => {
      try {
        setPageError("");
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
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
    })();
  }, [status, session?.accessToken]);

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
      {/* Example header styling */}
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

      {/* Layout with left nav + main content */}
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
                {/* Desktop nav buttons */}
                <div className="space-y-2">
                  <NavButton href="/dashboard/images" label="My Images" />
                  {isAdmin && (
                    <NavButton href="/dashboard/groups" label="Groups" />
                  )}
                  {isAdmin && (
                    <NavButton href="/dashboard/users" label="Users" />
                  )}
                  {isAdmin && (
                    <NavButton href="/dashboard/configs" label="Configs" />
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: "children" = nested route content */}
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
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Reusable button for nav links
function NavButton({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  // Actually, with next/navigation, you'd do usePathname() or `useSelectedLayoutSegments()`.
  // For simplicity, let's do:
  // const pathname = usePathname();
  // but let's keep it simple

  // We'll do a quick "selected" check:
  const selected = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "block w-full text-left px-3 py-2 rounded",
        selected
          ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
          : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
      )}
    >
      {label}
    </Link>
  );
}
