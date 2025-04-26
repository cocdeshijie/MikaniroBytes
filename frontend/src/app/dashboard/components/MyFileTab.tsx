"use client";

import { NEXT_PUBLIC_BACKEND_URL } from "@/lib/env";
import FileViewer from "./files/FileViewer";
import BulkUpload from "./files/BulkUpload";
import { useAuth } from "@/lib/auth";

/**
 * Replaces the old next-auth usage with your custom Jotai-based token.
 */
export default function MyFileTab() {
  const { token } = useAuth();

  return (
    <>
      {/* existing file viewer */}
      <FileViewer
        title="My Files"
        fetchEndpoint={`${NEXT_PUBLIC_BACKEND_URL}/files/my-files`}
        sessionToken={token ?? undefined}
        readOnly={false}
      />

      {/* new Bulk-Upload widget */}
      <BulkUpload />
    </>
  );
}
