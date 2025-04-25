import {NextRequest, NextResponse} from "next/server";
import {getToken} from "next-auth/jwt";
import {NEXT_PUBLIC_BACKEND_URL, NEXTAUTH_SECRET} from "@/lib/env";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: NEXTAUTH_SECRET });
  if (!token || !token.accessToken) {
    // No token => redirect to /auth/login
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Call FastAPI to see if token is valid
  const isValid = await checkTokenInDB(token.accessToken as string);
  if (!isValid) {
    // Token invalid => remove NextAuth cookies & redirect
    const response = NextResponse.redirect(new URL("/auth/login", req.url));

    response.cookies.set("next-auth.session-token", "", {
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("__Secure-next-auth.session-token", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  }

  return NextResponse.next();
}

async function checkTokenInDB(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${NEXT_PUBLIC_BACKEND_URL}/auth/check-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

// Match both /profile and /dashboard
export const config = {
  matcher: ["/profile", "/dashboard"],
};
