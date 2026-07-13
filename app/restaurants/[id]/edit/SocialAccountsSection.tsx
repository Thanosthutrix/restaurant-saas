"use client";

import { useState } from "react";
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
  refreshInstagramStoriesAction,
  saveSocialLinksAction,
} from "@/app/restaurants/socialActions";
import type { RestaurantSocialState } from "@/lib/meta/metaDb";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import {
  uiBtnOutlineSm,
  uiBtnPrimarySm,
  uiBtnSecondary,
  uiCardMuted,
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
};

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

export function SocialAccountsSection({ restaurantId, initialState, metaFlash }: Props) {
  const [state, setState] = useState(initialState);
  const [instagramInput, setInstagramInput] = useState(
    state.links.instagramUsername
      ? `@${state.links.instagramUsername}`
      : state.links.instagramUrl ?? ""
  );
  const [facebookInput, setFacebookInput] = useState(state.links.facebookUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    metaFlash === "error" ? "Connexion Meta interrompue ou refusée." : null
  );
  const [success, setSuccess] = useState<string | null>(
    metaFlash === "connected"
      ? "Compte Facebook connecté — choisissez la page à lier."
      : null
  );

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
    setState(result.data!);
    setSuccess("Liens enregistrés — visibles sur le portail public.");
  }

  async function handleConnectMeta() {
    setLoading(true);
    setError(null);
    const result = await getMetaOAuthStartUrlAction(restaurantId);
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
    if (refreshed.ok) setState(refreshed.data!);
    else {
      setState({
        ...state,
        meta: result.data!,
        pendingPages: [],
      });
    }
    setSuccess(
      result.data!.instagramBusinessAccountId
        ? "Page liée — stories Instagram synchronisées."
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
    setState((prev) => ({ ...prev, meta: result.data ?? null }));
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
    setState(result.data!);
    setSuccess("Connexion Meta supprimée.");
  }

  const meta = state.meta;
  const hasStories = (meta?.stories.length ?? 0) > 0;

  return (
    <EstablishmentSection
      icon={Instagram}
      iconTone="bg-gradient-to-br from-purple-50 to-pink-50 text-pink-700 ring-pink-100"
      title="Instagram & Facebook"
      subtitle="Liens sur le portail public et stories Instagram via l'API Meta (compte Business)."
    >
      <div className="space-y-5">
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
          <h3 className="text-sm font-semibold text-stone-900">Stories Instagram (API Meta)</h3>
          <p className={`mt-1 ${uiLead}`}>
            Compte Instagram Business lié à une page Facebook. Affichage sur la fiche publique.
          </p>

          {state.metaOAuthConfigured ? (
            <div className={`mt-3 ${uiCardMuted}`}>
              <p className="text-xs font-semibold text-stone-800">URI de redirection Ubion</p>
              <code className="mt-1 block break-all text-[11px] text-stone-600">
                {state.oauthRedirectUri}
              </code>
              <p className={`mt-2 ${uiLead}`}>
                À ajouter dans Facebook Login for Business → URI de redirection OAuth valides.
              </p>
            </div>
          ) : (
            <p className={`mt-3 ${uiWarn}`}>
              OAuth Meta non configuré — ajoutez META_APP_ID et META_APP_SECRET. Les liens manuels
              restent disponibles.
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
                    Dernière sync : {new Date(meta.storiesSyncedAt).toLocaleString("fr-FR")}
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
              {hasStories ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {meta!.stories.map((story) => (
                    <a
                      key={story.id}
                      href={story.permalink ?? state.links.instagramUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-pink-400 ring-1 ring-pink-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={story.thumbnailUrl || story.mediaUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : state.pendingPages.length > 0 ? (
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
            </div>
          ) : state.metaOAuthConfigured ? (
            <button
              type="button"
              onClick={handleConnectMeta}
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
    </EstablishmentSection>
  );
}
