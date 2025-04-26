"use client";

/* ------------------------------------------------------------------ */
/*                               IMPORTS                              */
/* ------------------------------------------------------------------ */
import { FormEvent, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { userInfoAtom, type UserInfo } from "@/atoms/auth";

/* ------------------------------------------------------------------ */
/*                          LOCAL-ONLY ATOMS                          */
/* ------------------------------------------------------------------ */
interface SessionItem {
  session_id: number;
  token: string;
  ip_address?: string;
  client_name?: string;
  created_at: string;
  last_accessed: string;
}

const sessionsAtom = atom<SessionItem[]>([]);
const loadingAtom  = atom(false);
const errorAtom    = atom("");
const fetchedAtom  = atom(false);

const oldPwA = atom("");
const newPwA = atom("");

/* =================================================================== */
/*                              COMPONENT                              */
/* =================================================================== */
export default function ProfilePage() {
  const router   = useRouter();
  const { push } = useToast();
  const { isAuthenticated, token, ready, userInfo } = useAuth();

  const [, setUserInfo]          = useAtom(userInfoAtom);
  const [sessions, setSessions]  = useAtom(sessionsAtom);
  const [,  setLoading]   = useAtom(loadingAtom);
  const [errorMsg, setError]     = useAtom(errorAtom);
  const [fetched,  setFetched]   = useAtom(fetchedAtom);

  const [oldPw, setOldPw] = useAtom(oldPwA);
  const [newPw, setNewPw] = useAtom(newPwA);

  /* ---------- shared skeleton (memoised) --------------------------- */
  const Skeleton = useMemo(
    () => (
      <div className="space-y-6 md:grid md:grid-cols-12 md:gap-6 md:space-y-0 animate-pulse">
        <div className="md:col-span-4 space-y-6">
          <div className="h-64 rounded-xl bg-theme-200/40 dark:bg-theme-800/30" />
          <div className="h-72 rounded-xl bg-theme-200/40 dark:bg-theme-800/30" />
        </div>
        <div className="md:col-span-8 h-96 rounded-xl bg-theme-200/40 dark:bg-theme-800/30" />
      </div>
    ),
    [],
  );

  /* ---------- redirect unauthenticated AFTER auth check ------------ */
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/auth/login");
  }, [ready, isAuthenticated, router]);

  /* ---------- first load: fetch sessions only ---------------------- */
  useEffect(() => {
    if (!ready || !isAuthenticated || fetched || !token) return;

    setLoading(true);
    setError("");

    (async () => {
      try {
        /* userInfo already provided by useAuth() --------------- */
        if (userInfo) {
          setUserInfo(userInfo); // ensure atoms in sync (SSR safety)
        }

        /* fetch active sessions ------------------------------- */
        const list = await api<SessionItem[]>("/auth/sessions", { token });
        setSessions(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        setLoading(false);
        setFetched(true);
      }
    })();
  }, [
    ready,
    isAuthenticated,
    fetched,
    token,
    userInfo,
    setUserInfo,
    setLoading,
    setError,
    setSessions,
    setFetched,
  ]);

  /* ---------- UX paths --------------------------------------------- */
  if (!ready) {
    /* still discovering auth state → show full skeleton */
    return <PageFrame headerError="">{Skeleton}</PageFrame>;
  }

  if (ready && isAuthenticated && !fetched) {
    /* logged-in but sessions not yet fetched */
    return <PageFrame headerError={errorMsg}>{Skeleton}</PageFrame>;
  }

  if (!isAuthenticated) {
    /* will redirect very soon */
    return <FullPageMsg>Redirecting…</FullPageMsg>;
  }

  /* ---------- helper actions (now that token is guaranteed) -------- */
  const revokeSession = async (id: number) => {
    try {
      await api(`/auth/sessions/${id}`, { method: "DELETE", token });
      setSessions((p) => p.filter((s) => s.session_id !== id));
      push({ title: "Session revoked", variant: "success" });
    } catch {
      push({ title: "Revoke failed", variant: "error" });
    }
  };

  const revokeAll = async () => {
    if (!confirm("Logout from all devices?")) return;
    try {
      await api("/auth/logout-all", { method: "POST", token });
      setSessions([]);
      push({ title: "Logged out everywhere", variant: "success" });
    } catch {
      push({ title: "Logout-all failed", variant: "error" });
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/auth/change-password", {
        method: "POST",
        token,
        json: { old_password: oldPw, new_password: newPw },
      });
      push({ title: "Password updated", variant: "success" });
      setOldPw("");
      setNewPw("");
    } catch {
      push({ title: "Password change failed", variant: "error" });
    }
  };

  /* ---------- FINAL RENDER ----------------------------------------- */
  return (
    <PageFrame headerError={errorMsg}>
      <div className="md:grid md:grid-cols-12 md:gap-6">
        <LeftColumn
          userInfo={userInfo}
          oldPw={oldPw}
          newPw={newPw}
          setOldPw={setOldPw}
          setNewPw={setNewPw}
          changePw={changePw}
        />
        <RightColumn
          sessions={sessions}
          revokeSession={revokeSession}
          revokeAll={revokeAll}
        />
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ */
/*                               FRAME                                */
/* ------------------------------------------------------------------ */
function PageFrame({
  headerError,
  children,
}: {
  headerError: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-theme-50 dark:bg-theme-950">
      <Header errorMsg={headerError} />
      <section className="relative bg-theme-50 dark:bg-theme-950">
        <div className="hidden md:block absolute inset-0 bg-theme-100 dark:bg-theme-900 opacity-20" />
        <div className="relative py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                        REUSABLE SUB-COMPONENTS                     */
/* ------------------------------------------------------------------ */
function FullPageMsg({ children }: { children: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
      <p className="text-theme-800 dark:text-theme-200 text-lg">{children}</p>
    </div>
  );
}

/* ---------- Header ------------------------------------------------- */
function Header({ errorMsg }: { errorMsg: string }) {
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
              "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4",
              "text-theme-950 dark:text-theme-50 leading-tight",
            )}
          >
            User Dashboard
          </h1>
          {errorMsg && (
            <div
              className={cn(
                "bg-red-100/80 dark:bg-red-900/30",
                "text-red-700 dark:text-red-300 p-3 my-4 rounded-lg",
                "border border-red-200 dark:border-red-800 backdrop-blur-sm",
              )}
            >
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- left column ------------------------------------------- */
function LeftColumn({
  userInfo,
  oldPw,
  newPw,
  setOldPw,
  setNewPw,
  changePw,
}: {
  userInfo: UserInfo | null;
  oldPw: string;
  newPw: string;
  setOldPw: (v: string) => void;
  setNewPw: (v: string) => void;
  changePw: (e: FormEvent) => void;
}) {
  return (
    <div className="md:col-span-4 space-y-6 mb-6 md:mb-0">
      {/* account info */}
      <div className={cardCls}>
        <div className="p-5">
          <CardHeading>Account Information</CardHeading>
          {userInfo ? (
            <div className="space-y-4">
              <InfoRow label="User ID"   value={userInfo.id} />
              <InfoRow label="Username"  value={userInfo.username} />
              <InfoRow label="Email"     value={userInfo.email || "(none)"} />
            </div>
          ) : (
            <p className="italic text-theme-600 dark:text-theme-400">No info.</p>
          )}
        </div>
      </div>

      {/* change password */}
      <div className={cardCls}>
        <div className="p-5">
          <CardHeading>Change Password</CardHeading>
          <form onSubmit={changePw} className="space-y-4">
            <PwInput
              label="Current Password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
            <PwInput
              label="New Password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button
              type="submit"
              className={cn(
                "w-full py-2 px-6 rounded-lg bg-theme-500 hover:bg-theme-600",
                "text-white font-medium shadow-md shadow-theme-500/20",
                "transition-all duration-200 transform hover:-translate-y-0.5",
              )}
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- right column ------------------------------------------ */
function RightColumn({
  sessions,
  revokeSession,
  revokeAll,
}: {
  sessions: SessionItem[];
  revokeSession: (id: number) => void;
  revokeAll: () => void;
}) {
  return (
    <div className="md:col-span-8">
      <div className={cn(cardCls, "h-full")}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-theme-900 dark:text-theme-100">
              Active Sessions
            </h2>
            <button
              onClick={revokeAll}
              className={cn(
                "py-1.5 px-4 rounded-lg bg-red-500 hover:bg-red-600",
                "text-white text-sm font-medium shadow-md shadow-red-500/20",
                "transition-all duration-200",
              )}
            >
              Logout All Devices
            </button>
          </div>

          <div className="border-b border-theme-200 dark:border-theme-800 mb-4" />

          {sessions.length ? (
            <ul className="space-y-4">
              {sessions.map((s) => (
                <li
                  key={s.session_id}
                  className={cn(
                    "border border-theme-200/50 dark:border-theme-800/50 rounded-lg",
                    "p-4 bg-theme-100/25 dark:bg-theme-900/25 transition-all duration-200",
                    "hover:shadow-md",
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* details */}
                    <div className="space-y-2 flex-1">
                      <InfoRow
                        label="Token"
                        value={<span className="font-mono">{s.token.slice(0, 20)}…</span>}
                      />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <InfoRow label="Device"      value={s.client_name || "Unknown"} />
                        <InfoRow label="IP Address"  value={s.ip_address  || "N/A"} />
                        <InfoRow label="Created"     value={new Date(s.created_at).toLocaleString()} />
                        <InfoRow label="Last Access" value={new Date(s.last_accessed).toLocaleString()} />
                      </div>
                    </div>
                    {/* revoke */}
                    <div className="md:self-center">
                      <button
                        onClick={() => revokeSession(s.session_id)}
                        className={cn(
                          "py-1.5 px-4 rounded-lg bg-red-500/80 hover:bg-red-600",
                          "text-white text-sm font-medium shadow shadow-red-500/10",
                          "transition-all duration-200",
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
            <EmptyState>No active sessions found.</EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                         tiny util components                       */
/* ------------------------------------------------------------------ */
const cardCls = cn(
  "rounded-xl overflow-hidden",
  "ring-2 ring-theme-200/25 dark:ring-theme-800/25",
  "bg-theme-50 dark:bg-theme-950",
  "shadow-md shadow-theme-500/5",
);

function CardHeading({ children }: { children: string }) {
  return (
    <h2
      className={cn(
        "text-xl font-semibold mb-4",
        "text-theme-900 dark:text-theme-100",
        "border-b border-theme-200 dark:border-theme-800 pb-2",
      )}
    >
      {children}
    </h2>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col space-y-1">
      <span className="text-sm text-theme-500 dark:text-theme-400">{label}</span>
      <p className="text-theme-700 dark:text-theme-300 break-all">{value}</p>
    </div>
  );
}

function PwInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="block mb-2 text-sm font-medium text-theme-700 dark:text-theme-300">
        {label}
      </label>
      <input
        type="password"
        {...rest}
        className={cn(
          "w-full px-4 py-2 rounded-lg",
          "bg-theme-100/50 dark:bg-theme-800/50",
          "border border-theme-200 dark:border-theme-700",
          "focus:ring-2 focus:ring-theme-500/50 focus:outline-none",
          "text-theme-900 dark:text-theme-100",
        )}
      />
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div
      className={cn(
        "text-center py-8",
        "bg-theme-100/25 dark:bg-theme-900/25",
        "border border-theme-200/50 dark:border-theme-800/50 rounded-lg",
      )}
    >
      <p className="text-theme-600 dark:text-theme-400">{children}</p>
    </div>
  );
}
