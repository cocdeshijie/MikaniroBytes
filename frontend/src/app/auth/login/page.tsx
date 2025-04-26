"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { atom, useAtom } from "jotai";
import * as Form from "@radix-ui/react-form";
import { cn } from "@/utils/cn";
import { useAuth } from "@/lib/auth";

const usernameAtom = atom("");
const passwordAtom = atom("");

export default function LoginPage() {
  const router = useRouter();
  const { push } = useToast();
  const { login } = useAuth(); // Jotai-based auth

  const [username, setUser] = useAtom(usernameAtom);
  const [password, setPass] = useAtom(passwordAtom);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    try {
      // 1) call our new login method
      await login(username, password);
      // 2) success => show toast and go to profile or wherever
      push({ title: "Welcome back!", variant: "success" });
      router.push("/profile");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      push({
        title: "Login Error",
        description: msg,
        variant: "error",
      });
    }
  }

  /* ----------------------------- UI ------------------------------- */
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

        {/* ---------------- Radix Form ---------------- */}
        <Form.Root
          onSubmit={handleLogin}
          className={cn(
            "bg-white dark:bg-theme-900",
            "rounded-xl overflow-hidden",
            "shadow-sm hover:shadow-md transition-all duration-300"
          )}
        >
          <div className="p-8 space-y-6">
            {/* ------------ Username ------------ */}
            <Form.Field name="username">
              <Form.Label className="block mb-2 text-sm font-medium text-theme-500">
                Username
              </Form.Label>
              <Form.Control asChild>
                <input
                  id="username"
                  required
                  className={cn(
                    "w-full px-4 py-3 rounded-lg",
                    "bg-theme-50 dark:bg-theme-800",
                    "border border-theme-200 dark:border-theme-700",
                    "focus:border-theme-500 focus:outline-none",
                    "transition-colors duration-200",
                    "text-theme-900 dark:text-theme-100"
                  )}
                  value={username}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="Enter your username"
                />
              </Form.Control>
            </Form.Field>

            {/* ------------ Password ------------ */}
            <Form.Field name="password">
              <div className="flex items-center justify-between mb-2">
                <Form.Label className="text-sm font-medium text-theme-500">
                  Password
                </Form.Label>
              </div>
              <Form.Control asChild>
                <input
                  id="password"
                  type="password"
                  required
                  className={cn(
                    "w-full px-4 py-3 rounded-lg",
                    "bg-theme-50 dark:bg-theme-800",
                    "border border-theme-200 dark:border-theme-700",
                    "focus:border-theme-500 focus:outline-none",
                    "transition-colors duration-200",
                    "text-theme-900 dark:text-theme-100"
                  )}
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Enter your password"
                />
              </Form.Control>
            </Form.Field>

            {/* ------------ Submit ------------ */}
            <Form.Submit asChild>
              <button
                type="submit"
                className={cn(
                  "w-full py-3 px-6 rounded-lg mt-2",
                  "bg-theme-500 hover:bg-theme-600 active:bg-theme-700",
                  "text-white font-medium",
                  "transition-all duration-200",
                  "flex items-center justify-center gap-2"
                )}
              >
                Sign In
              </button>
            </Form.Submit>

            <div className="mt-6 text-center text-sm text-theme-600 dark:text-theme-400">
              New user?{" "}
              <a
                href="/auth/register"
                className="text-theme-500 hover:underline"
              >
                Create an account
              </a>
            </div>
          </div>
        </Form.Root>
      </div>
    </div>
  );
}
