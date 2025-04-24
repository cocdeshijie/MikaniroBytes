import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

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
  secret: process.env.NEXTAUTH_SECRET,
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

        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!res.ok) throw new Error("Invalid credentials or server error");
        const data: { access_token?: string } = await res.json();
        if (!data.access_token) throw new Error("No access token returned");

        /* this object becomes `user` in the JWT callback */
        return { id: credentials.username, token: data.access_token };
      },
    }),
  ],

  callbacks: {
    /* put the FastAPI token inside the JWT cookie */
    async jwt({ token, user }) {
      if (user && "token" in user) {
        token.accessToken = user.token;
      }
      return token;
    },

    /* expose it to the client session */
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
};

/* ────────────────────────────────────────────────────────────────
   3)  Handler export (Edge-compatible)
   ────────────────────────────────────────────────────────────────*/
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
