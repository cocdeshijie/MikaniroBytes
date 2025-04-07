"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { atom, useAtom } from "jotai";
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

/** Jotai atoms for local state */
const loadingAtom = atom(false);
const errorMsgAtom = atom("");
const successMsgAtom = atom("");
const hasFetchedAtom = atom(false);

/** The system config data */
const configAtom = atom<SystemSettingsData>({
  registration_enabled: true,
  public_upload_enabled: false,
  default_user_group_id: null,
});

/** The list of valid groups to choose from (excluding SUPER_ADMIN). */
const groupsAtom = atom<GroupItem[]>([]);

export default function ConfigsTab() {
  const { data: session } = useSession();

  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);
  const [successMsg, setSuccessMsg] = useAtom(successMsgAtom);
  const [hasFetched, setHasFetched] = useAtom(hasFetchedAtom);

  const [config, setConfig] = useAtom(configAtom);
  const [groups, setGroups] = useAtom(groupsAtom);

  // On mount (once), fetch system settings + group list.
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
      // 1) Fetch system-settings
      let res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`,
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch system settings");
      }
      const settingsData: SystemSettingsData = await res.json();
      setConfig(settingsData);

      // 2) Fetch groups
      res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch groups");
      }
      const groupData: any[] = await res.json();

      // Filter out SUPER_ADMIN from the list:
      const minimal = groupData
        .filter((g) => g.name !== "SUPER_ADMIN") // remove super admin
        .map((g) => ({
          id: g.id,
          name: g.name,
        }));

      setGroups(minimal);

      // If the server's default_user_group_id is pointing to SUPER_ADMIN or null
      // and we have at least one normal group, we might want to force an update
      // so the UI doesn't get stuck with an invalid group. Up to you:
      if (
        settingsData.default_user_group_id &&
        minimal.length > 0 &&
        !minimal.some((m) => m.id === settingsData.default_user_group_id)
      ) {
        // the existing default is not in the new list => pick the first group or none
        setConfig((prev) => ({
          ...prev,
          default_user_group_id: minimal[0].id, // force to first
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  // Toggling registration
  function handleToggleRegistration(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({
      ...prev,
      registration_enabled: e.target.checked,
    }));
  }

  // Toggling public upload
  function handleTogglePublicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({
      ...prev,
      public_upload_enabled: e.target.checked,
    }));
  }

  // Changing default user group
  function handleGroupChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = parseInt(e.target.value, 10);
    setConfig((prev) => ({
      ...prev,
      default_user_group_id: val,
    }));
  }

  // Save changes => PUT /admin/system-settings
  async function handleSaveChanges() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify(config),
        }
      );
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

        {/* Default user group (excluding SUPER_ADMIN). No "None" option. */}
        {groups.length === 0 ? (
          <p className="text-red-500 text-sm">
            No normal groups found! Please create a group besides SUPER_ADMIN.
          </p>
        ) : (
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
              value={config.default_user_group_id ?? groups[0]?.id}
              onChange={handleGroupChange}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
