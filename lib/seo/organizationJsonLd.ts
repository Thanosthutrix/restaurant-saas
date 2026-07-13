import { absoluteUrl } from "@/lib/seo/siteUrl";

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ubion",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
  };
}
