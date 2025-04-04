"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useAtom, atom } from "jotai";
import { cn } from "@/utils/cn";

// Create atoms for form state
const usernameAtom = atom("");
const emailAtom = atom("");
const passwordAtom = atom("");
const errorMsgAtom = atom("");

/**
 * Register Page with modern minimal styling
 */
export default function RegisterPage() {
  const router = useRouter();

  // Use atoms instead of useState
  const [username, setUsername] = useAtom(usernameAtom);
  const [email, setEmail] = useAtom(emailAtom);
  const [password, setPassword] = useAtom(passwordAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    try {
      // 1) Call FastAPI /auth/register
      const res = await fetch("http://localhost:8000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        // e.g. {detail: "..."}
        throw new Error(data.detail || "Registration failed");
      }

      // 2) If success => auto-login with NextAuth
      // signIn returns { ok: boolean, error: string|null, ... }
      const loginResult = await signIn("credentials", {
        username,
        password,
        redirect: false, // we'll handle redirect manually
      });

      if (loginResult?.error) {
        // If signIn failed for some reason (shouldn't happen if password is correct)
        throw new Error(loginResult.error);
      }

      // 3) If signIn was successful, go to /user
      router.push("/profile");
    } catch (err: any) {
      setErrorMsg(err.message || "Registration error");
    }
  }

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center",
      "bg-theme-50 dark:bg-theme-950",
      "p-4"
    )}>
      <div className="max-w-md w-full">
        <div className={cn(
          "mb-10",
        )}>
          <h1 className={cn(
            "text-xl sm:text-3xl lg:text-4xl font-bold",
            "text-theme-900 dark:text-theme-100",
            "leading-tight flex items-center gap-2",
          )}>
            Create Account
            <div className="h-1 w-12 bg-theme-500 rounded-full inline-block ml-2"></div>
          </h1>
          <p className="text-theme-600 dark:text-theme-400 mt-2">
            Join us by creating your account
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className={cn(
            "bg-white dark:bg-theme-900",
            "rounded-xl overflow-hidden",
            "shadow-sm hover:shadow-md transition-all duration-300"
          )}
        >
          {/* Form */}
          <div className="p-8">
            {errorMsg && (
              <div className={cn(
                "bg-red-50 dark:bg-red-900/20",
                "text-red-600 dark:text-red-400",
                "p-4 mb-6 rounded-lg",
                "border border-red-100 dark:border-red-800/50"
              )}>
                {errorMsg}
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="username"
                className="block mb-2 text-sm font-medium text-theme-500"
              >
                Username
              </label>
              <input
                id="username"
                className={cn(
                  "w-full px-4 py-3 rounded-lg",
                  "bg-theme-50 dark:bg-theme-800",
                  "border border-theme-200 dark:border-theme-700",
                  "focus:border-theme-500 focus:outline-none",
                  "transition-colors duration-200",
                  "text-theme-900 dark:text-theme-100"
                )}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-theme-500"
                >
                  Email
                </label>
                <span className="text-xs text-theme-400 dark:text-theme-500">
                  Optional
                </span>
              </div>
              <input
                id="email"
                type="email"
                className={cn(
                  "w-full px-4 py-3 rounded-lg",
                  "bg-theme-50 dark:bg-theme-800",
                  "border border-theme-200 dark:border-theme-700",
                  "focus:border-theme-500 focus:outline-none",
                  "transition-colors duration-200",
                  "text-theme-900 dark:text-theme-100"
                )}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="mb-8">
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-theme-500"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                className={cn(
                  "w-full px-4 py-3 rounded-lg",
                  "bg-theme-50 dark:bg-theme-800",
                  "border border-theme-200 dark:border-theme-700",
                  "focus:border-theme-500 focus:outline-none",
                  "transition-colors duration-200",
                  "text-theme-900 dark:text-theme-100"
                )}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
              />
            </div>

            <button
              type="submit"
              className={cn(
                "w-full py-3 px-6 rounded-lg mt-4",
                "bg-theme-500 hover:bg-theme-600 active:bg-theme-700",
                "text-white font-medium",
                "transition-all duration-200",
                "flex items-center justify-center gap-2"
              )}
            >
              <span>Create Account</span>
              <div className="w-1 h-4 bg-white/50 rounded-full"></div>
            </button>

            <div className="mt-6 text-center text-sm text-theme-600 dark:text-theme-400">
              Already have an account?{" "}
              <a href="/auth/login" className="text-theme-500 hover:underline">
                Sign in
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}