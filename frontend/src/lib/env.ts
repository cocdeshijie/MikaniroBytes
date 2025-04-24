/**
 * Central place for build-time environment variables.
 * All other code should import from here instead of touching
 * `process.env.*` directly – makes refactors & testing easier.
 */
export const BACKEND_URL       = process.env.NEXT_PUBLIC_BACKEND_URL!;
export const NEXTAUTH_SECRET   = process.env.NEXTAUTH_SECRET!;
export const NODE_ENV          = process.env.NODE_ENV ?? "development";

/** Add more as needed, but keep this file minimal. */
