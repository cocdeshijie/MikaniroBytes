"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/utils/cn";

interface GroupItem {
  id: number;
  name: string;
}

interface SystemSettingsData {
  registration_enabled: boolean;
  public_upload_enabled: boolean;
  default_user_group_id: number | null;
}

export default function ConfigsTab() {
  const { data: session } = useSession();

  // Local states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // The config we're editing
  const [config, setConfig] = useState<SystemSettingsData>({
    registration_enabled: true,
    public_upload_enabled: false,
    default_user_group_id: null,
  });

  // List of groups to pick from
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  // On mount, fetch config & group list
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!hasFetched) {
      fetchConfigAndGroups();
      setHasFetched(true);
    }
  }, [session?.accessToken, hasFetched]);

  async function fetchConfigAndGroups() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      // 1) fetch system-settings
      let res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch system settings");
      }
      const settingsData: SystemSettingsData = await res.json();
      setConfig(settingsData);

      // 2) fetch groups (so we can choose default group)
      res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch groups");
      }
      const groupData: any[] = await res.json(); // shape = { id, name, ...}
      // For the dropdown, we only need {id, name}
      const minimal = groupData.map((g) => ({ id: g.id, name: g.name }));
      setGroups(minimal);
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  // Handle toggles
  function handleToggleRegistration(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({
      ...prev,
      registration_enabled: e.target.checked,
    }));
  }
  function handleTogglePublicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({
      ...prev,
      public_upload_enabled: e.target.checked,
    }));
  }
  function handleGroupChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = parseInt(e.target.value, 10);
    setConfig((prev) => ({
      ...prev,
      default_user_group_id: val >= 1 ? val : null,
    }));
  }

  // Save changes => PUT /admin/system-settings
  async function handleSaveChanges() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to update settings");
      }
      const updated: SystemSettingsData = await res.json();
      setConfig(updated);
      setSuccessMsg("Settings updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Error saving settings");
    } finally {
      setLoading(false);
    }
  }

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
      <p className="text-sm text-theme-500 dark:text-theme-400 mb-4">
        Control global site options like registration and default user group.
      </p>

      {errorMsg && (
        <div
          className={cn(
            "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
            "p-3 rounded mb-4 border border-red-200/50 dark:border-red-800/50"
          )}
        >
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          className={cn(
            "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
            "p-3 rounded mb-4 border border-green-200/50 dark:border-green-800/50"
          )}
        >
          {successMsg}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {/* Registration enabled toggle */}
        <div className="flex items-center space-x-3">
          <label
            htmlFor="registration_enabled"
            className="text-sm font-medium text-theme-700 dark:text-theme-300"
          >
            Registration Enabled
          </label>
          <input
            id="registration_enabled"
            type="checkbox"
            checked={config.registration_enabled}
            onChange={handleToggleRegistration}
            className="h-4 w-4 cursor-pointer"
          />
        </div>

        {/* Public upload toggle */}
        <div className="flex items-center space-x-3">
          <label
            htmlFor="public_upload_enabled"
            className="text-sm font-medium text-theme-700 dark:text-theme-300"
          >
            Public Upload Enabled
          </label>
          <input
            id="public_upload_enabled"
            type="checkbox"
            checked={config.public_upload_enabled}
            onChange={handleTogglePublicUpload}
            className="h-4 w-4 cursor-pointer"
          />
        </div>

        {/* Default user group */}
        <div>
          <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
            Default User Group
          </label>
          <select
            className={cn(
              "w-full px-3 py-2 rounded border",
              "border-theme-200 dark:border-theme-700",
              "bg-theme-50 dark:bg-theme-800 text-theme-900 dark:text-theme-100"
            )}
            value={config.default_user_group_id ?? ""}
            onChange={handleGroupChange}
          >
            <option value="">-- None --</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        disabled={loading}
        onClick={handleSaveChanges}
        className={cn(
          "px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600",
          "transition disabled:bg-theme-300"
        )}
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
