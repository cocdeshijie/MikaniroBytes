import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { BACKEND_URL, NEXTAUTH_SECRET } from "@/lib/env";
import { api } from "@/lib/api";

/* ────────────────────────────────────────────────────────────────
   1)  Module-augmentation – add username, email, groupName
   ────────────────────────────────────────────────────────────────*/
declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      id: string;            // string in the session object
      username: string;
      email?: string | null;
      groupName?: string;
    };
  }

  interface User {
    id: number;
    username: string;
    email?: string | null;
    groupName: string;
    token: string;           // FastAPI access_token
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

/* ────────────────────────────────────────────────────────────────
   2)  Auth options
   ────────────────────────────────────────────────────────────────*/
export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge  : 60 * 60 * 24 * 7, // 7 days
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          throw new Error("Missing username or password");
        }

        /* 1️⃣  Login → get access_token */
        const { access_token } = await api<{ access_token: string }>(
          "/auth/login",
          {
            method: "POST",
            json  : {
              username: credentials.username,
              password: credentials.password,
            },
          },
        );

        /* 2️⃣  /auth/me for profile data */
        const me = await api<{
          id: number;
          username: string;
          email?: string | null;
          group: { name: string } | null;
        }>("/auth/me", { token: access_token });

        return {
          id        : me.id,
          username  : me.username,
          email     : me.email ?? null,
          groupName : me.group?.name ?? "GUEST",
          token     : access_token,
        };
      },
    }),
  ],

  callbacks: {
    /* ▸  runs at sign-in and every request */
    async jwt({ token, user }) {
      if (user && "token" in user) {
        token.accessToken = user.token;
        /* ensure numeric — satisfies TS narrow type */
        token.id         = typeof user.id === "string" ? Number(user.id) : user.id;
        token.username   = user.username;
        token.email      = user.email;
        token.groupName  = user.groupName;
      }
      return token;
    },

    /* ▸  expose on client via useSession() */
    async session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken     = token.accessToken as string;
      session.user.id         = String(token.id);
      session.user.username   = token.username as string;
      session.user.email      = token.email ?? null;
      session.user.groupName  = token.groupName;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
