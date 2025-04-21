"use client";

import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import type { GroupItem } from "@/types/sharedTypes";

/* ---------- util ---------- */
function sizeToBytes(input: string): number | null {
  const txt = input.trim().toLowerCase();
  if (!txt) return null;
  const m = txt.match(/^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (isNaN(num)) return null;
  const mult: Record<string, number> = { b:1, kb:1e3, mb:1e6, gb:1e9, tb:1e12 };
  return Math.round(num * mult[m[2] ?? "b"]);
}

export default function AddGroupDialog({
  sessionToken,
  onCreated,
}: {
  sessionToken: string;
  onCreated: (g: GroupItem) => void;
}) {
  const { push } = useToast();

  /* local atoms */
  const openA   = useMemo(() => atom(false), []);
  const nameA   = useMemo(() => atom(""), []);
  const allowA  = useMemo(() => atom(""), []);
  const maxFA   = useMemo(() => atom("10mb"), []);
  const maxSA   = useMemo(() => atom(""), []);
  const errA    = useMemo(() => atom(""), []);
  const loadA   = useMemo(() => atom(false), []);

  const [open, setOpen]   = useAtom(openA);
  const [name, setName]   = useAtom(nameA);
  const [allow, setAllow] = useAtom(allowA);
  const [maxF, setMaxF]   = useAtom(maxFA);
  const [maxS, setMaxS]   = useAtom(maxSA);
  const [err, setErr]     = useAtom(errA);
  const [loading, setLoading] = useAtom(loadA);

  /* --------------- create --------------- */
  async function create() {
    setErr(""); setLoading(true);
    try {
      if (!name.trim()) throw new Error("Group name required");

      const exts = allow.trim()
        ? allow.split(",").map((x) => x.trim()).filter(Boolean)
        : [];

      const maxFile   = sizeToBytes(maxF);   // null => unlimited
      const maxStore  = sizeToBytes(maxS);   // null => unlimited

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/groups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            allowed_extensions: exts,
            max_file_size: maxFile,
            max_storage_size: maxStore,
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed");
      }
      const g: GroupItem = await res.json();
      onCreated(g);
      push({ title: "Group created", variant: "success" });
      setName(""); setAllow(""); setMaxF("10mb"); setMaxS("");
      setOpen(false);
    } catch (e: any) {
      setErr(e.message);
      push({ title: "Create failed", variant: "error" });
    } finally { setLoading(false); }
  }

  /* --------------- UI --------------- */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600">
          + Add Group
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/30 backdrop-blur-sm fixed inset-0 z-50" />
        <Dialog.Content className={cn(
          "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6",
        )}>
          <Dialog.Title className="text-lg font-medium mb-2">
            Create New Group
          </Dialog.Title>
          <Dialog.Description className="text-sm text-theme-600 dark:text-theme-400 mb-4">
            Leave limits blank for <em>unlimited</em>.
          </Dialog.Description>

          {err && (
            <p className="mb-3 p-3 rounded border border-red-500/50 text-red-600 text-sm">
              {err}
            </p>
          )}

          <Field label="Group Name">
            <input value={name} onChange={(e)=>setName(e.target.value)}
                   className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                              bg-theme-50 dark:bg-theme-800" />
          </Field>

          <Field label="Allowed Extensions (comma‑sep)">
            <input value={allow} onChange={(e)=>setAllow(e.target.value)}
                   placeholder="jpg,png,gif — blank: any"
                   className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                              bg-theme-50 dark:bg-theme-800" />
          </Field>

          <Field label="Max File Size">
            <input value={maxF} onChange={(e)=>setMaxF(e.target.value)}
                   placeholder="e.g. 10MB"
                   className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                              bg-theme-50 dark:bg-theme-800" />
          </Field>

          <Field label="Max Total Storage">
            <input value={maxS} onChange={(e)=>setMaxS(e.target.value)}
                   placeholder="blank = unlimited"
                   className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                              bg-theme-50 dark:bg-theme-800" />
          </Field>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700">
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={loading}
              onClick={create}
              className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600 disabled:bg-theme-300"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-theme-700 dark:text-theme-300">
        {label}
      </label>
      {children}
    </div>
  );
}
