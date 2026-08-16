/**
 * Lit public/brand/mark.svg et régénère :
 *   - lib/brand/logoShape.tsx
 *   - app/icon.svg (favicon onglets navigateur)
 *   - app/apple-icon.tsx (icône iOS / PWA)
 *
 * Usage : npm run brand:sync-logo
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BRAND_LOGO_VIEWBOX } from "../lib/brand/brandLogoConfig";

const ROOT = resolve(process.cwd());
const MARK_PATH = resolve(ROOT, "public/brand/mark.svg");
const OUT_SHAPE = resolve(ROOT, "lib/brand/logoShape.tsx");
const OUT_ICON = resolve(ROOT, "app/icon.svg");
const OUT_ICON_PUBLIC = resolve(ROOT, "public/icon.svg");
const OUT_APPLE = resolve(ROOT, "app/apple-icon.tsx");

function fail(msg: string): never {
  console.error("ÉCHEC :", msg);
  process.exit(1);
}

function extractViewBox(svg: string): string | null {
  const m = /\bviewBox=["']([^"']+)["']/i.exec(svg);
  return m?.[1]?.trim() ?? null;
}

function extractGroupTransform(svg: string): string | null {
  const m = /<g\b[^>]*\btransform=["']([^"']+)["']/i.exec(svg);
  return m?.[1]?.trim() ?? null;
}

function extractPaths(svg: string): string[] {
  const paths: string[] = [];
  const re = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    paths.push(m[1]!);
  }
  return paths;
}

const [vbX, vbY, vbW, vbH] = BRAND_LOGO_VIEWBOX.split(/\s+/).map(Number);
const FAVICON_PAD_X = (512 - vbW) / 2;
const FAVICON_PAD_Y = (512 - vbH) / 2;

/** Retire le translate(viewBox) redondant — déjà inclus dans le viewBox du composant app. */
function stripViewBoxOffset(transform: string | null): string | null {
  if (!transform) return null;
  const m = /^translate\(\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*\)\s*(.*)$/s.exec(transform);
  if (!m) return transform;
  const tx = parseFloat(m[1]!);
  const ty = parseFloat(m[2]!);
  if (Math.abs(tx - vbX) < 2 && Math.abs(ty - vbY) < 2) {
    const rest = m[3]!.trim();
    return rest || null;
  }
  return transform;
}

function buildLogoMarkup(paths: string[], groupTransform: string | null, fill: string): string {
  const pathEls = paths.map((d) => `      <path fill="${fill}" d="${d}"/>`).join("\n");
  if (groupTransform) {
    return `    <g transform="${groupTransform}">\n${pathEls}\n    </g>`;
  }
  return pathEls;
}

function writeFavicon(paths: string[], groupTransform: string | null) {
  const faviconTransform = stripViewBoxOffset(groupTransform);
  const logoInner = buildLogoMarkup(paths, faviconTransform, "#fff");
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="ubion">
  <defs>
    <linearGradient id="ubion-copper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e08550" />
      <stop offset="50%" stop-color="#c25a2c" />
      <stop offset="100%" stop-color="#9c431c" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#ubion-copper)" />
  <g transform="translate(${FAVICON_PAD_X.toFixed(1)}, ${FAVICON_PAD_Y.toFixed(1)})">
${logoInner}
  </g>
</svg>
`;
  writeFileSync(OUT_ICON, iconSvg, "utf8");
  writeFileSync(OUT_ICON_PUBLIC, iconSvg, "utf8");
}

function writeAppleIcon(paths: string[], groupTransform: string | null) {
  const faviconTransform = stripViewBoxOffset(groupTransform);
  const pathJsx = paths
    .map((d) => `          <path fill="#fff" d=${JSON.stringify(d)} />`)
    .join("\n");

  const innerG = faviconTransform
    ? `        <g transform=${JSON.stringify(faviconTransform)}>\n${pathJsx}\n        </g>`
    : pathJsx;

  const apple = `import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Généré depuis public/brand/mark.svg — npm run brand:sync-logo */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #e08550 0%, #c25a2c 50%, #9c431c 100%)",
          borderRadius: 36,
        }}
      >
        <svg viewBox="0 0 ${vbW} ${vbH}" width="112" height="112">
${innerG}
        </svg>
      </div>
    ),
    { ...size }
  );
}
`;
  writeFileSync(OUT_APPLE, apple, "utf8");
}

function main() {
  let svg: string;
  try {
    svg = readFileSync(MARK_PATH, "utf8");
  } catch {
    fail(`Fichier introuvable : ${MARK_PATH}`);
  }

  const viewBox = extractViewBox(svg);
  if (!viewBox) fail("viewBox manquant dans mark.svg");
  if (viewBox !== BRAND_LOGO_VIEWBOX) {
    fail(
      `viewBox="${viewBox}" ≠ attendu "${BRAND_LOGO_VIEWBOX}".\n` +
        "Dans Figma/Illustrator : cadre d'export = 338 86 324 336, ou redimensionnez le logo dans ce viewBox."
    );
  }

  const paths = extractPaths(svg);
  if (paths.length === 0) fail("Aucun élément <path> trouvé dans mark.svg");

  const groupTransform = extractGroupTransform(svg);
  const pathLines = paths.map((d) => `      <path d={${JSON.stringify(d)}} />`).join("\n");

  const inner = groupTransform
    ? `    <g transform={${JSON.stringify(groupTransform)}}>\n${pathLines}\n    </g>`
    : pathLines;

  const shapeOut = `/**
 * Tracés du logo — généré depuis public/brand/mark.svg
 * Régénérer : npm run brand:sync-logo
 */
export function BrandLogoShape() {
  return (
    <>
${inner}
    </>
  );
}
`;

  writeFileSync(OUT_SHAPE, shapeOut, "utf8");
  writeFavicon(paths, groupTransform);
  writeAppleIcon(paths, groupTransform);

  console.log(`OK : ${paths.length} path(s) → lib/brand/logoShape.tsx`);
  console.log(`OK : app/icon.svg + public/icon.svg (favicon onglets)`);
  console.log(`OK : app/apple-icon.tsx`);
  if (groupTransform) console.log(`transform : ${groupTransform}`);
  console.log(`viewBox conservé : ${BRAND_LOGO_VIEWBOX}`);
}

main();
