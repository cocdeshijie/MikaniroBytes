"use client";

import { RefObject, useCallback, useRef } from "react";
import { atom, useAtom } from "jotai";

/**
 * Generic lasso‑selection hook.
 * - Caller registers every tile’s DOMRect.
 * - On drag we compute intersecting IDs and pass them to `onSelect`.
 */
export function useLasso(
  onSelect: (ids: number[]) => void
): {
  overlayRef: RefObject<HTMLDivElement>;
  boxStyle: React.CSSProperties;
  isVisible: boolean;
  onMouseDown: React.MouseEventHandler;
  registerTile: (id: number, rect: DOMRect | null) => void;
} {
  /* ------------ refs (do not trigger re‑render) ----------------------- */
  const origin = useRef<{ x: number; y: number } | null>(null);
  const tileRects = useRef<Map<number, DOMRect>>(new Map());
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ------------ jotai atom for overlay style -------------------------- */
  const boxAtom = useRef(atom<React.CSSProperties>({})).current;
  const [boxStyle, setBoxStyle] = useAtom(boxAtom);

  /* ------------ helpers ------------------------------------------------ */
  const registerTile = useCallback(
      (id: number, rect: DOMRect | null) => {
        if (rect) tileRects.current.set(id, rect);
        else      tileRects.current.delete(id);
      },
    []
  );

  const onMouseDown: React.MouseEventHandler = (e) => {
    if (e.button !== 0) return; // left‑click only
    if ((e.target as HTMLElement).closest("button,input,svg")) return;

    origin.current = { x: e.clientX, y: e.clientY };
    setBoxStyle({ left: e.clientX, top: e.clientY, width: 0, height: 0 });

    /* ---- move ---- */
    const move = (ev: MouseEvent) => {
      if (!origin.current) return;
      const x1 = Math.min(origin.current.x, ev.clientX);
      const y1 = Math.min(origin.current.y, ev.clientY);
      const x2 = Math.max(origin.current.x, ev.clientX);
      const y2 = Math.max(origin.current.y, ev.clientY);
      setBoxStyle({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 });
    };

    /* ---- up ---- */
    const up = (ev: MouseEvent) => {
      if (!origin.current) return;
      const x1 = Math.min(origin.current.x, ev.clientX);
      const y1 = Math.min(origin.current.y, ev.clientY);
      const x2 = Math.max(origin.current.x, ev.clientX);
      const y2 = Math.max(origin.current.y, ev.clientY);

      const inside: number[] = [];
      tileRects.current.forEach((r, id) => {
        if (r.right >= x1 && r.left <= x2 && r.bottom >= y1 && r.top <= y2) {
          inside.push(id);
        }
      });
      onSelect(inside);

      origin.current = null;
      setBoxStyle({});
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /* ------------ derived flag (width / height may be string) ----------- */
  const w =
    typeof boxStyle.width === "number" ? boxStyle.width : Number(boxStyle.width);
  const h =
    typeof boxStyle.height === "number"
      ? boxStyle.height
      : Number(boxStyle.height);
  const isVisible = w > 0 && h > 0;

  return { overlayRef, boxStyle, isVisible, onMouseDown, registerTile };
}
