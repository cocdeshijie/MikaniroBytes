"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { atom, useAtom } from "jotai";
import * as Checkbox from "@radix-ui/react-checkbox";
import { BiCheck, BiLoader } from "react-icons/bi";
import { cn } from "@/utils/cn";
import { useToast } from "@/lib/toast";
import { api, ApiError } from "@/lib/api";
import { Select, SelectOption } from "@/components/ui/Select";

/* ---------- TYPES ---------- */
interface GroupItem { id: number; name: string }
interface SystemSettingsData {
  registration_enabled: boolean;
  public_upload_enabled: boolean;
  default_user_group_id: number | null;
  upload_path_template: string;
}
interface GroupResponse {
  id: number;
  name: string;
  settings?: {
    allowed_extensions: string[];
    max_file_size: number | null;
    max_storage_size: number | null;
  };
}

/* ---------- ATOMS ---------- */
const loadingA    = atom(false);      // true while network in‑flight (cold load OR save)
const refreshingA = atom(false);      // true during background cache refresh
const errorA      = atom("");
const groupsA     = atom<GroupItem[]>([]);
const configA     = atom<SystemSettingsData>({
  registration_enabled  : true,
  public_upload_enabled : false,
  default_user_group_id : null,
  upload_path_template  : "{Y}/{m}",
});

/* =================================================================== */
export default function ConfigsTab() {
  const { data: session } = useSession();
  const { push }          = useToast();

  const [loading, setLoading]     = useAtom(loadingA);
  const [refreshing, setRefresh]  = useAtom(refreshingA);
  const [errorMsg, setError]      = useAtom(errorA);
  const [groups, setGroups]       = useAtom(groupsA);
  const [config, setConfig]       = useAtom(configA);

  const firstLoadRef = useRef(true);

  /* ---------- fetch whenever page mounts OR user token changes ------ */
  useEffect(() => {
    if (!session?.accessToken) return;
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  async function fetchAll() {
    if (firstLoadRef.current && groups.length === 0) {
      setLoading(true);
    } else {
      setRefresh(true);
    }
    setError("");
    try {
      const [settings, raw] = await Promise.all([
        api<SystemSettingsData>("/admin/system-settings", { token: session?.accessToken }),
        api<GroupResponse[]>("/admin/groups", { token: session?.accessToken }), // Replace any[] with GroupResponse[]
      ]);

      setConfig(settings);

      const normal = raw
        .filter((g) => !["SUPER_ADMIN", "GUEST"].includes(g.name))
        .map(({ id, name }) => ({ id, name }));
      setGroups(normal);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Load error");
    } finally {
      setLoading(false);
      setRefresh(false);
      firstLoadRef.current = false;
    }
  }

  /* ---------- keep default_user_group_id valid when list changes ---- */
  useEffect(() => {
    if (!groups.length) return;
    setConfig((prev) => {
      if (prev.default_user_group_id && groups.some(g => g.id === prev.default_user_group_id)) {
        return prev;
      }
      return { ...prev, default_user_group_id: groups[0].id };
    });
  }, [groups, setConfig]);

  /* ---------- setters ---------- */
  const toggleReg      = (v:boolean)=>setConfig((p)=>({ ...p, registration_enabled:v }));
  const togglePub      = (v:boolean)=>setConfig((p)=>({ ...p, public_upload_enabled:v }));
  const changeGroup    = (v:string) =>setConfig((p)=>({ ...p, default_user_group_id:+v }));
  const changeTemplate = (v:string) =>setConfig((p)=>({ ...p, upload_path_template:v }));

  /* ---------- save ---------- */
  async function save() {
    setLoading(true); setError("");
    try {
      const updated = await api<SystemSettingsData>(
        "/admin/system-settings",
        { method:"PUT", token: session?.accessToken, json: config },
      );
      setConfig(updated);
      push({ title: "Settings updated", variant: "success" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save error");
      push({ title: "Save failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  /* ---------- skeleton ---------- */
  const Skeleton = useMemo(() => (
    <div className="space-y-3 animate-pulse">
      {Array.from({length:4}).map((_ ,i)=>(<div key={i} className="h-10 w-full bg-theme-300/40 rounded" />))}
    </div>
  ),[]);

  /* ---------- Select options ---------- */
  const groupOptions: SelectOption[] = groups.map((g) => ({
    value: g.id.toString(),
    label: g.name,
  }));

  /* shortcut to earliest valid default id */
  const defaultId = groups.length ? (config.default_user_group_id ?? groups[0].id) : "";

  /* ------------------------------------------------------------------ */
  return (
    <div className={cn(
      "p-4 bg-theme-100/25 dark:bg-theme-900/25 rounded-lg",
      "border border-theme-200/50 dark:border-theme-800/50",
      "relative",
    )}>
      {/* overlay spinner when refreshing */}
      {refreshing && (
        <div className="absolute inset-0 bg-theme-50/60 dark:bg-theme-800/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <BiLoader className="w-6 h-6 animate-spin text-theme-500" />
        </div>
      )}

      <h3 className="text-lg font-medium mb-2">Site Configurations</h3>

      {errorMsg && (
        <p className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 mb-4 rounded">
          {errorMsg}
        </p>
      )}

      {loading && groups.length === 0 ? (
        Skeleton
      ) : (
        <>
          <div className="space-y-4 mb-6">
            <Toggle label="Registration Enabled" checked={config.registration_enabled} onChange={toggleReg}/>
            <Toggle label="Public Upload Enabled" checked={config.public_upload_enabled} onChange={togglePub}/>

            {/* default group select */}
            <div>
              <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
                Default User Group
              </label>
              <Select
                value={defaultId.toString()}
                onValueChange={changeGroup}
                options={groupOptions}
                minWidth="100%"
              />
            </div>

            {/* upload path */}
            <div>
              <label className="block mb-1 text-sm text-theme-600 dark:text-theme-400">
                Upload path template
              </label>
              <input
                type="text"
                value={config.upload_path_template}
                onChange={(e)=>changeTemplate(e.target.value)}
                placeholder="{Y}/{m}"
                className={cn(
                  "w-full px-3 py-2 rounded",
                  "bg-theme-50 dark:bg-theme-800",
                  "border border-theme-200 dark:border-theme-700",
                  "focus:border-theme-500 focus:outline-none",
                )}
              />
              <p className="mt-1 text-xs text-theme-500 dark:text-theme-400">
                Use&nbsp;<code>{`{Y}`}</code>,&nbsp;<code>{`{m}`}</code>,&nbsp;<code>{`{d}`}</code>,&nbsp;<code>{`{slug}`}</code> …
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
        </>
      )}
    </div>
  );
}

/* ---------- tiny Toggle component ---------- */
function Toggle({
  label, checked, onChange,
}: { label:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-theme-700 dark:text-theme-300">{label}</label>
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(v)=>onChange(!!v)}
        className={cn(
          "h-5 w-5 shrink-0 rounded border cursor-pointer",
          "border-theme-400 dark:border-theme-600 bg-white dark:bg-theme-800",
          "flex items-center justify-center",
          "data-[state=checked]:bg-theme-500",
        )}
      >
        <Checkbox.Indicator>
          <BiCheck className="h-4 w-4 text-white" />
        </Checkbox.Indicator>
      </Checkbox.Root>
    </div>
  );
}
