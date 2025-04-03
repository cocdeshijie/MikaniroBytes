"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="relative min-h-screen bg-theme-50 dark:bg-theme-950">
      {/* Hero section */}
      <div className="flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="mb-10 flex flex-col items-center">
          <h1 className={cn(
            "text-3xl sm:text-4xl font-extrabold text-center",
            "text-theme-900 dark:text-theme-100",
            "flex items-center flex-wrap justify-center gap-2 mb-4"
          )}>
            Welcome to FileBed
            <div className="h-1 w-16 bg-theme-500 rounded-full inline-block ml-2"></div>
          </h1>
          <p className="max-w-2xl text-center text-theme-700 dark:text-theme-300 text-lg mb-8">
            Host and manage your files with the power of FastAPI + Next.js.
          </p>
        </div>

        {/* Upload placeholder area */}
        <div className="w-full max-w-3xl mx-auto mb-16">
          <div className={cn(
            "bg-white dark:bg-theme-900",
            "rounded-xl overflow-hidden",
            "shadow-sm hover:shadow-md transition-all duration-300",
            "border border-dashed border-theme-300 dark:border-theme-700"
          )}>
            <div className={cn(
              "border-b border-theme-100 dark:border-theme-800 px-6 py-4",
              "flex items-center justify-between"
            )}>
              <h2 className="text-lg font-medium text-theme-900 dark:text-theme-100">
                Upload File
              </h2>
              <div className="h-1 w-8 bg-theme-500 rounded-full"></div>
            </div>

            <div className="p-8">
              <div className={cn(
                "h-48 flex flex-col items-center justify-center",
                "border-2 border-dashed border-theme-200 dark:border-theme-700",
                "rounded-lg text-center px-4",
                "bg-theme-50/50 dark:bg-theme-800/30",
                "cursor-pointer hover:bg-theme-100/50 dark:hover:bg-theme-800/50",
                "transition-colors duration-200"
              )}>
                <svg
                  className="w-16 h-16 text-theme-400 dark:text-theme-600 mb-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-theme-700 dark:text-theme-300 text-lg font-medium mb-1">
                  Drag and drop files here
                </p>
                <p className="text-theme-500 dark:text-theme-400 text-sm">
                  or click to browse your device
                </p>
              </div>

              <div className="mt-4 text-center">
                <div className={cn(
                  "inline-flex items-center justify-center",
                  "px-6 py-3 rounded-lg",
                  "bg-theme-500 hover:bg-theme-600 active:bg-theme-700",
                  "text-white font-medium",
                  "transition-all duration-200",
                  "cursor-not-allowed opacity-75",
                  "flex gap-2"
                )}>
                  <span>Upload</span>
                  <div className="w-1 h-4 bg-white/50 rounded-full"></div>
                </div>
                <p className="text-sm text-theme-500 dark:text-theme-400 mt-2">
                  Upload coming soon!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Learn more link */}
        <Link
          href="#features"
          className={cn(
            "inline-flex items-center px-6 py-3",
            "bg-white dark:bg-theme-900 rounded-lg",
            "text-theme-800 dark:text-theme-200",
            "border border-theme-200 dark:border-theme-700",
            "hover:bg-theme-100 dark:hover:bg-theme-800",
            "transition-colors"
          )}
        >
          Learn More
          <svg
            className="ml-2 w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>

      {/* Features section (anchor = #features) */}
      <div
        id="features"
        className="bg-white dark:bg-theme-900 py-16 px-6"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-10">
            <h2 className="text-2xl font-bold text-theme-900 dark:text-theme-100">
              Features
            </h2>
            <div className="h-1 w-16 bg-theme-500 rounded-full ml-4"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-theme-200 dark:border-theme-800 rounded-lg p-6">
              <div className="w-10 h-10 bg-theme-500/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-theme-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-theme-900 dark:text-theme-100 mb-2">
                Cloud Storage
              </h3>
              <p className="text-theme-700 dark:text-theme-300">
                Upload and manage files locally or in the cloud with easy access from anywhere.
              </p>
            </div>

            <div className="border border-theme-200 dark:border-theme-800 rounded-lg p-6">
              <div className="w-10 h-10 bg-theme-500/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-theme-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-theme-900 dark:text-theme-100 mb-2">
                Multi-Format Support
              </h3>
              <p className="text-theme-700 dark:text-theme-300">
                Support for multiple file types including images, videos, documents, and more.
              </p>
            </div>

            <div className="border border-theme-200 dark:border-theme-800 rounded-lg p-6">
              <div className="w-10 h-10 bg-theme-500/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-theme-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-theme-900 dark:text-theme-100 mb-2">
                Flexible Permissions
              </h3>
              <p className="text-theme-700 dark:text-theme-300">
                Manage user roles and permissions to control access to your files and folders.
              </p>
            </div>

            <div className="border border-theme-200 dark:border-theme-800 rounded-lg p-6">
              <div className="w-10 h-10 bg-theme-500/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-theme-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-theme-900 dark:text-theme-100 mb-2">
                Secure API Backend
              </h3>
              <p className="text-theme-700 dark:text-theme-300">
                Powered by FastAPI for high-performance, secure backend operations and data handling.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="text-center py-8 bg-theme-50 dark:bg-theme-950
                 text-theme-600 dark:text-theme-400 border-t border-theme-200 dark:border-theme-800"
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