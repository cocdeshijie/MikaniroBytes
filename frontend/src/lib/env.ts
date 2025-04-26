/**
 * Central place for build-time environment variables.
 * All other code should import from here instead of touching
 * `process.env.*` directly – makes refactors & testing easier.
 */
export const NEXT_PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
export const NODE_ENV= process.env.NODE_ENV ?? "development";

/** Add more as needed, but keep this file minimal. */
