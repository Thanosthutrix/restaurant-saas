/**
 * Importe un SVG source (ex. export Inkscape) → public/brand/mark.svg
 * en conservant le viewBox attendu par l'app.
 *
 * Usage : npm run brand:import-logo-svg [chemin.svg]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { svgPathBbox } from "svg-path-bbox";
import { BRAND_LOGO_VIEWBOX } from "../lib/brand/brandLogoConfig";

const [, , inputArg] = process.argv;
const INPUT = inputArg ? resolve(inputArg) : resolve(process.cwd(), "public/brand/logo-source.svg");
const OUT = resolve(process.cwd(), "public/brand/mark.svg");

const [vbX, vbY, vbW, vbH] = BRAND_LOGO_VIEWBOX.split(/\s+/).map(Number);

function extractPaths(svg: string): string[] {
  const paths: string[] = [];
  const re = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) paths.push(m[1]!);
  return paths;
}

function combinedBbox(paths: string[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of paths) {
    const [x0, y0, x1, y1] = svgPathBbox(d);
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }
  return [minX, minY, maxX, maxY];
}

function main() {
  let svg: string;
  try {
    svg = readFileSync(INPUT, "utf8");
  } catch {
    console.error("ÉCHEC : fichier introuvable →", INPUT);
    process.exit(1);
  }

  const paths = extractPaths(svg);
  if (paths.length === 0) {
    console.error("ÉCHEC : aucun <path> dans le SVG source");
    process.exit(1);
  }

  const [minX, minY, maxX, maxY] = combinedBbox(paths);
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  if (contentW <= 0 || contentH <= 0) {
    console.error("ÉCHEC : bbox invalide");
    process.exit(1);
  }

  const scale = Math.min(vbW / contentW, vbH / contentH);
  const offsetX = vbX + (vbW - contentW * scale) / 2;
  const offsetY = vbY + (vbH - contentH * scale) / 2;
  const transform = `translate(${offsetX.toFixed(3)},${offsetY.toFixed(3)}) scale(${scale.toFixed(6)}) translate(${(-minX).toFixed(3)},${(-minY).toFixed(3)})`;

  const out = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Importé depuis ${INPUT.split("/").pop()} — npm run brand:sync-logo -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_LOGO_VIEWBOX}" fill="currentColor">
  <g transform="${transform}">
${paths.map((d) => `    <path d="${d}"/>`).join("\n")}
  </g>
</svg>`;

  writeFileSync(OUT, out, "utf8");
  console.log(`OK → ${OUT}`);
  console.log(`${paths.length} path(s), source ${contentW.toFixed(1)}×${contentH.toFixed(1)}, transform="${transform}"`);
}

main();
