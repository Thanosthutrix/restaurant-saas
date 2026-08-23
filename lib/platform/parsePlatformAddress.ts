import "server-only";

export type ParsedPostalAddress = {
  address_line1: string;
  post_code?: string;
  city?: string;
  country_code: string;
};

/** Parse une adresse française libre en composants EN16931 (approximation). */
export function parsePlatformAddress(address: string | null | undefined): ParsedPostalAddress {
  const trimmed = address?.trim();
  if (!trimmed) {
    return { address_line1: "Adresse non renseignée", country_code: "FR" };
  }

  const cpCity = trimmed.match(/^(.+?),?\s*(\d{5})\s+(.+?)(?:,?\s*FR(?:ANCE)?)?$/i);
  if (cpCity) {
    return {
      address_line1: cpCity[1].trim(),
      post_code: cpCity[2],
      city: cpCity[3].trim(),
      country_code: "FR",
    };
  }

  return { address_line1: trimmed, country_code: "FR" };
}

export function sirenFromSiret(siret: string | null | undefined): string | null {
  const digits = siret?.replace(/\D/g, "") ?? "";
  if (digits.length >= 9) return digits.slice(0, 9);
  return null;
}
