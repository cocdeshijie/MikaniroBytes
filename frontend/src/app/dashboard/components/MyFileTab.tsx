"use client";

import { useSession } from "next-auth/react";
import { NEXT_PUBLIC_BACKEND_URL } from "@/lib/env";
import FileViewer from "./files/FileViewer";
import BulkUpload from "./files/BulkUpload";

export default function MyFileTab() {
  const { data: session } = useSession();

  return (
    <>
      {/* existing file viewer */}
      <FileViewer
        title="My Files"
        fetchEndpoint={`${NEXT_PUBLIC_BACKEND_URL}/files/my-files`}
        sessionToken={session?.accessToken}
        readOnly={false}
      />

      {/* new Bulk-Upload widget */}
      <BulkUpload />
    </>
  );
}
