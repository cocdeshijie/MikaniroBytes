"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { atom, useAtom } from "jotai";
import * as Select from "@radix-ui/react-select";
import { BiChevronDown, BiChevronUp, BiCheck } from "react-icons/bi";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider"; // ★ NEW

interface GroupItem {
  id: number;
  name: string;
}

interface SystemSettingsData {
  registration_enabled: boolean;
  public_upload_enabled: boolean;
  default_user_group_id: number | null;
}

/* ---------- Jotai atoms ---------- */
const loadingAtom = atom(false);
const errorMsgAtom = atom("");
const hasFetchedAtom = atom(false);

const configAtom = atom<SystemSettingsData>({
  registration_enabled: true,
  public_upload_enabled: false,
  default_user_group_id: null,
});

const groupsAtom = atom<GroupItem[]>([]);

export default function ConfigsTab() {
  const { data: session } = useSession();
  const { push } = useToast(); // ★ NEW

  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setErrorMsg] = useAtom(errorMsgAtom);
  const [hasFetched, setHasFetched] = useAtom(hasFetchedAtom);

  const [config, setConfig] = useAtom(configAtom);
  const [groups, setGroups] = useAtom(groupsAtom);

  /* ---------- initial fetch ---------- */
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!hasFetched) {
      fetchConfigAndGroups();
      setHasFetched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, hasFetched]);

  async function fetchConfigAndGroups() {
    setLoading(true);
    setErrorMsg("");
    try {
      /* 1) system‑settings */
      let res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch system settings");
      }
      const settingsData: SystemSettingsData = await res.json();
      setConfig(settingsData);

      /* 2) groups list */
      res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch groups");
      }
      const groupData: any[] = await res.json();

      /* remove SUPER_ADMIN */
      const minimal = groupData
        .filter((g) => g.name !== "SUPER_ADMIN")
        .map(({ id, name }) => ({ id, name }));
      setGroups(minimal);

      /* ensure default group id is valid */
      if (
        settingsData.default_user_group_id &&
        minimal.length > 0 &&
        !minimal.some((g) => g.id === settingsData.default_user_group_id)
      ) {
        setConfig((prev) => ({
          ...prev,
          default_user_group_id: minimal[0].id,
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- local handlers ---------- */
  const handleToggleRegistration = (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((p) => ({ ...p, registration_enabled: e.target.checked }));

  const handleTogglePublicUpload = (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((p) => ({ ...p, public_upload_enabled: e.target.checked }));

  const handleGroupChange = (val: string) =>
    setConfig((p) => ({ ...p, default_user_group_id: parseInt(val, 10) }));

  /* ---------- save ---------- */
  async function handleSaveChanges() {
    setLoading(true);
    setErrorMsg("");
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
      push({ title: "Settings updated", variant: "success" }); // ★
    } catch (err: any) {
      setErrorMsg(err.message || "Error saving settings");
      push({ title: "Save failed", variant: "error" }); // ★
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*                                UI                                  */
  /* ------------------------------------------------------------------ */
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

      <div className="space-y-4 mb-6">
        {/* registration toggle */}
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

        {/* public upload toggle */}
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

        {/* default user group (Radix Select) */}
        {groups.length === 0 ? (
          <p className="text-red-500 text-sm">
            No normal groups found! Please create a group besides SUPER_ADMIN.
          </p>
        ) : (
          <div>
            <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
              Default User Group
            </label>

            <Select.Root
              value={(config.default_user_group_id ?? groups[0].id).toString()}
              onValueChange={handleGroupChange}
            >
              <Select.Trigger
                className={cn(
                  "inline-flex items-center justify-between w-full px-3 py-2 rounded border",
                  "border-theme-200 dark:border-theme-700",
                  "bg-theme-50 dark:bg-theme-800",
                  "text-theme-900 dark:text-theme-100",
                  "focus:outline-none focus:ring-2 focus:ring-theme-500/50"
                )}
              >
                <Select.Value />
                <Select.Icon>
                  <BiChevronDown className="h-4 w-4 text-theme-500" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  side="bottom"
                  className={cn(
                    "overflow-hidden rounded-lg shadow-lg z-50",
                    "bg-theme-50 dark:bg-theme-900",
                    "border border-theme-200 dark:border-theme-700"
                  )}
                >
                  <Select.ScrollUpButton className="flex items-center justify-center py-1">
                    <BiChevronUp />
                  </Select.ScrollUpButton>

                  <Select.Viewport className="max-h-60">
                    {groups.map((g) => (
                      <Select.Item
                        key={g.id}
                        value={g.id.toString()}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm select-none cursor-pointer",
                          "text-theme-700 dark:text-theme-300",
                          "radix-state-checked:bg-theme-200 dark:radix-state-checked:bg-theme-700",
                          "hover:bg-theme-100 dark:hover:bg-theme-800"
                        )}
                      >
                        <Select.ItemText>{g.name}</Select.ItemText>
                        <Select.ItemIndicator className="ml-auto">
                          <BiCheck />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>

                  <Select.ScrollDownButton className="flex items-center justify-center py-1">
                    <BiChevronDown />
                  </Select.ScrollDownButton>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
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
