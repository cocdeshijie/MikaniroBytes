import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { BACKEND_URL, NEXTAUTH_SECRET } from "@/lib/env";
import { api } from "@/lib/api";

/* ──────────────────────────────────────────────────
   1)  Module-augmentation
   ──────────────────────────────────────────────────*/
declare module "next-auth" {
  /**
   * What **authorize()** returns at sign-in.
   * We only know the access-token here; the profile is fetched later.
   */
  interface User {
    token: string;            // required
    id?: number;              // ↙︎ now all optional
    username?: string;
    email?: string | null;
    groupName?: string;
  }

  interface Session {
    accessToken: string;
    user: {
      id: string;
      username: string;
      email?: string | null;
      groupName?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    id?: number;
    username?: string;
    email?: string | null;
    groupName?: string;
  }
}

/* ──────────────────────────────────────────────────
   2)  Auth options
   ──────────────────────────────────────────────────*/
export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,                           // 7 days
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },

      /**
       * ──  authorize()
       *     ↳ Exchange login + pwd for an **access-token** only.
       */
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          throw new Error("Missing username or password");
        }

        const { access_token } = await api<{ access_token: string }>(
          "/auth/login",
          {
            method: "POST",
            json: {
              username: credentials.username,
              password: credentials.password,
            },
          },
        );

        return { token: access_token };                 // ✅ satisfies User
      },
    }),
  ],

  callbacks: {
    /**
     * ──  jwt()
     *     ↳ On first run caches profile data inside the JWT,
     *       thereafter just returns the token unchanged.
     */
    async jwt({ token, user }) {
      /* first visit after sign-in */
      if (user && "token" in user) {
        token.accessToken = user.token;
      }

      /* fetch profile once */
      if (token.accessToken && !token.id) {
        const me = await api<{
          id: number;
          username: string;
          email?: string | null;
          group: { name: string } | null;
        }>("/auth/me", { token: token.accessToken });

        token.id        = me.id;
        token.username  = me.username;
        token.email     = me.email ?? null;
        token.groupName = me.group?.name ?? "GUEST";
      }

      return token;
    },

    /**
     * ──  session()
     *     ↳ Expose selected JWT fields to the client.
     */
    async session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken    = token.accessToken as string;
      session.user.id        = String(token.id);
      session.user.username  = token.username as string;
      session.user.email     = token.email ?? null;
      session.user.groupName = token.groupName;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
