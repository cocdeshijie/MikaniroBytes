"use client";

import { FormEvent, useEffect } from "react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  usernameAtom,
  passwordAtom,
  tokenAtom,
  loginErrorAtom,
} from "@/atoms/auth";

/**
 * Example Login Page using Jotai.
 * Adjust styling & classes to match your existing UI approach.
 */
export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useAtom(usernameAtom);
  const [password, setPassword] = useAtom(passwordAtom);
  const [token, setToken] = useAtom(tokenAtom);
  const [loginError, setLoginError] = useAtom(loginErrorAtom);

  // If we already have a token in memory, redirect to /user
  useEffect(() => {
    if (token) {
      router.replace("/user");
    }
  }, [token, router]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(""); // clear any old errors

    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials or server error");
      }

      const data = await response.json();
      // Example data: { access_token: "...", token_type: "bearer" }

      // Put token in Jotai store
      setToken(data.access_token);

      // Optional: also store token in localStorage so user remains logged in on reload
      localStorage.setItem("token", data.access_token);

      // Clear fields
      setUsername("");
      setPassword("");

      // Redirect to user dashboard
      router.push("/user");
    } catch (err: any) {
      setLoginError(err?.message ?? "Login failed.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950 p-4">
      <form
        onSubmit={handleLogin}
        className="max-w-sm w-full bg-white dark:bg-theme-900 p-6 rounded shadow-md"
      >
        <h1 className="text-xl font-bold mb-4 text-theme-900 dark:text-theme-100">
          Login
        </h1>

        {loginError && (
          <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">
            {loginError}
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="username"
            className="block mb-1 text-theme-700 dark:text-theme-300"
          >
            Username
          </label>
          <input
            id="username"
            className="w-full px-3 py-2 border border-theme-200 rounded dark:bg-theme-800 focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="password"
            className="block mb-1 text-theme-700 dark:text-theme-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full px-3 py-2 border border-theme-200 rounded dark:bg-theme-800 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-theme-500 text-white rounded hover:bg-theme-600 transition-colors"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
