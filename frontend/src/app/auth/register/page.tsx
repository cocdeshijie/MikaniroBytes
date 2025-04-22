"use client";

/* ------------------------------------------------------------------ */
/*                               IMPORTS                              */
/* ------------------------------------------------------------------ */
import { FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useAtom, atom } from "jotai";
import * as Form from "@radix-ui/react-form";               // ← NEW
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*                               ATOMS                                */
/* ------------------------------------------------------------------ */
const usernameA  = atom("");
const emailA     = atom("");
const passwordA  = atom("");
const errorA     = atom("");
const enabledA   = atom<null | boolean>(null);  // null = loading

/* ------------------------------------------------------------------ */
/*                               PAGE                                 */
/* ------------------------------------------------------------------ */
export default function RegisterPage() {
  const router                       = useRouter();

  const [username, setUsername]      = useAtom(usernameA);
  const [email, setEmail]            = useAtom(emailA);
  const [password, setPassword]      = useAtom(passwordA);
  const [errorMsg, setError]         = useAtom(errorA);
  const [enabled, setEnabled]        = useAtom(enabledA);

  /* ---------------- fetch public flag once ------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/registration-enabled`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setEnabled(Boolean(data?.enabled));
      } catch {
        setEnabled(true);          // network error → assume open
      }
    })();
  }, []);

  /* ---------------- submit handler ------------------------------- */
  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register`,
        {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ username, email, password }),
        }
      );

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Registration failed");
      }

      /* auto‑login */
      const login = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (login?.error) throw new Error(login.error);

      router.push("/profile");
    } catch (err: any) {
      setError(err.message || "Registration error");
    }
  }

  /* ---------------- disabled flag handling ----------------------- */
  if (enabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950 p-4">
        <div
          className={cn(
            "max-w-md w-full text-center p-8 rounded-xl",
            "bg-white dark:bg-theme-900",
            "shadow-md ring-1 ring-theme-200 dark:ring-theme-800"
          )}
        >
          <h1 className="text-2xl font-bold text-theme-900 dark:text-theme-100 mb-4">
            Registration Disabled
          </h1>
          <p className="text-theme-700 dark:text-theme-300">
            Sorry, new accounts cannot be created at the moment.
          </p>
          <div className="mt-6">
            <a
              href="/auth/login"
              className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600"
            >
              Back to sign‑in
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (enabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950">
        <p className="text-theme-700 dark:text-theme-300">Checking…</p>
      </div>
    );
  }

  /* --------------------------- UI ------------------------------- */
  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center",
        "bg-theme-50 dark:bg-theme-950",
        "p-4"
      )}
    >
      <div className="max-w-md w-full">
        <div className={cn("mb-10")}>
          <h1
            className={cn(
              "text-xl sm:text-3xl lg:text-4xl font-bold",
              "text-theme-900 dark:text-theme-100",
              "leading-tight flex items-center gap-2"
            )}
          >
            Create Account
            <div className="h-1 w-12 bg-theme-500 rounded-full inline-block ml-2"></div>
          </h1>
          <p className="text-theme-600 dark:text-theme-400 mt-2">
            Join us by creating your account
          </p>
        </div>

        {/* ---------------- Radix Form ---------------- */}
        <Form.Root
          onSubmit={handleRegister}
          className={cn(
            "bg-white dark:bg-theme-900",
            "rounded-xl overflow-hidden",
            "shadow-sm hover:shadow-md transition-all duration-300"
          )}
        >
          <div className="p-8 space-y-6">
            {errorMsg && (
              <div
                className={cn(
                  "bg-red-50 dark:bg-red-900/20",
                  "text-red-600 dark:text-red-400",
                  "p-4 rounded-lg border border-red-100 dark:border-red-800/50"
                )}
              >
                {errorMsg}
              </div>
            )}

            {/* Username */}
            <Form.Field name="username">
              <Form.Label className="block mb-2 text-sm font-medium text-theme-500">
                Username
              </Form.Label>
              <Form.Control asChild>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className={inputClass()}
                />
              </Form.Control>
            </Form.Field>

            {/* Email */}
            <Form.Field name="email">
              <Form.Label className="block mb-2 text-sm font-medium text-theme-500">
                Email (optional)
              </Form.Label>
              <Form.Control asChild>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className={inputClass()}
                />
              </Form.Control>
            </Form.Field>

            {/* Password */}
            <Form.Field name="password">
              <Form.Label className="block mb-2 text-sm font-medium text-theme-500">
                Password
              </Form.Label>
              <Form.Control asChild>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className={inputClass()}
                />
              </Form.Control>
            </Form.Field>

            {/* Submit */}
            <Form.Submit asChild>
              <button
                type="submit"
                className={cn(
                  "w-full py-3 px-6 rounded-lg mt-2",
                  "bg-theme-500 hover:bg-theme-600 active:bg-theme-700",
                  "text-white font-medium transition-all duration-200"
                )}
              >
                Create Account
              </button>
            </Form.Submit>

            <div className="mt-6 text-center text-sm text-theme-600 dark:text-theme-400">
              Already have an account?{" "}
              <a href="/auth/login" className="text-theme-500 hover:underline">
                Sign in
              </a>
            </div>
          </div>
        </Form.Root>
      </div>
    </div>
  );
}

/* tiny helper for consistent input styling */
function inputClass() {
  return cn(
    "w-full px-4 py-3 rounded-lg",
    "bg-theme-50 dark:bg-theme-800",
    "border border-theme-200 dark:border-theme-700",
    "focus:border-theme-500 focus:outline-none",
    "transition-colors duration-200",
    "text-theme-900 dark:text-theme-100"
  );
}
