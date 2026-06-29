"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type SmartTooltipPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type SmartTooltipProps = {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
  width?: number;
  minWidth?: number;
  gap?: number;
  margin?: number;
  align?: "start" | "center" | "end";
  className?: string;
  zIndex?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function viewportBounds(margin: number) {
  const visualViewport = typeof window !== "undefined" ? window.visualViewport : null;
  const offsetLeft = visualViewport?.offsetLeft ?? 0;
  const offsetTop = visualViewport?.offsetTop ?? 0;
  const width = visualViewport?.width ?? window.innerWidth;
  const height = visualViewport?.height ?? window.innerHeight;

  return {
    left: offsetLeft + margin,
    top: offsetTop + margin,
    right: offsetLeft + width - margin,
    bottom: offsetTop + height - margin,
    width: Math.max(0, width - margin * 2),
    height: Math.max(0, height - margin * 2),
  };
}

function getFloatingPosition({
  anchor,
  floating,
  desiredWidth,
  minWidth,
  gap,
  margin,
  align,
}: {
  anchor: HTMLElement | null | undefined;
  floating: HTMLElement | null;
  desiredWidth: number;
  minWidth: number;
  gap: number;
  margin: number;
  align: "start" | "center" | "end";
}): SmartTooltipPosition {
  const bounds = viewportBounds(margin);
  const width = clamp(Math.min(desiredWidth, bounds.width), Math.min(minWidth, bounds.width), bounds.width);
  const naturalHeight = floating?.scrollHeight ?? 420;
  const absoluteMaxHeight = Math.max(180, bounds.height);
  const measuredHeight = Math.min(naturalHeight, absoluteMaxHeight);

  if (!anchor) {
    return {
      top: bounds.top,
      left: clamp(bounds.left, bounds.left, bounds.right - width),
      width,
      maxHeight: absoluteMaxHeight,
    };
  }

  const rect = anchor.getBoundingClientRect();
  const spaceBelow = bounds.bottom - rect.bottom - gap;
  const spaceAbove = rect.top - bounds.top - gap;
  const shouldOpenAbove = spaceBelow < Math.min(measuredHeight, 320) && spaceAbove > spaceBelow;
  const availableHeight = Math.max(180, shouldOpenAbove ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(absoluteMaxHeight, availableHeight);
  const visibleHeight = Math.min(measuredHeight, maxHeight);

  let top = shouldOpenAbove ? rect.top - visibleHeight - gap : rect.bottom + gap;
  top = clamp(top, bounds.top, Math.max(bounds.top, bounds.bottom - visibleHeight));

  let wantedLeft = rect.left;
  if (align === "center") wantedLeft = rect.left + rect.width / 2 - width / 2;
  if (align === "end") wantedLeft = rect.right - width;

  const left = clamp(wantedLeft, bounds.left, Math.max(bounds.left, bounds.right - width));

  return { top, left, width, maxHeight };
}

export function SmartTooltip({
  anchorRef,
  open,
  children,
  width = 460,
  minWidth = 280,
  gap = 10,
  margin = 16,
  align = "start",
  className,
  zIndex = 99999,
  onMouseEnter,
  onMouseLeave,
}: SmartTooltipProps) {
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<SmartTooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    let frameId = 0;

    const update = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setPosition(
          getFloatingPosition({
            anchor: anchorRef.current,
            floating: floatingRef.current,
            desiredWidth: width,
            minWidth,
            gap,
            margin,
            align,
          }),
        );
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [align, anchorRef, children, gap, margin, minWidth, open, width]);

  useEffect(() => {
    if (!open) setPosition(null);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={floatingRef}
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width ?? Math.min(width, typeof window !== "undefined" ? window.innerWidth - margin * 2 : width),
        maxHeight: position?.maxHeight ?? `calc(100dvh - ${margin * 2}px)`,
        zIndex,
        visibility: position ? "visible" : "hidden",
      }}
      className={cn(
        "overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_24px_80px_rgba(15,23,42,0.24)] ring-1 ring-slate-900/5",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}

export function useSmartTooltip(closeDelay = 140) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const show = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const hide = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), closeDelay);
  };

  const closeNow = () => {
    clearCloseTimer();
    setOpen(false);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return { open, show, hide, closeNow, setOpen };
}
