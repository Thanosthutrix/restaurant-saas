"use client";

import { useEffect, type RefObject } from "react";
import { usesMobileShellChrome } from "@/lib/app/mobileShell";

const ROOT_CLASS = "has-bottom-tabbar";
const CSS_VAR = "--app-bottom-tabbar-height";
const FALLBACK = "calc(3.75rem + max(0.35rem, env(safe-area-inset-bottom, 0px)))";

function shouldReserveInset(): boolean {
  return usesMobileShellChrome();
}

/** Mesure le bandeau bas et met à jour la hauteur de réserve (spacer + scroll). */
export function useBottomTabBarInset(navRef: RefObject<HTMLElement | null>, tabBarMounted: boolean) {
  useEffect(() => {
    const root = document.documentElement;

    function applyFallback() {
      root.style.setProperty(CSS_VAR, shouldReserveInset() ? FALLBACK : "0px");
    }

    function clearInset() {
      root.classList.remove(ROOT_CLASS);
      root.style.setProperty(CSS_VAR, "0px");
    }

    function syncInset() {
      if (!shouldReserveInset()) {
        clearInset();
        return;
      }

      root.classList.add(ROOT_CLASS);
      const el = navRef.current;
      if (!el) {
        applyFallback();
        return;
      }

      root.style.setProperty(CSS_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    }

    if (!shouldReserveInset()) {
      clearInset();
      return;
    }

    applyFallback();
    root.classList.add(ROOT_CLASS);

    let observer: ResizeObserver | null = null;
    let raf = 0;

    function attachObserver() {
      if (!tabBarMounted) return;
      const el = navRef.current;
      if (!el) {
        raf = window.requestAnimationFrame(attachObserver);
        return;
      }
      observer = new ResizeObserver(syncInset);
      observer.observe(el);
      syncInset();
    }

    attachObserver();

    const mobileMq = window.matchMedia("(max-width: 1023px)");
    mobileMq.addEventListener("change", syncInset);
    window.addEventListener("orientationchange", syncInset);
    window.visualViewport?.addEventListener("resize", syncInset);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
      mobileMq.removeEventListener("change", syncInset);
      window.removeEventListener("orientationchange", syncInset);
      window.visualViewport?.removeEventListener("resize", syncInset);
      clearInset();
    };
  }, [tabBarMounted, navRef]);
}
