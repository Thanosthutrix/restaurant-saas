import { Suspense } from "react";
import { MetaOAuthCompleteClient } from "./MetaOAuthCompleteClient";

export default function MetaOAuthCompletePage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-stone-500">Chargement…</p>}>
      <MetaOAuthCompleteClient />
    </Suspense>
  );
}
