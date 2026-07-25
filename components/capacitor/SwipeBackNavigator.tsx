"use client";

import { useEffect, useRef } from "react";
import { usesMobileShellChrome } from "@/lib/app/mobileShell";

const EDGE_WIDTH_PX = 32;
const MIN_SWIPE_PX = 80;

type TouchTrack = {
  startX: number;
  startY: number;
  active: boolean;
};

type Props = {
  enabled?: boolean;
  onBack: () => void;
};

function isBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-no-swipe-back]")) return true;
  if (target.closest('[role="dialog"][aria-modal="true"]')) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

function isHorizontalScroller(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  let node: Element | null = target;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      const { overflowX } = window.getComputedStyle(node);
      if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth + 8) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function hasOpenModal(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') != null;
}

/** Swipe depuis le bord gauche vers la droite → page précédente (mobile / app). */
export function SwipeBackNavigator({ enabled = true, onBack }: Props) {
  const trackRef = useRef<TouchTrack | null>(null);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled) return;

    function resetTrack() {
      trackRef.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      if (!usesMobileShellChrome() || e.touches.length !== 1 || hasOpenModal()) {
        resetTrack();
        return;
      }
      const touch = e.touches[0];
      if (touch.clientX > EDGE_WIDTH_PX) {
        resetTrack();
        return;
      }
      if (isBlockedTarget(e.target) || isHorizontalScroller(e.target)) {
        resetTrack();
        return;
      }
      trackRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        active: true,
      };
    }

    function onTouchMove(e: TouchEvent) {
      const track = trackRef.current;
      if (!track?.active || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - track.startX;
      const dy = touch.clientY - track.startY;
      if (dx < 0 || Math.abs(dy) > Math.abs(dx) * 1.25) {
        track.active = false;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const track = trackRef.current;
      if (!track?.active || hasOpenModal()) {
        resetTrack();
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - track.startX;
      resetTrack();
      if (dx >= MIN_SWIPE_PX) {
        onBackRef.current();
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", resetTrack, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", resetTrack);
    };
  }, [enabled]);

  return null;
}
