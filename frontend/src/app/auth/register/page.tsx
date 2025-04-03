"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
        redirect: false, // we’ll handle redirect manually
      });

      if (loginResult?.error) {
        // If signIn failed for some reason (shouldn't happen if password is correct)
        throw new Error(loginResult.error);
      }

      // 3) If signIn was successful, go to /user
      router.push("/user");
    } catch (err: any) {
      setErrorMsg(err.message || "Registration error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-50 dark:bg-theme-950 p-4">
      <form
        onSubmit={handleRegister}
        className="max-w-sm w-full bg-white dark:bg-theme-900 p-6 rounded shadow-md"
      >
        <h1 className="text-xl font-bold mb-4 text-theme-900 dark:text-theme-100">
          Register
        </h1>

        {errorMsg && (
          <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">
            {errorMsg}
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

        <div className="mb-4">
          <label
            htmlFor="email"
            className="block mb-1 text-theme-700 dark:text-theme-300"
          >
            Email (optional)
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-3 py-2 border border-theme-200 rounded dark:bg-theme-800 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          Create Account
        </button>
      </form>
    </div>
  );
}
