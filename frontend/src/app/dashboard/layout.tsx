"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, userInfo } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  /* Simple admin check if you store groupName. */
  const isAdmin = userInfo?.groupName === "SUPER_ADMIN";

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-lg text-theme-700 dark:text-theme-300">
          Checking session…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Header */}
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
              "shadow-lg shadow-theme-500/10 p-6 md:p-8"
            )}
          >
            <h1
              className={cn(
                "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold",
                "text-theme-950 dark:text-theme-50 leading-tight"
              )}
            >
              Dashboard
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <section className="relative bg-theme-50 dark:bg-theme-950">
        <div className="hidden md:block absolute inset-0 bg-theme-100 dark:bg-theme-900 opacity-20" />
        <div className="relative py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:grid md:grid-cols-12 md:gap-6">
            {/* Left nav */}
            <nav className="md:col-span-4 space-y-6 mb-6 md:mb-0">
              <div
                className={cn(
                  "rounded-xl overflow-hidden",
                  "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                  "bg-theme-50 dark:bg-theme-950 shadow-md shadow-theme-500/5 p-5"
                )}
              >
                <div className="space-y-2">
                  <NavButton href="/dashboard/files" label="My Files" current={pathname} />
                  {isAdmin && (
                    <NavButton
                      href="/dashboard/groups"
                      label="Groups"
                      current={pathname}
                    />
                  )}
                  {isAdmin && (
                    <NavButton
                      href="/dashboard/configs"
                      label="Configs"
                      current={pathname}
                    />
                  )}
                  {/* Add more links if needed */}
                </div>
              </div>
            </nav>

            {/* Right column */}
            <div className="md:col-span-8">
              <div
                className={cn(
                  "rounded-xl overflow-hidden",
                  "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
                  "bg-theme-50 dark:bg-theme-950 shadow-md shadow-theme-500/5 h-full"
                )}
              >
                <div className="p-5">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function NavButton({
  href,
  label,
  current,
}: {
  href: string;
  label: string;
  current: string;
}) {
  const selected = current.startsWith(href);

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
