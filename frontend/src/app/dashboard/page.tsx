"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/files");
  }, [router]);

  return null; // or a loading indicator
}
