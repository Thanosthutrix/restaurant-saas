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
  type RestaurantSocialState,
} from "@/app/restaurants/socialActions";

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
    <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
          <Instagram className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-stone-900">Instagram & Facebook</h2>
          <p className="mt-1 text-sm text-stone-500">
            Affichez vos pages sur le portail public. Connectez Meta pour importer les stories
            Instagram actives (24 h).
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Instagram
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="@votrerestaurant ou URL"
            value={instagramInput}
            onChange={(e) => setInstagramInput(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Facebook
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="Page Facebook ou URL"
            value={facebookInput}
            onChange={(e) => setFacebookInput(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSaveLinks}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Enregistrer les liens
        </button>

        {(state.links.instagramUrl || state.links.facebookUrl) && (
          <div className="flex items-center gap-2 text-sm text-stone-600">
            {state.links.instagramUrl ? (
              <a
                href={state.links.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-pink-600 hover:underline"
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
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <FacebookIcon className="h-4 w-4" />
                Facebook
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-stone-100 pt-5">
        <h3 className="text-sm font-semibold text-stone-800">Stories Instagram (API Meta)</h3>
        <p className="mt-1 text-xs text-stone-500">
          Nécessite un compte Instagram Business lié à une page Facebook. Les stories s&apos;affichent
          sur la fiche publique du restaurant.
        </p>

        {state.metaOAuthConfigured ? (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            <p className="font-semibold">URI de redirection utilisée par Ubion :</p>
            <code className="mt-1 block break-all text-[11px]">{state.oauthRedirectUri}</code>
            <p className="mt-2 text-sky-800">
              À ajouter dans <strong>Facebook Login for Business → Paramètres</strong> → URI de
              redirection OAuth valides. Enregistrez puis testez le bouton Connecter.
            </p>
          </div>
        ) : null}

        {!state.metaOAuthConfigured ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            OAuth Meta non configuré — ajoutez META_APP_ID et META_APP_SECRET pour activer les
            stories automatiques. Les liens manuels ci-dessus restent disponibles.
          </p>
        ) : meta?.connectionStatus === "connected" && meta.facebookPageId ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p>
                <strong>{meta.facebookPageName}</strong>
                {meta.instagramUsername ? ` · @${meta.instagramUsername}` : ""}
              </p>
              {meta.storiesSyncedAt ? (
                <p className="mt-1 text-xs text-emerald-800">
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
                className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Rafraîchir les stories
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
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
                    className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-pink-400"
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
                className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-3 py-2.5 text-left text-sm hover:border-pink-300 hover:bg-pink-50/50 disabled:opacity-50"
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
        ) : (
          <button
            type="button"
            onClick={handleConnectMeta}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166fe5] disabled:opacity-50"
          >
            <FacebookIcon className="h-4 w-4" />
            Connecter Facebook / Instagram
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}
    </section>
  );
}
