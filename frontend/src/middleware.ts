import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * This middleware runs for every request matching the 'matcher' config below.
 * 1) We parse the user's NextAuth JWT using getToken().
 * 2) We call the FastAPI backend /auth/check-session to see if this token is still valid.
 * 3) If invalid, redirect to /login.
 */
export async function middleware(req: NextRequest) {
  // 1) Read the JWT from the NextAuth cookie
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // If no token at all, user is definitely not logged in
  if (!token || !token.accessToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 2) Check token validity against FastAPI
  const isValid = await checkTokenInDB(token.accessToken as string);
  if (!isValid) {
    // Token invalid/revoked => redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If valid, allow the request to continue
  return NextResponse.next();
}

// Helper: call the FastAPI /auth/check-session endpoint
async function checkTokenInDB(accessToken: string): Promise<boolean> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const res = await fetch(`${backendUrl}/auth/check-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken }),
    });
    if (!res.ok) {
      // If we get a 4xx/5xx from the server, assume invalid
      return false;
    }
    const data = await res.json();
    return data.valid === true;
  } catch (err) {
    // If network error or something else, assume invalid
    return false;
  }
}

/**
 * The config tells Next.js which routes should use this middleware.
 * Below we protect the /user page (and everything under /user/...).
 * Adjust this array to suit your needs.
 */
export const config = {
  matcher: ["/user"],
};
