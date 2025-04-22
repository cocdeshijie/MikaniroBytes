"use client";

import * as Toast from "@radix-ui/react-toast";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  PropsWithChildren,
} from "react";
import { atom, useAtom } from "jotai";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*                               TYPES                                */
/* ------------------------------------------------------------------ */
export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  /** Push a new toast */
  push: (opts: Omit<ToastItem, "id">) => void;
}

/* ------------------------------------------------------------------ */
/*                           GLOBAL ATOMS                             */
/* ------------------------------------------------------------------ */
const toastsAtom   = atom<ToastItem[]>([]);
const isMobileAtom = atom(false);

/* ------------------------------------------------------------------ */
/*                              CONTEXT                               */
/* ------------------------------------------------------------------ */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*                             PROVIDER                               */
/* ------------------------------------------------------------------ */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts]   = useAtom(toastsAtom);
  const [isMobile, setIsMobile] = useAtom(isMobileAtom);

  /* ---------- add keyframe once ------------------------------------ */
  useEffect(() => {
    if (document.getElementById("toast-animations")) return;

    const style = document.createElement("style");
    style.id = "toast-animations";
    style.textContent = `
      @keyframes shrinkWidth { from { width: 100% } to { width: 0% } }
      @keyframes slideIn     { from { opacity:0;transform:translateX(calc(100%+1rem)) }
                               to   { opacity:1;transform:translateX(0) } }
      @keyframes hide        { from { opacity:1 } to { opacity:0 } }
      .animate-slideIn { animation: slideIn .3s cubic-bezier(.16,1,.3,1) }
      .animate-hide    { animation: hide   .2s ease forwards }
    `;
    document.head.appendChild(style);
  }, []);

  /* ---------- mobile / desktop flag -------------------------------- */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handle = () => setIsMobile(mq.matches);
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [setIsMobile]);

  /* ---------- helpers ---------------------------------------------- */
  const push = useCallback(
    ({ duration = 4000, ...opts }: Omit<ToastItem, "id">) => {
      setToasts((p) => [...p, { id: crypto.randomUUID(), duration, ...opts }]);
    },
    [setToasts],
  );

  const handleOpenChange = useCallback(
    (id: string, open: boolean) => {
      if (!open) setToasts((p) => p.filter((t) => t.id !== id));
    },
    [setToasts],
  );

  /* ------------------------------------------------------------------ */
  /*                               RENDER                               */
  /* ------------------------------------------------------------------ */
  return (
    <Toast.Provider swipeDirection="right">
      <ToastContext.Provider value={{ push }}>
        {children}

        {/* ---------- Toast Items ---------- */}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            asChild
            defaultOpen
            duration={t.duration}
            onOpenChange={(o) => handleOpenChange(t.id, o)}
          >
            <div
              className={cn(
                "pointer-events-auto rounded-lg px-4 py-3 pb-5 shadow-md",
                "flex flex-col items-start gap-2 relative overflow-hidden",
                "animate-slideIn data-[state=closed]:animate-hide",
                "bg-white dark:bg-theme-900",
                t.variant === "success" && "border-l-4 border-green-500",
                t.variant === "info"    && "border-l-4 border-theme-500",
                t.variant === "error"   && "border-l-4 border-red-500",
              )}
            >
              <div className="flex-1 md:min-w-20">
                <Toast.Title
                  className={cn(
                    "font-semibold leading-tight truncate",
                    t.variant === "success" && "text-green-700 dark:text-green-400",
                    t.variant === "info"    && "text-theme-700 dark:text-theme-400",
                    t.variant === "error"   && "text-red-700 dark:text-red-400",
                  )}
                >
                  {t.title}
                </Toast.Title>

                {t.description && (
                  <Toast.Description className="text-theme-600 dark:text-theme-400 text-sm break-words mt-1">
                    {t.description}
                  </Toast.Description>
                )}
              </div>

              {/* progress bar */}
              <div className="absolute bottom-0 left-0 h-1 bg-theme-100 dark:bg-theme-800 w-full">
                <div
                  className={cn(
                    "h-full bg-theme-500"
                  )}
                  style={{
                    animation: `shrinkWidth ${t.duration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          </Toast.Root>
        ))}

        {/* ---------- Viewport ---------- */}
        <Toast.Viewport asChild>
          <div
            style={
              isMobile
                ? { top: 90, left: "50%", transform: "translateX(-50%)" }
                : { bottom: "1rem", right: "1rem" }
            }
            className="fixed z-[60] flex flex-col gap-2 p-2 max-w-[calc(100vw-1rem)] pointer-events-none"
          />
        </Toast.Viewport>
      </ToastContext.Provider>
    </Toast.Provider>
  );
}
