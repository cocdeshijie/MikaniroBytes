"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAtom, atom } from "jotai";

const usernameAtom = atom("");
const passwordAtom = atom("");
const errorMsgAtom = atom("");

/**
 * Example Login Page with NextAuth credentials.
 */
export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [username, setUsername] = useAtom(usernameAtom);
  const [password, setPassword] = useAtom(passwordAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    try {
      // NextAuth credentials signIn
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false, // we'll handle the redirect manually
      });

      if (res?.error) {
        // e.g. "Invalid credentials"
        setErrorMsg(res.error);
        return;
      }

      // If login was successful, redirect to user dashboard
      router.push("/user");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Login failed.");
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
