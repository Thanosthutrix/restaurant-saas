/**
 * Vectorise un PNG logo ubion → public/brand/mark.svg (viewBox fixe).
 *
 * Gère les PNG « masque alpha » (RGB noir + transparence), fréquents
 * avec les exports IA — ils paraissent tout noirs dans l’aperçu.
 *
 * Usage : npm run brand:import-logo-png [chemin.png]
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import potrace from "potrace";
import sharp from "sharp";
import { BRAND_LOGO_VIEWBOX } from "../lib/brand/brandLogoConfig";

const [, , inputArg] = process.argv;
const INPUT = inputArg
  ? resolve(inputArg)
  : resolve(process.cwd(), "public/brand/logo-source.png");
const OUT = resolve(process.cwd(), "public/brand/mark.svg");

const [vbX, vbY, vbW, vbH] = BRAND_LOGO_VIEWBOX.split(/\s+/).map(Number);

function extractPaths(svg: string): string[] {
  const paths: string[] = [];
  const re = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) paths.push(m[1]!);
  return paths;
}

/** Recadre sur les pixels visibles (alpha ou luminance). */
async function cropToVisibleContent(pngPath: string): Promise<{ buffer: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      const visible = a > 20 || r + g + b > 200;
      if (visible) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error("Logo introuvable dans le PNG (alpha et couleurs vides)");
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  // Potrace trace le noir : alpha fort → noir, fond → blanc
  const buffer = await sharp(pngPath)
    .extract({ left: minX, top: minY, width: w, height: h })
    .ensureAlpha()
    .extractChannel("alpha")
    .negate()
    .threshold(128)
    .png()
    .toBuffer();

  return { buffer, w, h };
}

async function main() {
  const { buffer: pngBuffer, w: trimW, h: trimH } = await cropToVisibleContent(INPUT);

  const traced = await new Promise<string>((resolveTrace, reject) => {
    potrace.trace(
      pngBuffer,
      { turdSize: 2, optTolerance: 0.12, color: "black", background: "transparent" },
      (err, svg) => (err ? reject(err) : resolveTrace(svg))
    );
  });

  const paths = extractPaths(traced);
  if (paths.length === 0) throw new Error("Aucun path après vectorisation");

  const scale = Math.min(vbW / trimW, vbH / trimH);
  const offsetX = vbX + (vbW - trimW * scale) / 2;
  const offsetY = vbY + (vbH - trimH * scale) / 2;
  const transform = `translate(${offsetX.toFixed(3)},${offsetY.toFixed(3)}) scale(${scale.toFixed(6)})`;

  const out = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Source PNG vectorisé — régénérer logoShape : npm run brand:sync-logo -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_LOGO_VIEWBOX}" fill="currentColor">
  <g transform="${transform}">
${paths.map((d) => `    <path d="${d}"/>`).join("\n")}
  </g>
</svg>`;

  writeFileSync(OUT, out, "utf8");
  console.log(`OK → ${OUT}`);
  console.log(`${paths.length} path(s), zone logo ${trimW}×${trimH}, transform="${transform}"`);
}

main().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
