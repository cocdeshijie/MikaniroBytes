"use client";

import { RefObject, useCallback, useRef } from "react";
import { atom, useAtom } from "jotai";

/**
 * Generic marquee / lasso‑selection hook that works inside any scrollable
 * container. Pass a `containerRef` so all math is relative to it.
 */
export function useLasso(
  onSelect: (ids: number[]) => void,
  containerRef: RefObject<HTMLElement>
): {
  boxStyle: React.CSSProperties;
  isVisible: boolean;
  onMouseDown: React.MouseEventHandler;
  registerTile: (id: number, rect: DOMRect | null) => void;
} {
  /* ---------- mutable refs (no re‑renders) ----------------------- */
  const origin      = useRef<{ x: number; y: number } | null>(null);
  const tileRects   = useRef<Map<number, DOMRect>>(new Map());

  /* ---------- lasso overlay style held in a jotai atom ----------- */
  const boxAtom = useRef(atom<React.CSSProperties>({})).current;
  const [boxStyle, setBoxStyle] = useAtom(boxAtom);

  /* ---------- register / unregister each selectable tile --------- */
  const registerTile = useCallback(
    (id: number, rect: DOMRect | null) => {
      const cont = containerRef.current;
      if (!cont || !rect) {
        tileRects.current.delete(id);
        return;
      }
      const cRect = cont.getBoundingClientRect();      // coords → relative
      tileRects.current.set(
        id,
        new DOMRect(
          rect.left - cRect.left,
          rect.top  - cRect.top,
          rect.width,
          rect.height
        )
      );
    },
    [containerRef]
  );

  /* ---------- mouse listeners ----------------------------------- */
  const onMouseDown: React.MouseEventHandler = (e) => {
    if (e.button !== 0) return;                        // only LMB
    const cont = containerRef.current;
    if (!cont) return;

    if ((e.target as HTMLElement).closest("button,input,svg,a")) return;

    const cRect = cont.getBoundingClientRect();
    origin.current = {
      x: e.clientX - cRect.left,
      y: e.clientY - cRect.top,
    };
    setBoxStyle({
      left  : origin.current.x,
      top   : origin.current.y,
      width : 0,
      height: 0,
    });

    const move = (ev: MouseEvent) => {
      if (!origin.current) return;
      const x = ev.clientX - cRect.left;
      const y = ev.clientY - cRect.top;
      const left = Math.min(origin.current.x, x);
      const top  = Math.min(origin.current.y, y);
      setBoxStyle({
        left,
        top,
        width : Math.abs(x - origin.current.x),
        height: Math.abs(y - origin.current.y),
      });
    };

    const up = (ev: MouseEvent) => {
      if (!origin.current) return;
      const x2 = ev.clientX - cRect.left;
      const y2 = ev.clientY - cRect.top;
      const x1 = origin.current.x;
      const y1 = origin.current.y;

      const left   = Math.min(x1, x2);
      const top    = Math.min(y1, y2);
      const right  = Math.max(x1, x2);
      const bottom = Math.max(y1, y2);

      const sel: number[] = [];
      tileRects.current.forEach((r, id) => {
        if (
          r.right  >= left  &&
          r.left   <= right &&
          r.bottom >= top   &&
          r.top    <= bottom
        ) sel.push(id);
      });
      onSelect(sel);

      origin.current = null;
      setBoxStyle({});
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup",   up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
  };

  const isVisible =
    (boxStyle.width  as number || 0) > 0 &&
    (boxStyle.height as number || 0) > 0;

  return { boxStyle, isVisible, onMouseDown, registerTile };
}
