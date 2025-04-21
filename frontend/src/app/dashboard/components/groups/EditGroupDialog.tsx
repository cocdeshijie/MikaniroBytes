"use client";

import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";

interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number;
  max_storage_size: number | null;
}

/* util: “5gb” → bytes | null */
function parseSizeToBytes(input: string | number): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return input;
  const txt = input.trim().toLowerCase();
  if (!txt) return null;
  const m = txt.match(/^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (isNaN(n)) return null;
  const mul: Record<string, number> = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12 };
  return Math.round(n * mul[m[2] ?? "b"]);
}

export default function EditGroupDialog({
  group,
  sessionToken,
  onUpdated,
}: {
  group: GroupItem;
  sessionToken: string;
  onUpdated: (g: GroupItem) => void;
}) {
  const { push } = useToast();

  /* stable local atoms */
  const openA    = useMemo(() => atom(false), []);
  const nameA    = useMemo(() => atom(group.name), [group]);
  const allowA   = useMemo(() => atom(group.allowed_extensions.join(",")), [group]);
  const maxFA    = useMemo(() => atom(String(group.max_file_size ?? "")), [group]);
  const maxSA    = useMemo(() => atom(group.max_storage_size ?? ""), [group]);
  const errA     = useMemo(() => atom(""), []);
  const loadA    = useMemo(() => atom(false), []);

  const [open, setOpen]       = useAtom(openA);
  const [name, setName]       = useAtom(nameA);
  const [allow, setAllow]     = useAtom(allowA);
  const [maxF, setMaxF]       = useAtom(maxFA);
  const [maxS, setMaxS]       = useAtom(maxSA);
  const [err, setErr]         = useAtom(errA);
  const [loading, setLoading] = useAtom(loadA);

  /* ---------------- save ---------------- */
  async function handleSave() {
    setErr(""); setLoading(true);
    try {
      const finalName =
        group.name === "SUPER_ADMIN" ? "SUPER_ADMIN" : name.trim() || group.name;

      const exts = allow.trim() ? allow.split(",").map((x) => x.trim()).filter(Boolean) : [];

      const maxFileBytes  = parseSizeToBytes(maxF) ?? undefined;
      const maxStoreBytes = parseSizeToBytes(maxS);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups/${group.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            name: finalName,
            allowed_extensions: exts,
            max_file_size: maxFileBytes,
            max_storage_size: maxStoreBytes,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Update failed");
      }
      const updated: GroupItem = await res.json();
      onUpdated(updated);
      push({ title: "Group updated", variant: "success" });
      setOpen(false);
    } catch (e: any) {
      setErr(e.message); push({ title: "Update failed", variant: "error" });
    } finally { setLoading(false); }
  }

  /* ---------------- UI ---------------- */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="px-3 py-1.5 rounded text-white bg-theme-500 hover:bg-theme-600">
          Edit
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/30 backdrop-blur-sm fixed inset-0 z-50" />
        <Dialog.Content className={cn(
          "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6"
        )}>
          <Dialog.Title className="text-lg font-medium mb-2">
            Edit Group “{group.name}”
          </Dialog.Title>
          <Dialog.Description className="text-sm text-theme-600 dark:text-theme-400 mb-4">
            Leave <strong>Allowed Extensions</strong> blank to accept any type.
          </Dialog.Description>

          {err && (
            <p className="mb-3 p-3 rounded border border-red-500/50 text-red-600 text-sm">
              {err}
            </p>
          )}

          <div className="space-y-4">
            <Field label="Group Name">
              <input
                disabled={group.name === "SUPER_ADMIN"}
                value={name}
                onChange={(e)=>setName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                           bg-theme-50 dark:bg-theme-800"
              />
            </Field>
            <Field label="Allowed Extensions (comma‑sep)">
              <input
                value={allow}
                onChange={(e)=>setAllow(e.target.value)}
                placeholder="blank = any"
                className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                           bg-theme-50 dark:bg-theme-800"
              />
            </Field>
            <Field label="Max File Size">
              <input
                value={maxF}
                onChange={(e)=>setMaxF(e.target.value)}
                placeholder="e.g. 10MB – blank keeps current"
                className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                           bg-theme-50 dark:bg-theme-800"
              />
            </Field>
            <Field label="Max Total Storage">
              <input
                value={maxS}
                onChange={(e)=>setMaxS(e.target.value)}
                placeholder="blank = unlimited"
                className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                           bg-theme-50 dark:bg-theme-800"
              />
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700">
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={loading}
              onClick={handleSave}
              className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600 disabled:bg-theme-300"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
