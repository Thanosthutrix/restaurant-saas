/**
 * /admin/trials/new — formulaire de création d'un accès essai.
 * On sélectionne un restaurant existant (ou on entre l'ID) + durée + source.
 */

import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { getAllRestaurantsWithOwners } from "@/lib/admin";
import { NewTrialForm } from "./NewTrialForm";

export default async function NewTrialPage() {
  const restaurants = await getAllRestaurantsWithOwners();

  // Trier : pas d'essai actif en premier, puis par date d'inscription desc
  const sorted = [...restaurants].sort((a, b) => {
    const now = new Date();
    const aHasActive = a.trial && new Date(a.trial.expires_at) > now;
    const bHasActive = b.trial && new Date(b.trial.expires_at) > now;
    if (aHasActive && !bHasActive) return 1;
    if (!aHasActive && bHasActive) return -1;
    return 0;
  });

  return (
    <div className="p-8 max-w-xl mx-auto">
      <Link
        href="/admin/trials"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Retour aux essais
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <FlaskConical size={20} className="text-amber-500" />
        Créer un accès essai
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Accorde un accès temporaire à un client (démo, referral, etc.).
      </p>

      <NewTrialForm restaurants={sorted.map((r) => ({
        id: r.id,
        name: r.name,
        ownerEmail: r.owner_email,
        hasActiveTrial: !!(r.trial && new Date(r.trial.expires_at) > new Date()),
      }))} />
    </div>
  );
}
