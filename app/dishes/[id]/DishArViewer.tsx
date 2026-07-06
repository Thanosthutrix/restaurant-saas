"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  alt: string;
  poster?: string | null;
  className?: string;
};

/**
 * Prévisualisation 3D + RA. Réglages lumière proches du viewer Tripo (PBR alimentaire).
 */
export function DishArViewer({ src, alt, poster, className }: Props) {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void import("@google/model-viewer");
  }, []);

  return (
    <model-viewer
      src={src}
      alt={alt}
      poster={poster ?? undefined}
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="fixed"
      camera-controls
      touch-action="pan-y"
      shadow-intensity="0.85"
      shadow-softness="0.9"
      exposure="1.25"
      tone-mapping="commerce"
      environment-image="neutral"
      className={className ?? "h-[min(60vh,420px)] w-full rounded-2xl bg-stone-100"}
      style={{ width: "100%", minHeight: "280px" }}
    />
  );
}
