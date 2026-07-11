"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import {
  createGoogleBusinessLocationAction,
  disconnectGoogleBusinessAction,
  getGoogleOAuthStartUrlAction,
  getRestaurantGoogleStateAction,
  linkGooglePlaceAction,
  refreshGoogleBusinessVerificationAction,
  searchGoogleBusinessCandidatesAction,
  syncGoogleBusinessHoursAction,
} from "@/app/restaurants/googleActions";
import type { GooglePlaceCandidate, RestaurantGoogleState } from "@/lib/google/types";

type Props = {
  restaurantId: string;
  initialState: RestaurantGoogleState;
  googleFlash?: "connected" | "error" | null;
};

function matchKindLabel(kind: GooglePlaceCandidate["matchKind"], adminUrl: string | null) {
  if (adminUrl) return "Déjà revendiquée — demande d'accès requise";
  if (kind === "unclaimed_hint") return "Probablement non revendiquée";
  if (kind === "existing") return "Fiche existante";
  return "Correspondance Maps";
}

export function GoogleBusinessSection({ restaurantId, initialState, googleFlash }: Props) {
  const [state, setState] = useState(initialState);
  const [candidates, setCandidates] = useState<GooglePlaceCandidate[]>([]);
  const [searchSource, setSearchSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    googleFlash === "error"
      ? "Connexion Google interrompue ou refusée."
      : googleFlash === "connected"
        ? null
        : null
  );
  const [success, setSuccess] = useState<string | null>(
    googleFlash === "connected" ? "Compte Google connecté." : null
  );
  const [copied, setCopied] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await searchGoogleBusinessCandidatesAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setCandidates([]);
      return;
    }
    setCandidates(result.data!.candidates);
    setSearchSource(result.data!.source);
    if (result.data!.candidates.length === 0) {
      setSuccess("Aucune fiche trouvée — vous pouvez en créer une si Google Business est connecté.");
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!state.profile.placeId) {
      void runSearch();
    }
  }, [runSearch, state.profile.placeId]);

  async function handleConnectGoogle() {
    setLoading(true);
    setError(null);
    const result = await getGoogleOAuthStartUrlAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.href = result.data!.url;
  }

  async function handleLink(candidate: GooglePlaceCandidate) {
    if (candidate.requestAdminRightsUrl) {
      window.open(candidate.requestAdminRightsUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await linkGooglePlaceAction(
      restaurantId,
      candidate.placeId,
      candidate.placeId.startsWith("locations/") ? candidate.placeId : null
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState(result.data!);
    setSuccess("Fiche Google liée à Ubion.");
    setCandidates([]);
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    const result = await createGoogleBusinessLocationAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState(result.data!);
    setSuccess("Fiche Google créée — finalisez la vérification sur Google si demandée.");
  }

  async function handleDisconnect() {
    if (!window.confirm("Déconnecter le compte Google Business de ce restaurant ?")) return;
    setLoading(true);
    const result = await disconnectGoogleBusinessAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState(result.data!);
    setSuccess("Compte Google déconnecté.");
  }

  async function handleRefreshVerification() {
    setLoading(true);
    setError(null);
    const result = await refreshGoogleBusinessVerificationAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState(result.data!);
    setSuccess("Statut de vérification mis à jour.");
  }

  async function handleSyncHours() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await syncGoogleBusinessHoursAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const refreshed = await getRestaurantGoogleStateAction(restaurantId);
    setState(refreshed);
    setSuccess(
      `Horaires ERP synchronisés vers Google (${new Date(result.data!.syncedAt).toLocaleString("fr-FR")}).`
    );
  }

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2000);
  }

  const connected = state.connection?.connectionStatus === "connected";
  const verified = state.connection?.verificationStatus === "verified";

  return (
    <section className="mt-6 space-y-4 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Fiche Google Business</h2>
            <p className="mt-1 text-xs text-stone-600">
              Recherche automatique, liaison Maps, sync horaires ERP → Google, liens réservation / avis.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <button
              type="button"
              disabled={loading || !state.oauthConfigured}
              onClick={() => void handleConnectGoogle()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Connecter Google
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleDisconnect()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" aria-hidden />
              Déconnecter
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void runSearch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <Search className="h-4 w-4" aria-hidden />
            Rechercher
          </button>
        </div>
      </div>

      {!state.oauthConfigured ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          OAuth Google non configuré. Ajoutez{" "}
          <code className="text-[0.65rem]">GOOGLE_OAUTH_CLIENT_ID</code> et{" "}
          <code className="text-[0.65rem]">GOOGLE_OAUTH_CLIENT_SECRET</code> dans{" "}
          <code className="text-[0.65rem]">.env.local</code>.
        </p>
      ) : null}

      {!state.placesConfigured ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Clé Maps manquante pour la recherche automatique (
          <code className="text-[0.65rem]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>).
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      {state.connection ? (
        <div className="rounded-md border border-stone-200 bg-white p-3 text-sm">
          <p className="font-medium text-stone-900">
            Compte Google : {state.connection.googleAccountEmail ?? "—"}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Vérification :{" "}
            <span className="font-semibold">
              {verified ? "Vérifiée" : state.connection.verificationStatus === "pending" ? "En attente" : "Non vérifiée"}
            </span>
            {state.connection.lastError ? ` · ${state.connection.lastError}` : null}
          </p>
          {state.connection.googleLocationName && !verified ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleRefreshVerification()}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Actualiser le statut de vérification
            </button>
          ) : null}
        </div>
      ) : null}

      {state.profile.placeId ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Fiche liée
              </p>
              <p className="mt-1 text-xs text-emerald-800">Place ID : {state.profile.placeId}</p>
              {state.profile.rating != null ? (
                <p className="mt-1 text-sm text-emerald-900">
                  Google · {state.profile.rating.toFixed(1)}/5
                  {state.profile.reviewCount != null ? ` (${state.profile.reviewCount} avis)` : null}
                </p>
              ) : null}
            </div>
            {state.profile.mapsUri ? (
              <a
                href={state.profile.mapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
              >
                Voir sur Maps
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {state.profile.reservationLink ? (
              <CopyLinkRow
                label="Lien réservation Ubion (à coller dans Google)"
                value={state.profile.reservationLink}
                copied={copied === "resa"}
                onCopy={() => void copyText("resa", state.profile.reservationLink)}
              />
            ) : null}
            {state.profile.reviewLink ? (
              <CopyLinkRow
                label="Lien avis Google"
                value={state.profile.reviewLink}
                copied={copied === "review"}
                onCopy={() => void copyText("review", state.profile.reviewLink!)}
              />
            ) : null}
          </div>

          {connected ? (
            <div className="mt-4 rounded-md border border-sky-100 bg-sky-50/50 p-3">
              <p className="text-xs text-stone-700">
                <strong className="font-medium text-stone-900">Sync horaires :</strong> le modèle hebdomadaire et les
                exceptions (fériés, vacances) sont poussés automatiquement vers Google à chaque enregistrement dans le
                planning.
              </p>
              {state.profile.syncedAt ? (
                <p className="mt-1 text-xs text-stone-500">
                  Dernière sync : {new Date(state.profile.syncedAt).toLocaleString("fr-FR")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-stone-500">Aucune synchronisation horaires effectuée pour l&apos;instant.</p>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSyncHours()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Synchroniser les horaires maintenant
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {searchSource ? (
            <p className="text-xs text-stone-500">
              Source de recherche : {searchSource === "google_business" ? "Google Business API" : "Google Places"}
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <ul className="space-y-2">
              {candidates.map((candidate) => (
                <li
                  key={`${candidate.placeId}-${candidate.name}`}
                  className="flex flex-col gap-3 rounded-md border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{candidate.name}</p>
                    {candidate.address ? (
                      <p className="text-xs text-stone-600">{candidate.address}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-sky-700">
                      {matchKindLabel(candidate.matchKind, candidate.requestAdminRightsUrl)}
                    </p>
                    {candidate.rating != null ? (
                      <p className="text-xs text-stone-500">
                        {candidate.rating.toFixed(1)}/5 · {candidate.reviewCount ?? 0} avis
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleLink(candidate)}
                    className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {candidate.requestAdminRightsUrl ? "Demander l'accès" : "Lier cette fiche"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {connected ? (
            <div className="rounded-md border border-dashed border-sky-300 bg-white p-4">
              <p className="text-sm font-medium text-stone-900">Aucune fiche trouvée ?</p>
              <p className="mt-1 text-xs text-stone-600">
                Ubion peut créer une fiche pré-remplie (nom, adresse, horaires ERP) puis lancer la
                vérification Google.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleCreate()}
                className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Créer la fiche Google
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function CopyLinkRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-2.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 truncate text-xs text-stone-700">{value}</p>
      <button
        type="button"
        onClick={onCopy}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
