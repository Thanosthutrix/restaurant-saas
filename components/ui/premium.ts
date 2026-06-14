/**
 * Classes Tailwind réutilisables — identité « encre & cuivre ».
 * Base : stone (neutres chauds) · Accent : copper-700 cuivre · Succès : emerald.
 * Aucune logique métier.
 */
export const uiCard = "rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm sm:p-5";

export const uiCardMuted = "rounded-xl border border-stone-200/60 bg-stone-50/90 px-3 py-2.5";

export const uiInput =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-copper-600 focus:outline-none focus:ring-2 focus:ring-copper-600/25";

export const uiSelect = `${uiInput} cursor-pointer min-w-0`;

export const uiBtnPrimary =
  "copper-sheen rounded-xl bg-copper-700 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50";

export const uiBtnPrimarySm =
  "copper-sheen rounded-xl bg-copper-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50";

export const uiBtnSecondary =
  "rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-50";

export const uiBackLink = "text-sm font-semibold text-copper-700 transition hover:text-copper-600";

export const uiPageTitle = "text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl";

export const uiLead = "text-sm text-stone-500";

export const uiSectionTitle = "text-lg font-semibold text-stone-900";

export const uiSectionTitleSm = "text-sm font-semibold text-stone-900";

export const uiLabel = "text-xs font-medium text-stone-500";

export const uiMuted = "text-xs text-stone-500";

export const uiError = "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800";

export const uiWarn = "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900";

export const uiInfoBanner =
  "rounded-2xl border border-stone-200/60 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-600";

export const uiListRow =
  "group flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md";

export const uiTableHead =
  "border-b border-stone-200/70 bg-stone-50/90 text-xs font-semibold uppercase tracking-wide text-stone-500";

export const uiBadgeEmerald =
  "inline-flex rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800";

export const uiBadgeAmber =
  "inline-flex rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900";

export const uiBadgeRose =
  "inline-flex rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800";

export const uiBadgeSlate =
  "inline-flex rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700";

/** Bouton contour compact (liste composants, etc.) */
export const uiBtnOutlineSm =
  "rounded-xl border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-50";

/** Segmented control (mode préparé / revente) */
export const uiSegmentActive =
  "copper-sheen rounded-xl bg-copper-700 px-3 py-1.5 text-sm font-semibold text-white";

export const uiSegmentIdle =
  "rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50";

/** Input type=file — bouton « Choisir un fichier » style premium */
export const uiFileInput =
  "w-full text-sm text-stone-600 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-copper-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-copper-800 file:shadow-sm file:transition hover:file:bg-copper-100";

/** Message de succès (création, etc.) */
export const uiSuccess =
  "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900";

/** Champs pleine largeur (auth, modales) */
export const uiInputBlock = `${uiInput} w-full`;

export const uiSelectBlock = `${uiSelect} w-full`;

export const uiBtnPrimaryBlock = `${uiBtnPrimary} w-full`;

export const uiFormLabel = "mb-1 block text-sm font-medium text-stone-700";

/** Lien secondaire (inscription / connexion) */
export const uiTextLink =
  "font-semibold text-copper-700 underline decoration-copper-200 underline-offset-2 hover:text-copper-600";

/** Petit lien « Accueil » au-dessus des titres auth */
export const uiLinkSubtle = "text-xs font-semibold text-stone-500 transition hover:text-copper-700";

/** Carte formulaire auth / onboarding (padding fixe) */
export const uiAuthCard = "rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm";

/** Lien dans un tableau (nom de plat, service…) */
export const uiTableLink =
  "font-semibold text-stone-900 underline decoration-stone-300 underline-offset-2 transition hover:text-copper-700 hover:decoration-copper-300";

/** Bouton primaire tactile — écrans de service (salle, caisse, hygiène),
    utilisés debout sur tablette : cible ≥ 48px. */
export const uiBtnTouch =
  "copper-sheen rounded-xl bg-copper-700 min-h-[48px] px-5 text-base font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50";

/** Variante secondaire tactile (annuler, fermer) — même gabarit ≥ 48px. */
export const uiBtnTouchSecondary =
  "rounded-xl border border-stone-200 bg-white min-h-[48px] px-5 text-base font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-50";

/** Grand chiffre clé (CA, couverts, score) — tabulaire pour l'alignement. */
export const uiStatValue = "text-3xl font-semibold tabular-nums tracking-tight text-stone-900";

/** Libellé au-dessus d'un chiffre clé. */
export const uiStatLabel = "text-xs font-medium text-stone-500";
