"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Instagram,
  Link2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import {
  disconnectMetaAction,
  getMetaOAuthStartUrlAction,
  linkMetaFacebookPageAction,
  linkMetaFacebookPageFromHintAction,
  refreshInstagramStoriesAction,
  refreshPendingMetaPagesAction,
  saveSocialLinksAction,
} from "@/app/restaurants/socialActions";
import type { RestaurantSocialState } from "@/lib/meta/metaDb";
import {
  uiBtnOutlineSm,
  uiBtnPrimarySm,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiFormLabel,
  uiInputBlock,
  uiLead,
  uiListRow,
  uiSuccess,
  uiWarn,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initialState: RestaurantSocialState;
  metaFlash?: "connected" | "error" | null;
  metaMessage?: string | null;
  onStateChange?: (state: RestaurantSocialState) => void;
};

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

export function SocialAccountsPanel({ restaurantId, initialState, metaFlash, metaMessage, onStateChange }: Props) {
  const [state, setState] = useState(initialState);
  const [instagramInput, setInstagramInput] = useState(
    state.links.instagramUsername
      ? `@${state.links.instagramUsername}`
      : state.links.instagramUrl ?? ""
  );
  const [facebookInput, setFacebookInput] = useState(state.links.facebookUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    metaFlash === "error"
      ? metaMessage?.trim() || "Connexion Meta interrompue ou refusée."
      : null
  );
  const [success, setSuccess] = useState<string | null>(
    metaFlash === "connected"
      ? "Compte Facebook connecté — choisissez la page à lier."
      : null
  );

  function applyState(next: RestaurantSocialState) {
    setState(next);
    onStateChange?.(next);
  }

  async function handleSaveLinks() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await saveSocialLinksAction({
      restaurantId,
      instagramInput,
      facebookInput,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyState(result.data!);
    setSuccess("Liens enregistrés — visibles sur le portail public.");
  }

  async function handleConnectMeta(rerequest = false) {
    setLoading(true);
    setError(null);
    const result = await getMetaOAuthStartUrlAction(restaurantId, { rerequest });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.href = result.data!.url;
  }

  async function handleLinkPage(pageId: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await linkMetaFacebookPageAction(restaurantId, pageId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const refreshed = await saveSocialLinksAction({
      restaurantId,
      instagramInput,
      facebookInput,
    });
    if (refreshed.ok) applyState(refreshed.data!);
    else {
      applyState({
        ...state,
        meta: result.data!,
        pendingPages: [],
      });
    }
    setSuccess(
      result.data!.instagramBusinessAccountId
        ? "Page liée — vous pouvez publier et consulter vos contenus."
        : "Page Facebook liée (sans compte Instagram Business)."
    );
  }

  async function handleRefreshStories() {
    setLoading(true);
    setError(null);
    const result = await refreshInstagramStoriesAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyState({ ...state, meta: result.data ?? null });
    const count = result.data?.stories.length ?? 0;
    setSuccess(
      count > 0
        ? `${count} story${count > 1 ? "s" : ""} active${count > 1 ? "s" : ""}.`
        : "Aucune story active pour le moment."
    );
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    const result = await disconnectMetaAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyState(result.data!);
    setSuccess("Connexion Meta supprimée.");
  }

  const meta = state.meta;
  const hasStories = (meta?.stories.length ?? 0) > 0;
  const awaitingPageLink = Boolean(
    meta?.metaAccountName && !meta.facebookPageId && meta.connectionStatus !== "connected"
  );

  useEffect(() => {
    if (metaFlash !== "connected") return;
    void refreshPendingMetaPagesAction(restaurantId).then((result) => {
      if (result.ok && result.data) applyState(result.data);
    });
  }, [metaFlash, restaurantId]);

  async function handleLinkFromSavedUrl() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    let baseState = state;
    if (facebookInput.trim()) {
      const saved = await saveSocialLinksAction({
        restaurantId,
        instagramInput,
        facebookInput,
      });
      if (!saved.ok) {
        setLoading(false);
        setError(saved.error);
        return;
      }
      baseState = saved.data!;
      applyState(baseState);
    }

    const result = await linkMetaFacebookPageFromHintAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyState({
      ...baseState,
      meta: result.data!,
      pendingPages: [],
      pendingPagesError: null,
    });
    setSuccess(
      result.data!.instagramBusinessAccountId
        ? "Page liée depuis l'URL enregistrée — publication et stories disponibles."
        : "Page Facebook liée (sans compte Instagram Business détecté)."
    );
  }

  async function handleRefreshPages() {
    setLoading(true);
    setError(null);
    const result = await refreshPendingMetaPagesAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyState(result.data!);
    if (result.data!.pendingPages.length === 0 && result.data!.pendingPagesError) {
      setError(result.data!.pendingPagesError);
    } else if (result.data!.pendingPages.length > 0) {
      setSuccess("Choisissez la page Facebook à lier à l'établissement.");
    } else if (result.data!.meta?.connectionStatus === "connected") {
      setSuccess("Page Facebook liée.");
    } else if (result.data!.pendingPagesError) {
      setError(result.data!.pendingPagesError);
    } else {
      setError(
        "Meta n'a pas partagé de page avec Ubion. Reconnectez-vous et cochez votre page à l'étape « Choisissez les Pages »."
      );
    }
  }

  return (
    <div className={`${uiCard} space-y-5 p-5 sm:p-6`}>
      <div>
        <h2 className="text-base font-semibold text-stone-900">Comptes & liens publics</h2>
        <p className={`mt-1 ${uiLead}`}>
          Liens affichés sur votre fiche publique. Connexion Meta pour publier et synchroniser
          Instagram / Facebook depuis l&apos;ERP.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={uiFormLabel}>Instagram</label>
          <input
            className={uiInputBlock}
            placeholder="@votrerestaurant ou URL"
            value={instagramInput}
            onChange={(e) => setInstagramInput(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className={uiFormLabel}>Facebook</label>
          <input
            className={uiInputBlock}
            placeholder="Page Facebook ou URL"
            value={facebookInput}
            onChange={(e) => setFacebookInput(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSaveLinks}
          disabled={loading}
          className={`inline-flex items-center gap-2 ${uiBtnPrimarySm}`}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Enregistrer les liens
        </button>
        {(state.links.instagramUrl || state.links.facebookUrl) && (
          <div className="flex items-center gap-3 text-sm">
            {state.links.instagramUrl ? (
              <a
                href={state.links.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-pink-600 hover:underline"
              >
                <Instagram className="h-4 w-4" aria-hidden />
                Instagram
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
            {state.links.facebookUrl ? (
              <a
                href={state.links.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
              >
                <FacebookIcon className="h-4 w-4" />
                Facebook
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-stone-100 pt-5">
        <h3 className="text-sm font-semibold text-stone-900">Connexion Meta (publication & stories)</h3>
        <p className={`mt-1 ${uiLead}`}>
          Connectez-vous avec le compte <strong>Facebook</strong> qui administre la page du restaurant
          (pas directement Instagram). Instagram Business doit déjà être lié à cette page dans Meta
          Business Suite.
        </p>
        <p className={`mt-2 ${uiLead}`}>
          Sur iPhone : restez dans Safari, évitez l&apos;app Instagram. Si Instagram demande un changement
          de mot de passe, faites-le d&apos;abord dans l&apos;app Instagram, puis relancez la connexion
          depuis Ubion.
        </p>

        {state.metaOAuthConfigured && !state.publishScopesEnabled ? (
          <div className={`mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950`}>
            <p className="font-semibold">Publication depuis Ubion (configuration Meta requise)</p>
            <p className={`mt-1 ${uiLead}`}>
              La connexion Meta fonctionne en mode lecture (stories, fil). Pour publier, activez d&apos;abord{" "}
              <code className="text-[11px]">pages_manage_posts</code> et{" "}
              <code className="text-[11px]">instagram_content_publish</code> dans Meta for Developers
              (Use Cases → Gérer la Page → Permissions « Ready for testing »), puis ajoutez{" "}
              <code className="text-[11px]">META_OAUTH_INCLUDE_PUBLISH_SCOPES=true</code> sur le serveur et
              reconnectez.
            </p>
          </div>
        ) : null}

        {state.metaOAuthConfigured ? (
          <div className={`mt-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5`}>
            <p className="text-xs font-semibold text-stone-800">URI de redirection Ubion</p>
            <code className="mt-1 block break-all text-[11px] text-stone-600">
              {state.oauthRedirectUri}
            </code>
          </div>
        ) : (
          <p className={`mt-3 ${uiWarn}`}>
            OAuth Meta non configuré — ajoutez META_APP_ID et META_APP_SECRET.
          </p>
        )}

        {state.metaOAuthConfigured && meta?.connectionStatus === "connected" && meta.facebookPageId ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
              <p>
                <strong>{meta.facebookPageName}</strong>
                {meta.instagramUsername ? ` · @${meta.instagramUsername}` : ""}
              </p>
              {meta.storiesSyncedAt ? (
                <p className={`mt-1 ${uiLead}`}>
                  Dernière sync stories : {new Date(meta.storiesSyncedAt).toLocaleString("fr-FR")}
                  {hasStories ? ` · ${meta.stories.length} story(s)` : " · aucune story active"}
                </p>
              ) : null}
              {meta.lastError ? (
                <p className="mt-1 text-xs text-amber-800">{meta.lastError}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRefreshStories}
                disabled={loading}
                className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Rafraîchir les stories
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className={`inline-flex items-center gap-2 ${uiBtnOutlineSm} border-rose-200 text-rose-700 hover:bg-rose-50`}
              >
                <Unplug className="h-4 w-4" aria-hidden />
                Déconnecter
              </button>
            </div>
          </div>
        ) : awaitingPageLink || state.pendingPages.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-stone-700">
              Compte <strong>{meta?.metaAccountName}</strong> connecté — choisissez la page :
            </p>
            {state.pendingPages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => handleLinkPage(page.id)}
                disabled={loading}
                className={`${uiListRow} w-full text-left`}
              >
                <span>
                  <strong>{page.name}</strong>
                  {page.instagramUsername ? (
                    <span className="text-stone-500"> · @{page.instagramUsername}</span>
                  ) : (
                    <span className="text-amber-700"> · pas d&apos;Instagram Business</span>
                  )}
                </span>
                <Link2 className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
              </button>
            ))}
            {state.pendingPages.length === 0 ? (
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                {state.pendingPagesError ? (
                  <p className={`text-sm ${uiError}`}>{state.pendingPagesError}</p>
                ) : (
                  <p className={`text-sm ${uiLead}`}>
                    Si votre page apparaît dans Meta Business Suite mais pas ici, Meta ne l&apos;a
                    probablement pas encore partagée avec Ubion. Cliquez « Reconnecter et sélectionner
                    ma page » et cochez <strong>Ubion test</strong> à l&apos;étape « Choisissez les
                    Pages ».
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshPages}
                    disabled={loading}
                    className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                    Charger mes pages
                  </button>
                  {(state.links.facebookUrl || facebookInput.trim()) ? (
                    <button
                      type="button"
                      onClick={handleLinkFromSavedUrl}
                      disabled={loading}
                      className={`inline-flex items-center gap-2 ${uiBtnPrimarySm}`}
                    >
                      <Link2 className="h-4 w-4" aria-hidden />
                      Lier la page Facebook renseignée
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleConnectMeta(true)}
                    disabled={loading}
                    className={`inline-flex items-center gap-2 ${uiBtnOutlineSm}`}
                  >
                    Reconnecter et sélectionner ma page
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : state.metaOAuthConfigured ? (
          <button
            type="button"
            onClick={() => handleConnectMeta(false)}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#166fe5] disabled:opacity-50"
          >
            <FacebookIcon className="h-4 w-4" />
            Connecter Facebook / Instagram
          </button>
        ) : null}
      </div>

      {error ? <p className={uiError}>{error}</p> : null}
      {success ? <p className={uiSuccess}>{success}</p> : null}
    </div>
  );
}
