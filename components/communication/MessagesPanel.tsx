"use client";

import { useEffect, useState } from "react";
import { Instagram, MessageCircle, RefreshCw } from "lucide-react";
import {
  loadMetaConversationMessagesAction,
  loadMetaMessagingInboxAction,
  markMetaConversationReadAction,
  subscribeMetaMessagingWebhooksAction,
} from "@/app/communication/actions";
import type { MetaConversation, MetaMessage, MetaMessagingInbox } from "@/lib/meta/messagingTypes";
import {
  uiBtnPrimarySm,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiFormLabel,
  uiLead,
  uiWarn,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initialInbox: MetaMessagingInbox;
  metaConnected: boolean;
};

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function platformLabel(platform: MetaConversation["platform"]): string {
  return platform === "instagram_dm" ? "Instagram" : "Messenger";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessagesPanel({ restaurantId, initialInbox, metaConnected }: Props) {
  const [inbox, setInbox] = useState(initialInbox);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInbox.conversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<MetaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = inbox.conversations.find((c) => c.id === selectedId) ?? null;

  async function refreshInbox() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await loadMetaMessagingInboxAction(restaurantId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInbox(result.data!);
  }

  async function activateMessagingWebhooks() {
    setActivating(true);
    setError(null);
    setSuccess(null);
    const result = await subscribeMetaMessagingWebhooksAction(restaurantId);
    setActivating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInbox(result.data!);
    setSuccess("Réception des messages activée — envoyez un DM test.");
  }

  async function loadThread(conversationId: string) {
    setLoading(true);
    setError(null);
    const result = await loadMetaConversationMessagesAction(restaurantId, conversationId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages(result.data!.messages);
    setInbox(result.data!.inbox);
    void markMetaConversationReadAction(restaurantId, conversationId);
  }

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, restaurantId]);

  return (
    <div className={`${uiCard} space-y-4 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Messages</h2>
          <p className={`mt-1 ${uiLead}`}>
            Instagram DM et Facebook Messenger — synchronisés depuis Meta (Actualiser pour récupérer
            les nouveaux messages).
          </p>
        </div>
        <button
          type="button"
          onClick={refreshInbox}
          disabled={loading}
          className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Actualiser
        </button>
      </div>

      {!metaConnected ? (
        <p className={uiError}>Connectez Meta dans l&apos;onglet Comptes pour activer la messagerie.</p>
      ) : null}

      {!inbox.messagingScopesEnabled ? (
        <p className={uiWarn}>
          Messagerie non activée — ajoutez{" "}
          <code className="text-[11px]">META_OAUTH_INCLUDE_MESSAGING_SCOPES=true</code> sur le serveur,
          activez les permissions dans Meta for Developers, puis reconnectez vos comptes.
        </p>
      ) : null}

      {!inbox.webhookConfigured ? (
        <p className={uiWarn}>
          Webhook non configuré — définissez{" "}
          <code className="text-[11px]">META_WEBHOOK_VERIFY_TOKEN</code> sur Vercel et enregistrez
          l&apos;URL ci-dessous dans Meta for Developers → Webhooks.
        </p>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5">
          <p className="text-xs font-semibold text-stone-800">URL webhook Ubion</p>
          <code className="mt-1 block break-all text-[11px] text-stone-600">{inbox.webhookUrl}</code>
          {inbox.webhookSubscribedAt ? (
            <p className={`mt-1 text-xs ${uiLead}`}>
              Abonnement page enregistré le{" "}
              {new Date(inbox.webhookSubscribedAt).toLocaleString("fr-FR")}
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className={`text-xs ${uiWarn}`}>
                La page Facebook n&apos;est pas encore abonnée aux messages Meta. Sans cela, les DM
                n&apos;arrivent pas dans Ubion — même si le webhook Meta est validé.
              </p>
              <button
                type="button"
                onClick={activateMessagingWebhooks}
                disabled={activating || loading || !metaConnected}
                className={`inline-flex items-center gap-2 ${uiBtnPrimarySm}`}
              >
                <RefreshCw className={`h-4 w-4 ${activating ? "animate-spin" : ""}`} aria-hidden />
                Activer la réception des messages
              </button>
              <p className={`text-xs ${uiLead}`}>
                Si l&apos;activation échoue (permissions manquantes), reconnectez Meta dans Comptes
                via « Reconnecter et sélectionner ma page », puis recliquez ici.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-[420px] gap-0 overflow-hidden rounded-2xl border border-stone-200 lg:grid-cols-[minmax(240px,32%)_1fr]">
        <div className="border-b border-stone-200 bg-stone-50/50 lg:border-b-0 lg:border-r">
          <p className="border-b border-stone-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Conversations
          </p>
          {inbox.conversations.length === 0 ? (
            <p className={`p-4 text-sm ${uiLead}`}>
              Aucun message pour le moment. Envoyez un DM test à votre page Instagram ou Messenger.
            </p>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto">
              {inbox.conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    className={`flex w-full items-start gap-2 border-b border-stone-100 px-3 py-3 text-left transition hover:bg-white ${
                      selectedId === conv.id ? "bg-white" : ""
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-stone-400">
                      {conv.platform === "instagram_dm" ? (
                        <Instagram className="h-4 w-4 text-pink-600" aria-hidden />
                      ) : (
                        <FacebookIcon className="h-4 w-4 text-blue-600" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-stone-900">
                          {conv.customerName ?? `Client ${conv.externalUserId.slice(-6)}`}
                        </span>
                        {conv.unreadCount > 0 ? (
                          <span className="rounded-full bg-copper-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-stone-500">{platformLabel(conv.platform)}</span>
                      <span className="mt-0.5 block truncate text-xs text-stone-600">
                        {conv.lastMessagePreview ?? "—"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col bg-white">
          {selected ? (
            <>
              <div className="border-b border-stone-200 px-4 py-3">
                <p className="text-sm font-semibold text-stone-900">
                  {selected.customerName ?? `Client ${selected.externalUserId.slice(-6)}`}
                </p>
                <p className={`text-xs ${uiLead}`}>
                  {platformLabel(selected.platform)} · {formatTime(selected.lastMessageAt)}
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.direction === "outbound"
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-900"
                      }`}
                    >
                      {msg.text ? <p className="whitespace-pre-wrap">{msg.text}</p> : null}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 ? (
                        <p className="mt-1 text-xs opacity-80">
                          {(msg.attachments[0] as { type?: string }).type ?? "Pièce jointe"}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] opacity-60">{formatTime(msg.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && !loading ? (
                  <p className={`text-center text-sm ${uiLead}`}>Aucun message dans ce fil.</p>
                ) : null}
              </div>
              <p className={`border-t border-stone-100 px-4 py-2 text-center text-xs ${uiLead}`}>
                Réponses depuis Ubion — Phase 2 (réservation automatique).
              </p>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-stone-400">
              <MessageCircle className="h-10 w-10" aria-hidden />
              <p className="text-sm">Sélectionnez une conversation</p>
            </div>
          )}
        </div>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
    </div>
  );
}
