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
  /* new aggregate fields */
  file_count: number;
  storage_bytes: number;
}

/* -------- util: “10mb” → bytes OR null (unlimited) -------- */
function parseSizeToBytes(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const match = trimmed.match(/^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  if (isNaN(num)) return null;
  const mult: Record<string, number> = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12 };
  return Math.round(num * mult[match[2] || "b"]);
}

export default function AddGroupDialog({
  sessionToken,
  onCreated,
}: {
  sessionToken: string;
  onCreated: (g: GroupItem) => void;
}) {
  const { push } = useToast();

  /* -------- local atoms -------- */
  const openA = useMemo(() => atom(false), []);
  const nameA = useMemo(() => atom(""), []);
  const allowA = useMemo(() => atom(""), []);
  const maxFileA = useMemo(() => atom("10mb"), []);
  const maxStoreA = useMemo(() => atom(""), []);
  const errA = useMemo(() => atom<string>(""), []);
  const loadingA = useMemo(() => atom(false), []);

  const [open, setOpen] = useAtom(openA);
  const [name, setName] = useAtom(nameA);
  const [allow, setAllow] = useAtom(allowA);
  const [maxFile, setMaxFile] = useAtom(maxFileA);
  const [maxStore, setMaxStore] = useAtom(maxStoreA);
  const [errMsg, setErr] = useAtom(errA);
  const [loading, setLoading] = useAtom(loadingA);

  /* ---------------- CREATE ---------------- */
  async function handleCreate() {
    setErr("");
    setLoading(true);
    try {
      if (!name.trim()) throw new Error("Group name is required");

      const exts = allow.trim()
        ? allow.split(",").map((x) => x.trim()).filter(Boolean)
        : [];

      const fileBytes = parseSizeToBytes(maxFile) ?? undefined;
      const storeBytes = parseSizeToBytes(maxStore) ?? null;

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
            max_file_size: fileBytes,
            max_storage_size: storeBytes,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed");
      }
      const newGroup: GroupItem = await res.json();
      onCreated(newGroup);
      push({ title: "Group created", variant: "success" });
      setName("");
      setAllow("");
      setMaxFile("10mb");
      setMaxStore("");
      setOpen(false);
    } catch (e: any) {
      setErr(e.message);
      push({ title: "Create failed", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600"
          )}
        >
          + Add Group
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/30 backdrop-blur-sm fixed inset-0 z-50" />
        <Dialog.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bg-theme-50 dark:bg-theme-900 rounded-lg shadow-lg max-w-sm w-full p-6"
          )}
        >
          <Dialog.Title className="text-lg font-medium mb-2">
            Create New Group
          </Dialog.Title>
          <Dialog.Description className="text-sm text-theme-600 dark:text-theme-400 mb-4">
            • Leave <strong>Allowed Extensions</strong> blank to accept{" "}
            <em>any</em> file type.
            <br />• Size fields accept “10 MB”, “1 GB”, etc. Blank = Unlimited.
          </Dialog.Description>

          {errMsg && (
            <p
              className="mb-3 p-3 rounded border border-red-500/50 text-red-600 text-sm"
            >
              {errMsg}
            </p>
          )}

          <div className="space-y-4">
            <Field label="Group Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-theme-200
                           dark:border-theme-700 bg-theme-50 dark:bg-theme-800"
              />
            </Field>
            <Field label="Allowed Extensions (comma‑sep)">
              <input
                value={allow}
                onChange={(e) => setAllow(e.target.value)}
                placeholder="jpg,png,gif — blank: any"
                className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                           bg-theme-50 dark:bg-theme-800"
              />
            </Field>
            <Field label="Max File Size">
              <input
                value={maxFile}
                onChange={(e) => setMaxFile(e.target.value)}
                placeholder="e.g. 10MB"
                className="w-full px-3 py-2 rounded border border-theme-200 dark:border-theme-700
                           bg-theme-50 dark:bg-theme-800"
              />
            </Field>
            <Field label="Max Total Storage">
              <input
                value={maxStore}
                onChange={(e) => setMaxStore(e.target.value)}
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
              onClick={handleCreate}
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
    <div>
      <label className="block text-sm font-medium text-theme-700 dark:text-theme-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
