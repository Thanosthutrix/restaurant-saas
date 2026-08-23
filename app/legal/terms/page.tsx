import type { Metadata } from "next";
import { CgvCguDocument } from "@/components/legal/CgvCguDocument";
import { absoluteUrl } from "@/lib/seo/siteUrl";

export const metadata: Metadata = {
  title: "CGV / CGU",
  description:
    "Conditions générales de vente et d'utilisation du service Ubion Pro et du portail ubion.fr.",
  openGraph: {
    title: "CGV / CGU · Ubion",
    url: absoluteUrl("/legal/terms"),
  },
};

export default function TermsPage() {
  return <CgvCguDocument />;
}
