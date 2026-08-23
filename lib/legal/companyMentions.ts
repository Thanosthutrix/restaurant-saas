import "server-only";

import { getPlatformCompany } from "@/lib/platform/companyDb";

/** Mentions légales Ubion — fallback si profil société non renseigné. */
export const UBION_LEGAL_FALLBACK = {
  forme: "[Forme juridique, ex. : SASU]",
  capital: "[Montant]",
  rcsVille: "[Ville]",
  siren: "[Numéro SIREN/RCS]",
  siege: "[Adresse complète]",
  hebergeur:
    "[Nom de l'hébergeur, ex. : Supabase Inc. / Amazon Web Services EMEA SARL, adresse]",
  contactEmail: "contact@ubion.fr",
} as const;

/** @deprecated Utiliser getUbionLegalMentions() côté serveur. */
export const UBION_LEGAL = UBION_LEGAL_FALLBACK;

export type UbionLegalMentions = {
  forme: string;
  capital: string;
  rcsVille: string;
  siren: string;
  siege: string;
  hebergeur: string;
  contactEmail: string;
};

/** Mentions légales depuis le profil société admin, avec repli sur les placeholders. */
export async function getUbionLegalMentions(): Promise<UbionLegalMentions> {
  const company = await getPlatformCompany();
  if (!company) return { ...UBION_LEGAL_FALLBACK };

  return {
    forme: company.legal_form ?? UBION_LEGAL_FALLBACK.forme,
    capital: company.capital ?? UBION_LEGAL_FALLBACK.capital,
    rcsVille: company.rcs_ville ?? UBION_LEGAL_FALLBACK.rcsVille,
    siren: company.siren ?? UBION_LEGAL_FALLBACK.siren,
    siege: company.address ?? UBION_LEGAL_FALLBACK.siege,
    hebergeur: UBION_LEGAL_FALLBACK.hebergeur,
    contactEmail: company.contact_email ?? UBION_LEGAL_FALLBACK.contactEmail,
  };
}
