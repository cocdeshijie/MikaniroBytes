"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import { NEXT_PUBLIC_BACKEND_URL } from "@/lib/env";
import { iconFor } from "@/utils/fileIcons";
import type { RemoteFile } from "./types";

/* convert possibly-relative backend path → absolute url */
const absolute = (link: string) => {
  const safe = link.startsWith("/") ? link : `/${link}`;
  return /^(https?:)?\/\//.test(link)
    ? link
    : `${NEXT_PUBLIC_BACKEND_URL}${safe}`;
};

/**
 * Pure thumbnail – memoised so React never re-creates the
 * underlying <img> element when the user clicks / drags.
 */
export const PreviewThumb = memo(
  function PreviewThumb({ file }: { file: RemoteFile }) {
    const Icon = useMemo(
      () => iconFor(file.original_filename || "file"),
      [file.original_filename],
    );

    if (file.has_preview && file.preview_url) {
      return (
        <Image
          unoptimized
          src={absolute(file.preview_url)}
          alt="Preview"
          width={64}
          height={64}
          loading="lazy"
          draggable={false}
          className="h-16 w-16 object-cover rounded-md pointer-events-none select-none"
        />
      );
    }

    return (
      <Icon className="w-16 h-16 text-theme-700 dark:text-theme-300 pointer-events-none" />
    );
  },
  (p, n) => p.file.preview_url === n.file.preview_url,
);
