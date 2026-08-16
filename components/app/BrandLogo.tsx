"use client";

import { useId, type SVGProps } from "react";
import { BRAND_LOGO_VIEWBOX } from "@/lib/brand/brandLogoConfig";
import { BrandLogoShape } from "@/lib/brand/logoShape";

/** Logo ubion : dégradé cuivre + reflet diagonal (façon `.copper-sheen`). */
export function BrandLogo(props: SVGProps<SVGSVGElement>) {
  const uid = useId().replace(/:/g, "");
  const copper = `ubion-copper-${uid}`;
  const sheen = `ubion-sheen-${uid}`;
  const shape = `ubion-shape-${uid}`;

  return (
    <svg viewBox={BRAND_LOGO_VIEWBOX} xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={copper} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e08550" />
          <stop offset="50%" stopColor="#c25a2c" />
          <stop offset="100%" stopColor="#9c431c" />
        </linearGradient>
        <linearGradient id={sheen} gradientTransform="rotate(25 0.5 0.5)">
          <stop offset="0.14" stopColor="#ffebde" stopOpacity="0" />
          <stop offset="0.28" stopColor="#ffebde" stopOpacity="0.45" />
          <stop offset="0.42" stopColor="#ffebde" stopOpacity="0" />
          <stop offset="0.66" stopColor="#ffebde" stopOpacity="0" />
          <stop offset="0.75" stopColor="#ffebde" stopOpacity="0.28" />
          <stop offset="0.84" stopColor="#ffebde" stopOpacity="0" />
        </linearGradient>
        <g id={shape}>
          <BrandLogoShape />
        </g>
      </defs>
      <use href={`#${shape}`} fill={`url(#${copper}) #c25a2c`} className="transition-colors group-hover:fill-white" />
      <use href={`#${shape}`} fill={`url(#${sheen})`} />
    </svg>
  );
}
