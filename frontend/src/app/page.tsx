"use client";

import Image from "next/image";
import { useAtom } from "jotai";
import { tokenAtom } from "@/atoms/auth";
import Link from "next/link";

export default function Home() {
  const [token] = useAtom(tokenAtom);

  return (
    <div className="relative min-h-screen bg-theme-50 dark:bg-theme-950">

      {/* Hero section */}
      <div className="flex flex-col items-center justify-center px-6 py-20 sm:py-32">
        <Image
          className="dark:invert mb-8"
          src="https://nextjs.org/icons/next.svg"
          alt="Next.js logo"
          width={200}
          height={40}
          priority
        />

        <h1 className="text-4xl font-extrabold text-center text-theme-900 dark:text-theme-100 mb-4">
          Welcome to FileBed!
        </h1>
        <p className="max-w-2xl text-center text-theme-700 dark:text-theme-300 text-lg mb-8">
          Host and manage your files with the power of FastAPI + Next.js.
        </p>

        {/* CTA buttons */}
        <div className="flex gap-4">
          {!token ? (
            <>
              <Link
                href="/login"
                className="px-6 py-3 bg-theme-500 text-white rounded-full shadow hover:bg-theme-600 transition-colors"
              >
                Login
              </Link>
              <Link
                href="#features"
                className="px-6 py-3 bg-white dark:bg-theme-900 rounded-full
                          text-theme-800 dark:text-theme-200
                          ring-1 ring-theme-600/30 dark:ring-theme-300/20
                          hover:bg-theme-100 dark:hover:bg-theme-800
                          transition-colors"
              >
                Learn More
              </Link>
            </>
          ) : (
            <Link
              href="/user"
              className="px-6 py-3 bg-theme-500 text-white rounded-full shadow hover:bg-theme-600 transition-colors"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Features section (anchor = #features) */}
      <div
        id="features"
        className="bg-theme-100 dark:bg-theme-900 py-10 px-6 min-h-[40vh]"
      >
        <h2 className="text-2xl font-semibold mb-6 text-theme-900 dark:text-theme-100">
          Features
        </h2>
        <ul className="list-disc list-inside space-y-3 text-theme-700 dark:text-theme-300">
          <li>Upload and manage files locally or in the cloud</li>
          <li>Support for multiple file types (images, videos, etc.)</li>
          <li>Flexible user roles and permissions</li>
          <li>Seamless integration with Next.js front-end</li>
          <li>Powered by FastAPI for high-performance backend</li>
        </ul>
      </div>

      {/* Footer */}
      <footer
        className="text-center py-4 bg-theme-50 dark:bg-theme-950
                   text-theme-600 dark:text-theme-400"
      >
        <p>
          Made with&nbsp;
          <span className="text-red-500">&hearts;</span>
          &nbsp; by You
        </p>
      </footer>
    </div>
  );
}
