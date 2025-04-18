"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import { FiCopy, FiDownload, FiTrash } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { FileItem } from "@/atoms/fileAtoms";

export default function BatchContextMenu({
  children,
  files,
  token, // reserved – not used yet
  onCopy,
  onDownloadZip,
  onDelete,
}: {
  children?: React.ReactNode;           // <-- now optional
  files: FileItem[];
  token: string | null;
  onCopy: () => void;
  onDownloadZip: () => void;
  onDelete: () => void;
}) {
  return (
    <ContextMenu.Root>
      {children && <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>}

      <ContextMenu.Content
        className={cn(
          "min-w-[180px] bg-theme-50 dark:bg-theme-900 p-1",
          "border border-theme-200 dark:border-theme-700 rounded-md shadow-lg z-50"
        )}
      >
        <CMItem onSelect={onCopy}>
          <FiCopy className="mr-2 shrink-0" /> Copy&nbsp;{files.length}&nbsp;URLs
        </CMItem>

        <CMItem onSelect={onDownloadZip}>
          <FiDownload className="mr-2 shrink-0" /> Download ZIP
        </CMItem>

        <ContextMenu.Separator className="h-px my-1 bg-theme-200 dark:bg-theme-700" />

        <CMItem
          onSelect={onDelete}
          className="text-red-600 dark:text-red-400"
        >
          <FiTrash className="mr-2 shrink-0" /> Delete&nbsp;{files.length}
        </CMItem>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

function CMItem({
  children,
  onSelect,
  className = "",
}: {
  children: React.ReactNode;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center px-2 py-1.5 text-sm rounded cursor-pointer outline-none",
        "text-theme-800 dark:text-theme-200 hover:bg-theme-200/50 dark:hover:bg-theme-800/50",
        className
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}
