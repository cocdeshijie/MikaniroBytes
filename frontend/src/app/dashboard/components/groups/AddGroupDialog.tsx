"use client";

import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Form from "@radix-ui/react-form";
import { cn } from "@/utils/cn";
import { useToast } from "@/providers/toast-provider";
import type { GroupItem } from "@/types/sharedTypes";
import { api, ApiError } from "@/lib/api";
import { sizeToBytes } from "@/utils/formatBytes";

const inputCls = () =>
  cn(
    "w-full px-3 py-2 rounded",
    "bg-theme-50 dark:bg-theme-800",
    "border border-theme-200 dark:border-theme-700",
    "focus:border-theme-500 focus:outline-none",
    "transition-colors duration-200",
    "text-theme-900 dark:text-theme-100"
  );

export default function AddGroupDialog({
  sessionToken,
  onCreated,
}: {
  sessionToken: string;
  onCreated: (g: GroupItem) => void;
}) {
  const { push } = useToast();

  const openA  = useMemo(() => atom(false), []);
  const nameA  = useMemo(() => atom(""), []);
  const allowA = useMemo(() => atom(""), []);
  const maxFA  = useMemo(() => atom("10mb"), []);
  const maxSA  = useMemo(() => atom(""), []);
  const errA   = useMemo(() => atom(""), []);
  const loadA  = useMemo(() => atom(false), []);

  const [open, setOpen]     = useAtom(openA);
  const [name, setName]     = useAtom(nameA);
  const [allow, setAllow]   = useAtom(allowA);
  const [maxF, setMaxF]     = useAtom(maxFA);
  const [maxS, setMaxS]     = useAtom(maxSA);
  const [err, setErr]       = useAtom(errA);
  const [loading, setLoad]  = useAtom(loadA);

  async function create() {
    setErr("");
    setLoad(true);
    try {
      if (!name.trim()) throw new Error("Group name required");

      const exts =
        allow.trim() === ""
          ? []
          : allow.split(",").map((x) => x.trim()).filter(Boolean);

      const payload = {
        name: name.trim(),
        allowed_extensions: exts,
        max_file_size: sizeToBytes(maxF),    // parse "10mb" → e.g. 10485760
        max_storage_size: sizeToBytes(maxS),
      };

      const g = await api<GroupItem>("/admin/groups", {
        method: "POST",
        token : sessionToken,
        json  : payload,
      });

      onCreated(g);
      push({ title: "Group created", variant: "success" });
      setName(""); setAllow(""); setMaxF("10mb"); setMaxS("");
      setOpen(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setErr(msg);
      push({ title: msg, variant: "error" });
    } finally {
      setLoad(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600">
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
            Use “1 KB”, “10 MB”, “1 GB” etc. — leave blank for unlimited.
            <br />
            (Binary-based: 1 MB = 1,048,576 bytes)
          </Dialog.Description>

          {err && (
            <p className="mb-3 p-3 rounded border border-red-500/50 text-red-600 text-sm">
              {err}
            </p>
          )}

          <Form.Root
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="space-y-5"
          >
            <Form.Field name="name">
              <Form.Label className="block mb-1 text-sm font-medium">
                Group Name
              </Form.Label>
              <Form.Control asChild>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls()}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="allowed">
              <Form.Label className="block mb-1 text-sm font-medium">
                Allowed Extensions (comma-sep)
              </Form.Label>
              <Form.Control asChild>
                <input
                  value={allow}
                  onChange={(e) => setAllow(e.target.value)}
                  className={inputCls()}
                />
              </Form.Control>
              <p className="mt-1 text-xs text-theme-500 dark:text-theme-400">
                Leave blank to allow any file type.
              </p>
            </Form.Field>

            <SizeInput
              label="Max File Size"
              value={maxF}
              onChange={(e) => setMaxF(e.target.value)}
            />
            <SizeInput
              label="Max Total Storage"
              value={maxS}
              onChange={(e) => setMaxS(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2 rounded border border-theme-300 dark:border-theme-700">
                  Cancel
                </button>
              </Dialog.Close>
              <Form.Submit asChild>
                <button
                  disabled={loading}
                  className="px-4 py-2 rounded bg-theme-500 text-white hover:bg-theme-600 disabled:bg-theme-300"
                >
                  {loading ? "Creating…" : "Create"}
                </button>
              </Form.Submit>
            </div>
          </Form.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------
   Reusable size input
------------------------------------------------------------------ */
function SizeInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }
) {
  const { label, ...rest } = props;
  return (
    <Form.Field name={label}>
      <Form.Label className="block mb-1 text-sm font-medium">
        {label}
      </Form.Label>
      <Form.Control asChild>
        <input {...rest} className={inputCls()} />
      </Form.Control>
      <p className="mt-1 text-xs text-theme-500 dark:text-theme-400">
        Leave blank for unlimited.
      </p>
    </Form.Field>
  );
}
