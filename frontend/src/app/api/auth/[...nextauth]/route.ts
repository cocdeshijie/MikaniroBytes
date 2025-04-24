import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { BACKEND_URL, NEXTAUTH_SECRET } from "@/lib/env";
import { api } from "@/lib/api";

/* ────────────────────────────────────────────────────────────────
   1)  Inline module-augmentation
   (you can move this to   src/types/next-auth.d.ts   later)
   ────────────────────────────────────────────────────────────────*/
declare module "next-auth" {
  interface Session {
    /** JWT issued by FastAPI – available via `useSession()` */
    accessToken?: string;
  }
  interface User {
    id: string;      // we return this from `authorize`
    token: string;   // FastAPI `access_token`
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

/* ────────────────────────────────────────────────────────────────
   2)  Auth configuration
   ────────────────────────────────────────────────────────────────*/
export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
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
        /* ⬇️ use api() instead of raw fetch */
        const data = await api<{ access_token: string }>(
          "/auth/login",
          {
            method: "POST",
            json: {
              username: credentials.username,
              password: credentials.password,
            },
            // api() prefixes BACKEND_URL automatically
          },
        );
        return { id: credentials.username, token: data.access_token };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user && "token" in user) token.accessToken = user.token;
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.accessToken) session.accessToken = token.accessToken;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };