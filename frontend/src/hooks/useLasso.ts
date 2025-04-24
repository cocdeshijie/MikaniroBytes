"use client";

import { RefObject, useCallback, useRef } from "react";
import { atom, useAtom } from "jotai";

/**
 * Marquee-select helper that keeps the rubber-band aligned while
 * the user scrolls either the container *or* the page itself.
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
  /* ------------------------------------------------------------------ */
  /** drag start in content-space coordinates */
  const origin = useRef<{ x: number; y: number } | null>(null);
  /** last client-space cursor position - for redraw on scroll */
  const lastClient = useRef<{ x: number; y: number } | null>(null);

  /** id → tile rect in content-space */
  const tileRects = useRef<Map<number, DOMRect>>(new Map());

  /* ------------------------------------------------------------------ */
  /* jotai atom for live marquee style (no forced renders elsewhere)    */
  const boxAtom = useRef(atom<React.CSSProperties>({})).current;
  const [boxStyle, setBoxStyle] = useAtom(boxAtom);

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  const clientToContent = (clientX: number, clientY: number) => {
    const cont = containerRef.current!;
    const rect = cont.getBoundingClientRect(); // fresh each call
    return {
      x: clientX - rect.left + cont.scrollLeft,
      y: clientY - rect.top + cont.scrollTop,
    };
  };

  const registerTile = useCallback(
    (id: number, rect: DOMRect | null) => {
      const cont = containerRef.current;
      if (!cont || !rect) {
        tileRects.current.delete(id);
        return;
      }
      const cRect = cont.getBoundingClientRect();
      tileRects.current.set(
        id,
        new DOMRect(
          rect.left - cRect.left + cont.scrollLeft,
          rect.top - cRect.top + cont.scrollTop,
          rect.width,
          rect.height
        )
      );
    },
    [containerRef]
  );

  /* ------------------------------------------------------------------ */
  /* mouse-down kicks off drag                                           */
  const onMouseDown: React.MouseEventHandler = (e) => {
    if (e.button !== 0) return; // LMB only
    const cont = containerRef.current;
    if (!cont) return;
    if ((e.target as HTMLElement).closest("button,input,a,svg")) return;

    /* initial positions */
    origin.current = clientToContent(e.clientX, e.clientY);
    lastClient.current = { x: e.clientX, y: e.clientY };

    /* start with zero-size box */
    setBoxStyle({
      left: origin.current.x - cont.scrollLeft,
      top: origin.current.y - cont.scrollTop,
      width: 0,
      height: 0,
    });

    /* -------------------------------------------------------------- */
    const redraw = (clientX: number, clientY: number) => {
      if (!origin.current) return;
      const cur = clientToContent(clientX, clientY);

      const leftC = Math.min(origin.current.x, cur.x);
      const topC = Math.min(origin.current.y, cur.y);
      const width = Math.abs(cur.x - origin.current.x);
      const height = Math.abs(cur.y - origin.current.y);

      setBoxStyle({
        left: leftC - cont.scrollLeft,
        top: topC - cont.scrollTop,
        width,
        height,
      });
    };

    const handleMove = (ev: MouseEvent) => {
      lastClient.current = { x: ev.clientX, y: ev.clientY };
      redraw(ev.clientX, ev.clientY);
    };

    const handleScroll = () => {
      /* pointer might be stationary while user scrolls */
      const c = lastClient.current;
      if (c) redraw(c.x, c.y);
    };

    const handleUp = (ev: MouseEvent) => {
      if (!origin.current) return;

      const end = clientToContent(ev.clientX, ev.clientY);

      const left = Math.min(origin.current.x, end.x);
      const top = Math.min(origin.current.y, end.y);
      const right = Math.max(origin.current.x, end.x);
      const bottom = Math.max(origin.current.y, end.y);

      const selected: number[] = [];
      tileRects.current.forEach((r, id) => {
        if (
          r.right >= left &&
          r.left <= right &&
          r.bottom >= top &&
          r.top <= bottom
        )
          selected.push(id);
      });
      onSelect(selected);

      /* cleanup */
      origin.current = null;
      lastClient.current = null;
      setBoxStyle({});
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("scroll", handleScroll, true);
      cont.removeEventListener("scroll", handleScroll);
    };

    /* listeners */
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    /* capture scroll on both the container and any ancestor/window   */
    cont.addEventListener("scroll", handleScroll);
    window.addEventListener("scroll", handleScroll, true);
  };

  const isVisible =
    (boxStyle.width as number | undefined) &&
    (boxStyle.height as number | undefined) &&
    (boxStyle.width as number) > 0 &&
    (boxStyle.height as number) > 0;

  return { boxStyle, isVisible: !!isVisible, onMouseDown, registerTile };
}
