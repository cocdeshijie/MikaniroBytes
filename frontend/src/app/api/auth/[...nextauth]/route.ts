import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

// Extend the built-in Session type to include our custom properties
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }

  // Extend User to include our token property
  interface User {
    id: string;
    token: string;
  }
}

// Example host for your FastAPI:
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const handler = NextAuth({
  // You MUST set a strong secret in production
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    // We'll store sessions in a signed cookie (JWT-based).
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days, for example
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
        // Call your FastAPI /auth/login
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!res.ok) {
          // Will be displayed by NextAuth as an error
          throw new Error("Invalid credentials or server error");
        }

        const data = await res.json();
        // data expected: { access_token: string, token_type: "bearer" }
        if (!data?.access_token) {
          throw new Error("No access token returned from server");
        }

        // Return an object that NextAuth will store in the token => session
        // Include the required 'id' field for the User type
        return {
          id: credentials.username, // Using username as ID
          token: data.access_token,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * The "jwt" callback is called whenever a token is created/updated.
     */
    async jwt({ token, user }) {
      // If user just logged in, user object is passed here
      if (user) {
        token.accessToken = user.token;
      }
      return token;
    },
    /**
     * The "session" callback is called whenever a session is checked.
     * We copy the accessToken from token to session, so front-end can read it.
     */
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    // Optionally override built-in pages
    // e.g. signIn: '/login' // If you want to override NextAuth default signIn page
  },
});

export { handler as GET, handler as POST };