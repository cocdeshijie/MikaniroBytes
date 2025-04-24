import { BACKEND_URL } from "./env";

/** Custom error thrown on any non-2xx response */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = RequestInit & {
  /** Bearer token from Next-Auth (optional) */
  token?: string;
  /** If provided we JSON-stringify + set correct header */
  json?: unknown;
};

/**
 * Minimal wrapper around `fetch` to keep networking logic out of UI layers.
 *
 *  • Relative paths are auto-prefixed with `BACKEND_URL`
 *  • Automatically adds Authorization & JSON headers
 *  • Throws `ApiError` on non-2xx and tries to surface `detail`
 */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, json, headers: hdrs, ...init } = opts;

  const url = /^https?:\/\//.test(path)           // already absolute?
    ? path
    : `${BACKEND_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: HeadersInit = {
    ...(json  ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` }   : {}),
    ...(hdrs ?? {}),
  };

  const res = await fetch(url, {
    ...init,
    headers,
    body: json ? JSON.stringify(json) : init.body,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      /* ignore – keep default message */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;           // no-content

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;

  // binary / text – caller decides the generic <T>
  return (await res.blob()) as unknown as T;
}
