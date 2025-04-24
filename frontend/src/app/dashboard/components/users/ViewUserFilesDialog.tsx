"use client";

import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FiX, FiFolder } from "react-icons/fi";
import { cn } from "@/utils/cn";
import FileViewer from "../files/FileViewer";
import { atom, useAtom } from "jotai";

export default function ViewUserFilesDialog({
  userId,
  username,
  sessionToken,
}: {
  userId: number;
  username: string;
  sessionToken: string;
}) {
  /* atom instead of useState */
  const [open, setOpen] = useAtom(useMemo(() => atom(false), []));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="px-3 py-1.5 rounded bg-theme-500 text-white hover:bg-theme-600"
          title="View this user's files"
        >
          <FiFolder className="inline mr-1 mb-0.5" />
          Files
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <Dialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-xl shadow-xl",
            "w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto p-6",
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Files of “{username}”</h3>
            <Dialog.Close asChild>
              <button className="p-2 rounded hover:bg-theme-200/50 dark:hover:bg-theme-800/50">
                <FiX className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <FileViewer
            fetchEndpoint={`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/users/${userId}/files`}
            sessionToken={sessionToken}
            readOnly={false}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
