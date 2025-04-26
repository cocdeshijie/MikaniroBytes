"use client";

import { useEffect, useRef, useCallback } from "react";
import { FiLoader } from "react-icons/fi";
import { cn } from "@/utils/cn";
import { shortenFilename } from "./utils";
import { PreviewThumb } from "./PreviewThumb";
import type { RemoteFile } from "./types";

/* ------------------------------------------------------------------ */
/*                               TILE                                 */
/* ------------------------------------------------------------------ */
interface Props {
  file: RemoteFile;
  selected: boolean;
  downloading: boolean;
  toggleSelect: (id: number, additive: boolean) => void;
  setExclusiveSelect: (id: number) => void;
  registerTile: (id: number, rect: DOMRect | null) => void;
}

export function FileTile({
  file,
  selected,
  downloading,
  toggleSelect,
  setExclusiveSelect,
  registerTile,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);

  /* wire up lasso hit-testing */
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const measure = () => registerTile(file.file_id, el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      registerTile(file.file_id, null);
    };
  }, [file.file_id, registerTile]);

  /* click / context-menu handlers */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;                  // left button only
    toggleSelect(file.file_id, e.ctrlKey || e.metaKey);
    /* no stopPropagation — let container handle lasso start */
  };

  const handleCtx = useCallback(() => {
    if (!selected) setExclusiveSelect(file.file_id);
  }, [file.file_id, selected, setExclusiveSelect]);

  return (
    <div
      ref={divRef}
      onMouseDown={handleMouseDown}
      onContextMenu={handleCtx}
      className={cn(
        "h-32 w-full relative flex flex-col items-center justify-center gap-2 p-2",
        "rounded-lg cursor-pointer select-none outline-none",
        "border border-theme-200/50 dark:border-theme-800/50",
        "bg-theme-100/25 dark:bg-theme-900/25 hover:bg-theme-100/50 dark:hover:bg-theme-900/40",
        "shadow-sm hover:shadow-md shadow-theme-500/5",
        selected && "ring-2 ring-theme-500",
      )}
    >
      {downloading ? (
        <FiLoader className="w-16 h-16 animate-spin text-theme-700 dark:text-theme-300" />
      ) : (
        <PreviewThumb file={file} />
      )}

      <p className="text-xs text-center leading-tight break-all line-clamp-2 max-h-8 overflow-hidden">
        {shortenFilename(file.original_filename || `file_${file.file_id}`)}
      </p>

      {selected && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-theme-500" />
      )}
    </div>
  );
}
