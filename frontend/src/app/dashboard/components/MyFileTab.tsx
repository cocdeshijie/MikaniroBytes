"use client";

import { useSession } from "next-auth/react";
import FileViewer from "./files/FileViewer";

export default function MyFileTab() {
  const { data: session } = useSession();

  return (
    <FileViewer
      title="My Files"
      fetchEndpoint={`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/my-files`}
      sessionToken={session?.accessToken}
      readOnly={false}
    />
  );
}
