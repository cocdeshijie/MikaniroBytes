"use client";

/* ------------------------------------------------------------------ */
/*                               IMPORTS                              */
/* ------------------------------------------------------------------ */
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { atom, useAtom } from "jotai";
import * as Select   from "@radix-ui/react-select";
import * as Checkbox from "@radix-ui/react-checkbox";
import { BiChevronDown, BiChevronUp, BiCheck } from "react-icons/bi";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";

/* ------------------------------------------------------------------ */
/*                               TYPES                                */
/* ------------------------------------------------------------------ */
interface GroupItem {
  id: number;
  name: string;
}
interface SystemSettingsData {
  registration_enabled   : boolean;
  public_upload_enabled  : boolean;
  default_user_group_id  : number | null;
  upload_path_template   : string;
}

/* ------------------------------------------------------------------ */
/*                               ATOMS                                */
/* ------------------------------------------------------------------ */
const loadingAtom = atom(false);
const errorAtom   = atom("");
const groupsAtom  = atom<GroupItem[]>([]);
const configAtom  = atom<SystemSettingsData>({
  registration_enabled  : true,
  public_upload_enabled : false,
  default_user_group_id : null,
  upload_path_template  : "{Y}/{m}",
});

/* ================================================================== */
export default function ConfigsTab() {
  const { data: session } = useSession();
  const { push }          = useToast();

  const [loading, setLoading] = useAtom(loadingAtom);
  const [errorMsg, setError]  = useAtom(errorAtom);
  const [groups, setGroups]   = useAtom(groupsAtom);
  const [config, setConfig]   = useAtom(configAtom);

  /* ---------------- fetch on mount / token change ---------------- */
  useEffect(() => {
    if (!session?.accessToken) return;
    fetchConfigAndGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  async function fetchConfigAndGroups() {
    setLoading(true);
    setError("");
    try {
      /* system settings */
      const sRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      if (!sRes.ok) throw new Error("Failed to fetch settings");
      setConfig(await sRes.json());

      /* groups */
      const gRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      if (!gRes.ok) throw new Error("Failed to fetch groups");
      const list: any[] = await gRes.json();
      const normal = list
        .filter((g) => !["SUPER_ADMIN", "GUEST"].includes(g.name))
        .map(({ id, name }) => ({ id, name }));
      setGroups(normal);

      /* ensure default id still valid */
      if (
        normal.length &&
        !normal.some((g) => g.id === config.default_user_group_id)
      ) {
        setConfig((p) => ({ ...p, default_user_group_id: normal[0].id }));
      }
    } catch (e: any) {
      setError(e.message || "Load error");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- handlers ---------------- */
  const toggleReg = (v: boolean) =>
    setConfig((p) => ({ ...p, registration_enabled: v }));
  const togglePub = (v: boolean) =>
    setConfig((p) => ({ ...p, public_upload_enabled: v }));
  const changeGroup = (v: string) =>
    setConfig((p) => ({ ...p, default_user_group_id: +v }));
  const changeTemplate = (v: string) =>
    setConfig((p) => ({ ...p, upload_path_template: v }));

  async function save() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/system-settings`,
        {
          method : "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization : `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify(config),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      setConfig(await res.json());
      push({ title: "Settings updated", variant: "success" });
    } catch (e: any) {
      setError(e.message || "Save error");
      push({ title: "Save failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  /* ================================================================= */
  /*                                UI                                 */
  /* ================================================================= */
  return (
    <div
      className={cn(
        "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
        "border border-theme-200/50 dark:border-theme-800/50"
      )}
    >
      <h3 className="text-lg font-medium mb-2">Site Configurations</h3>

      {errorMsg && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
          {errorMsg}
        </p>
      )}

      <div className="space-y-4 mb-6">
        {/* toggles */}
        <Toggle
          label="Registration Enabled"
          checked={config.registration_enabled}
          onChange={toggleReg}
        />
        <Toggle
          label="Public Upload Enabled"
          checked={config.public_upload_enabled}
          onChange={togglePub}
        />

        {/* default group */}
        {groups.length === 0 ? (
          <p className="text-red-500 text-sm">
            No normal groups found – create one first.
          </p>
        ) : (
          <div>
            <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
              Default User Group
            </label>
            <Select.Root
              value={(config.default_user_group_id ?? groups[0].id).toString()}
              onValueChange={changeGroup}
            >
              <Select.Trigger
                className={cn(
                  "inline-flex items-center justify-between w-full px-3 py-2 rounded border",
                  "border-theme-200 dark:border-theme-700 bg-theme-50 dark:bg-theme-800"
                )}
              >
                <Select.Value />
                <Select.Icon>
                  <BiChevronDown className="h-4 w-4" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  side="bottom"
                  className={cn(
                    "overflow-hidden rounded-lg shadow-lg z-50 bg-theme-50 dark:bg-theme-900",
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
                          "flex items-center px-3 py-2 text-sm cursor-pointer",
                          "radix-state-checked:bg-theme-200 dark:radix-state-checked:bg-theme-700"
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

        {/* ─────────────── Upload path template ─────────────── */}
        <div>
          <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
            Upload path template
          </label>
          <input
            type="text"
            value={config.upload_path_template}
            onChange={(e) => changeTemplate(e.target.value)}
            placeholder="{Y}/{m}"
            className={cn(
              "w-full px-3 py-2 rounded",
              "bg-theme-50 dark:bg-theme-800",
              "border border-theme-200 dark:border-theme-700",
              "focus:border-theme-500 focus:outline-none",
              "transition-colors duration-200",
              "text-theme-900 dark:text-theme-100"
            )}
          />
          <p className="mt-1 text-xs text-theme-500 dark:text-theme-400">
            Use&nbsp;
            <code className="font-mono">{'{Y}'}</code>,&nbsp;
            <code className="font-mono">{'{m}'}</code>,&nbsp;
            <code className="font-mono">{'{d}'}</code>,&nbsp;
            <code className="font-mono">{'{slug}'}</code> etc.&nbsp;for dynamic
            folders.
          </p>
        </div>
      </div>

      <button
        disabled={loading}
        onClick={save}
        className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600 disabled:bg-theme-300"
      >
        {loading ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                              TOGGLE                                */
/* ------------------------------------------------------------------ */
/** Radix-checkbox based toggle used for boolean site config options */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-theme-700 dark:text-theme-300">
        {label}
      </label>

      {/* Radix checkbox */}
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className={cn(
          "h-5 w-5 shrink-0 rounded border",
          "border-theme-400 dark:border-theme-600 bg-white dark:bg-theme-800",
          "flex items-center justify-center",
          "data-[state=checked]:bg-theme-500",
          "cursor-pointer"
        )}
      >
        <Checkbox.Indicator>
          <BiCheck className="h-4 w-4 text-white" />
        </Checkbox.Indicator>
      </Checkbox.Root>
    </div>
  );
}

