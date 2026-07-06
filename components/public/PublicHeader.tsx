"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/app/BrandLogo";
import { ConsumerAccountNav } from "@/components/public/consumer/ConsumerAccountNav";
import { PublicProToggle } from "@/components/public/PublicProToggle";

const HEADER_HEIGHT_PX = 64;
const SCROLL_DELTA = 8;

export function PublicHeader() {
  const [revealed, setRevealed] = useState(true);
  const [hovering, setHovering] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const updateVisibility = useCallback((scrollY: number) => {
    if (scrollY <= 12) {
      setRevealed(true);
      return;
    }

    const delta = scrollY - lastScrollY.current;
    if (Math.abs(delta) < SCROLL_DELTA) return;

    setRevealed(delta < 0);
  }, []);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        updateVisibility(window.scrollY);
        lastScrollY.current = window.scrollY;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [updateVisibility]);

  const isOpen = revealed || hovering;

  return (
    <>
      {/* Zone sensible en haut : survol pour faire réapparaître le header. */}
      <div
        className="fixed inset-x-0 top-0 z-[60] h-3"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        aria-hidden
      />

      <header
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ height: HEADER_HEIGHT_PX }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex shrink-0 items-center" aria-label="ubion — accueil">
            <BrandLogo className="h-10 w-auto transition-transform group-hover:scale-[1.02]" />
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <ConsumerAccountNav />
            <PublicProToggle mode="public" />
          </nav>
        </div>
      </header>

      <div aria-hidden className="shrink-0" style={{ height: HEADER_HEIGHT_PX }} />
    </>
  );
}
