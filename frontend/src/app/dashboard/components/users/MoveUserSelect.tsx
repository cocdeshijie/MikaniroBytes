"use client";

import * as Select from "@radix-ui/react-select";
import { BiChevronDown, BiChevronUp, BiCheck } from "react-icons/bi";
import { cn } from "@/utils/cn";

export default function MoveUserSelect({
  currentGroupId,
  groups,
  onSelect,
}: {
  currentGroupId: number;
  groups: { id: number; name: string }[];
  onSelect: (gid: number) => void;
}) {
  return (
    <Select.Root
      value={currentGroupId.toString()}
      onValueChange={(v) => onSelect(+v)}
    >
      <Select.Trigger
        className={cn(
          "inline-flex items-center justify-between min-w-[7rem] px-3 py-1.5 rounded border",
          "border-theme-200 dark:border-theme-700 bg-theme-50 dark:bg-theme-800 text-sm"
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
  );
}
