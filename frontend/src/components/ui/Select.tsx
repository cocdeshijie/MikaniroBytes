"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { BiChevronDown, BiChevronUp, BiCheck } from "react-icons/bi";
import { cn } from "@/utils/cn";
import { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: ReactNode;
}

/** A very small styling wrapper around Radix `Select` */
export function Select({
  value,
  onValueChange,
  options,
  disabled = false,
  className = "",
  minWidth = "7rem",
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  /** CSS min-width value (defaults ~7rem) */
  minWidth?: string;
}) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex items-center justify-between px-3 py-1.5 rounded border text-sm",
          "border-theme-200 dark:border-theme-700",
          "bg-theme-50 dark:bg-theme-800",
          "text-theme-900 dark:text-theme-100",
          "focus:outline-none",
          className,
        )}
        style={{ minWidth }}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <BiChevronDown className="h-4 w-4 shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          side="bottom"
          className={cn(
            "overflow-hidden rounded-lg shadow-lg z-50",
            "bg-theme-50 dark:bg-theme-900",
            "border border-theme-200 dark:border-theme-700",
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
            <BiChevronUp />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="max-h-60">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className={cn(
                  "flex items-center px-3 py-2 text-sm cursor-pointer select-none",
                  "text-theme-700 dark:text-theme-300",
                  "radix-state-checked:bg-theme-200 dark:radix-state-checked:bg-theme-700",
                  "hover:bg-theme-100 dark:hover:bg-theme-800",
                )}
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <BiCheck />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
            <BiChevronDown />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
