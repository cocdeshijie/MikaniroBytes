"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { useAuth } from "@/lib/auth";

/* =================================================================== */
/*                              LAYOUT                                 */
/* =================================================================== */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, userInfo, ready } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  /* ---------- derived ---------- */
  const isAdmin = userInfo?.groupName === "SUPER_ADMIN";

  /* ---------- skeleton used while auth status is unknown ----------- */
  const Skeleton = useMemo(
    () => (
      <div className="space-y-6 md:grid md:grid-cols-12 md:gap-6 md:space-y-0 animate-pulse">
        <div className="md:col-span-4 space-y-6">
          <div className="h-64 rounded-xl bg-theme-200/40 dark:bg-theme-800/30" />
        </div>
        <div className="md:col-span-8 h-[500px] rounded-xl bg-theme-200/40 dark:bg-theme-800/30" />
      </div>
    ),
    [],
  );

  /* ---------- redirect unauthenticated *after* auth ready ---------- */
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/auth/login");
  }, [ready, isAuthenticated, router]);

  /* ---------- 1. waiting for auth state --------------------------- */
  if (!ready) {
    return (
      <PageFrame>
        {Skeleton}
      </PageFrame>
    );
  }

  /* ---------- 2. unauthenticated (redirect is happening) ----------- */
  if (!isAuthenticated) {
    return <FullPageMsg>Redirecting…</FullPageMsg>;
  }

  /* ---------- 3. normal dashboard --------------------------------- */
  return (
    <PageFrame>
      <div className="md:grid md:grid-cols-12 md:gap-6">
        {/* ─────────── LEFT NAV ─────────── */}
        <nav className="md:col-span-4 space-y-6 mb-6 md:mb-0">
          <div
            className={cn(
              "rounded-xl overflow-hidden",
              "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
              "bg-theme-50 dark:bg-theme-950 shadow-md shadow-theme-500/5 p-5",
            )}
          >
            <div className="space-y-2">
              <NavButton href="/dashboard/files"   label="My Files" current={pathname} />
              {isAdmin && (
                <NavButton href="/dashboard/groups" label="Groups"   current={pathname} />
              )}
              {isAdmin && (
                <NavButton href="/dashboard/configs" label="Configs"  current={pathname} />
              )}
            </div>
          </div>
        </nav>

        {/* ─────────── RIGHT CONTENT ─────────── */}
        <div className="md:col-span-8">
          <div
            className={cn(
              "rounded-xl overflow-hidden",
              "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
              "bg-theme-50 dark:bg-theme-950 shadow-md shadow-theme-500/5 h-full",
            )}
          >
            <div className="p-5">{children}</div>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

/* =================================================================== */
/*                               FRAME                                 */
/* =================================================================== */
function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Header */}
      <Header />

      {/* Content wrapper */}
      <section className="relative bg-theme-50 dark:bg-theme-950">
        <div className="hidden md:block absolute inset-0 bg-theme-100 dark:bg-theme-900 opacity-20" />
        <div className="relative py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </section>
    </div>
  );
}

/* =================================================================== */
/*                           REUSABLE PARTS                            */
/* =================================================================== */
function Header() {
  return (
    <div
      className={cn(
        "relative pt-24 pb-6 md:pt-28 md:pb-8",
        "bg-gradient-to-br",
        "from-theme-500/15 via-theme-100/25 to-theme-300/15",
        "dark:from-theme-500/15 dark:via-theme-900/25 dark:to-theme-700/15",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "relative rounded-xl overflow-hidden backdrop-blur-sm",
            "border border-theme-200/25 dark:border-theme-700/25",
            "shadow-lg shadow-theme-500/10 p-6 md:p-8",
          )}
        >
          <h1
            className={cn(
              "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold",
              "text-theme-950 dark:text-theme-50 leading-tight",
            )}
          >
            Dashboard
          </h1>
        </div>
      </div>
    </div>
  );
}

function FullPageMsg({ children }: { children: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
      <p className="text-theme-800 dark:text-theme-200 text-lg">{children}</p>
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
        "block w-full text-left px-3 py-2 rounded transition-colors",
        selected
          ? "bg-theme-200 dark:bg-theme-800 text-theme-900 dark:text-theme-100 font-semibold"
          : "text-theme-700 dark:text-theme-300 hover:bg-theme-200/50 dark:hover:bg-theme-800/50",
      )}
    >
      {label}
    </Link>
  );
}
