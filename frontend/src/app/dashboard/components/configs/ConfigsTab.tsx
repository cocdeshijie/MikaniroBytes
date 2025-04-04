"use client";

import { cn } from "@/utils/cn";

export default function ConfigsTab() {
  return (
    <div
      className={cn(
        "p-4 bg-theme-100/25 dark:bg-theme-900/25",
        "rounded-lg border border-theme-200/50 dark:border-theme-800/50"
      )}
    >
      <h3 className="text-lg font-medium text-theme-700 dark:text-theme-300 mb-2">
        Site Configurations
      </h3>
      <p className="text-sm text-theme-500 dark:text-theme-400">
        (Placeholder) Adjust site-wide settings, etc.
      </p>
    </div>
  );
}
