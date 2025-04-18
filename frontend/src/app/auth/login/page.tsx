"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAtom, atom } from "jotai";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";

const usernameAtom = atom("");
const passwordAtom = atom("");

/**
 * Login Page using Radix Toast for feedback.
 */
export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { push } = useToast();

  const [username, setUsername] = useAtom(usernameAtom);
  const [password, setPassword] = useAtom(passwordAtom);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        push({
          title: "Login Failed",
          description: res.error,
          variant: "error",
        });
        return;
      }

      push({ title: "Welcome back!", variant: "success" });
      router.push("/profile");
    } catch (err: any) {
      push({
        title: "Login Error",
        description: err?.message ?? "Login failed.",
        variant: "error",
      });
    }
  }

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
            Sign In
            <div className="h-1 w-12 bg-theme-500 rounded-full inline-block ml-2"></div>
          </h1>
          <p className="text-theme-600 dark:text-theme-400 mt-2">
            Welcome back, please enter your details
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className={cn(
            "bg-white dark:bg-theme-900",
            "rounded-xl overflow-hidden",
            "shadow-sm hover:shadow-md transition-all duration-300"
          )}
        >
          {/* Form */}
          <div className="p-8">
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
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-theme-500"
                >
                  Password
                </label>
                <a href="#" className="text-xs text-theme-500 hover:text-theme-600">
                  Forgot password?
                </a>
              </div>
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
                placeholder="Enter your password"
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
              <span>Sign In</span>
              <div className="w-1 h-4 bg-white/50 rounded-full"></div>
            </button>

            <div className="mt-6 text-center text-sm text-theme-600 dark:text-theme-400">
              New user?{" "}
              <a href="/auth/register" className="text-theme-500 hover:underline">
                Create an account
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
