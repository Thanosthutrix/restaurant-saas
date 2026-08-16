/**
 * Cadre d'affichage du logo ubion dans l'app (header, sidebar, tab bar…).
 * Conserver ce viewBox lors du remplacement du fichier SVG source :
 * les classes Tailwind `h-* w-auto` ou `h-* w-*` s'appuient sur ce ratio.
 */
export const BRAND_LOGO_VIEWBOX = "338 86 324 336" as const;

/** Ratio largeur / hauteur ≈ 0,964 (presque carré, légèrement plus haut que large). */
export const BRAND_LOGO_ASPECT_RATIO = 324 / 336;
