import { useSession } from "next-auth/react";

/**
 * Small convenience hook that wraps useSession() and gives you:
 *   • `session`   – the raw session object
 *   • `status`    – "loading" | "authenticated" | "unauthenticated"
 *   • `isAdmin`   – true if the user belongs to the SUPER_ADMIN group
 */
export function useAuth() {
  const { data: session, status } = useSession();

  const group = session?.user?.groupName;
  const isAdmin = group === "SUPER_ADMIN";

  return { session, status, isAdmin };
}
