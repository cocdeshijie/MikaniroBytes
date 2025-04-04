"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/formatBytes";

/**
 * Renders something like "1.5 TB" or "300 MB"
 * with a tooltip on hover showing "123,456,789 bytes".
 */
export function ByteValueTooltip({ bytes }: { bytes: number }) {
  const readable = formatBytes(bytes);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {/*
          Use a <span> or any element you want.
          We apply a subtle style so user knows they can hover for details.
        */}
        <span className="underline decoration-dotted cursor-help">
          {readable}
        </span>
      </Tooltip.Trigger>

      {/* The floating content with exact bytes */}
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={4}
          className={cn(
            "bg-gray-800 text-gray-50 px-2 py-1 rounded shadow z-50 text-xs"
          )}
        >
          {bytes.toLocaleString()} bytes
          <Tooltip.Arrow className="fill-gray-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
