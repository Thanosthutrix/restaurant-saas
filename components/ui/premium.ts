/**
 * Classes Tailwind réutilisables — style premium (slate / indigo).
 * Aucune logique métier.
 */
export const uiCard = "rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5";

export const uiCardMuted = "rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5";

export const uiInput =
  "rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

export const uiSelect = `${uiInput} cursor-pointer min-w-0`;

export const uiBtnPrimary =
  "rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50";

export const uiBtnPrimarySm =
  "rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50";

export const uiBtnSecondary =
  "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50";

export const uiBackLink = "text-sm font-semibold text-indigo-600 transition hover:text-indigo-500";

export const uiPageTitle = "text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl";

export const uiLead = "text-sm text-slate-500";

export const uiSectionTitle = "text-lg font-semibold text-slate-900";

export const uiSectionTitleSm = "text-sm font-semibold text-slate-900";

export const uiLabel = "text-xs font-medium text-slate-500";

export const uiMuted = "text-xs text-slate-500";

export const uiError = "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800";

export const uiWarn = "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900";

export const uiInfoBanner =
  "rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600";

export const uiListRow =
  "group flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:border-indigo-100 hover:shadow-md";

export const uiTableHead =
  "border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500";

export const uiBadgeEmerald =
  "inline-flex rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800";

export const uiBadgeAmber =
  "inline-flex rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900";

export const uiBadgeRose =
  "inline-flex rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800";

export const uiBadgeSlate =
  "inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700";

/** Bouton contour compact (liste composants, etc.) */
export const uiBtnOutlineSm =
  "rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50";

/** Segmented control (mode préparé / revente) */
export const uiSegmentActive =
  "rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm";

export const uiSegmentIdle =
  "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

/** Input type=file — bouton « Choisir un fichier » style premium */
export const uiFileInput =
  "w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 file:shadow-sm file:transition hover:file:bg-indigo-100";

/** Message de succès (création, etc.) */
export const uiSuccess =
  "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900";

/** Champs pleine largeur (auth, modales) */
export const uiInputBlock = `${uiInput} w-full`;

export const uiSelectBlock = `${uiSelect} w-full`;

export const uiBtnPrimaryBlock = `${uiBtnPrimary} w-full`;

export const uiFormLabel = "mb-1 block text-sm font-medium text-slate-700";

/** Lien secondaire (inscription / connexion) */
export const uiTextLink =
  "font-semibold text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-500";

/** Petit lien « Accueil » au-dessus des titres auth */
export const uiLinkSubtle = "text-xs font-semibold text-slate-500 transition hover:text-indigo-600";

/** Carte formulaire auth / onboarding (padding fixe) */
export const uiAuthCard = "rounded-2xl border border-slate-100 bg-white p-6 shadow-sm";

/** Lien dans un tableau (nom de plat, service…) */
export const uiTableLink =
  "font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:text-indigo-600 hover:decoration-indigo-300";
