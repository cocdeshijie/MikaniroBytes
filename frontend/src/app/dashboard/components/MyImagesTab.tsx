"use client";

import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";
import { useCallback } from "react";

const imagesAtom = atom([
  { id: 1, name: "cat.jpg", url: "https://example.com/cat.jpg" },
  { id: 2, name: "dog.png", url: "https://example.com/dog.png" },
]);

export default function MyImagesTab() {
  const [images] = useAtom(imagesAtom);

  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Copied image URL to clipboard!");
    } catch {
      alert("Failed to copy.");
    }
  }, []);

  return (
    <div>
      <h2
        className={cn(
          "text-xl font-semibold mb-4",
          "text-theme-900 dark:text-theme-100",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        My Images
      </h2>
      <p className="text-theme-600 dark:text-theme-400 mb-6">
        (Placeholder) Below is a mock list of images. Click to copy URL.
      </p>

      <div className="space-y-4">
        {images.map((img) => (
          <div
            key={img.id}
            onClick={() => copyUrl(img.url)}
            className={cn(
              "border border-theme-200/50 dark:border-theme-800/50 rounded-lg",
              "p-4 bg-theme-100/25 dark:bg-theme-900/25",
              "transition-all duration-200 hover:shadow-md cursor-pointer"
            )}
          >
            <p className="font-medium text-theme-700 dark:text-theme-300 mb-1">
              {img.name}
            </p>
            <p className="text-sm text-theme-500 dark:text-theme-400 break-all">
              {img.url}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
