"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function NextAuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  /* “session” is only used for the first paint – after that
     the client syncs automatically with /api/auth/session */
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
