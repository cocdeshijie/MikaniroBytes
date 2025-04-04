"use client";

import { cn } from "@/utils/cn";
import GroupsTab from "./groups/GroupsTab";
import UsersTab from "./users/UsersTab";
import ConfigsTab from "./configs/ConfigsTab";

export default function SiteSettingsTab({
  currentSubTab,
}: {
  currentSubTab: string;
}) {
  return (
    <div>
      <h2
        className={cn(
          "text-xl font-semibold mb-4",
          "text-theme-900 dark:text-theme-100",
          "border-b border-theme-200 dark:border-theme-800 pb-2"
        )}
      >
        Site Settings
      </h2>
      {currentSubTab === "groups" && <GroupsTab />}
      {currentSubTab === "users" && <UsersTab />}
      {currentSubTab === "configs" && <ConfigsTab />}
    </div>
  );
}
