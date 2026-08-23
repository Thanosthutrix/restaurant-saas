"use client";

/**
 * Boutons d'action admin sur un restaurant.
 * Client Component car il utilise des états locaux (dialog, confirmation).
 */

import { useState } from "react";
import {
  FlaskConical,
  ShieldOff,
  ShieldCheck,
  Mail,
  Loader2,
  KeyRound,
  Eye,
  ExternalLink,
} from "lucide-react";

type Props = {
  restaurantId: string;
  ownerId: string;
  ownerEmail: string | null;
  isSuspended: boolean;
  suspendedReason: string | null;
  hasActiveTrial: boolean;
};

export function AdminActionButtons({
  restaurantId,
  ownerId,
  ownerEmail,
  isSuspended,
  suspendedReason,
  hasActiveTrial,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleTrial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("trial");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          days: Number(fd.get("days")),
          source: fd.get("source"),
          notes: fd.get("notes"),
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      setMessage({ type: "success", text: "Accès d'essai créé !" });
      setShowTrialDialog(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la création de l'essai." });
    } finally {
      setLoading(null);
    }
  }

  async function handleSuspend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("suspend");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          suspend: !isSuspended,
          reason: fd.get("reason"),
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      setMessage({
        type: "success",
        text: isSuspended ? "Compte débloqué !" : "Compte suspendu.",
      });
      setShowSuspendDialog(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'action." });
    } finally {
      setLoading(null);
    }
  }

  async function handleResetPassword() {
    setLoading("reset");
    setMessage(null);
    setResetLink(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error(data.error ?? "Erreur serveur");
      setResetLink(data.link);
      setMessage({
        type: "success",
        text: `Lien de réinitialisation généré pour ${data.email ?? ownerEmail ?? "l'utilisateur"}.`,
      });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la génération du lien." });
    } finally {
      setLoading(null);
    }
  }

  async function handleImpersonate() {
    setLoading("impersonate");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error(data.error ?? "Erreur serveur");
      setImpersonateLink(data.link);
    } catch {
      setMessage({ type: "error", text: "Impossible de générer le lien d'accès." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {/* Message de retour */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-600 border border-red-100"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-2">
        {/* Accès essai */}
        <button
          onClick={() => setShowTrialDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FlaskConical size={15} />
          {hasActiveTrial ? "Prolonger l'essai" : "Donner accès essai"}
        </button>

        {/* Suspendre / Débloquer */}
        <button
          onClick={() => setShowSuspendDialog(true)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                      transition-colors border ${
                        isSuspended
                          ? "border-green-200 text-green-700 hover:bg-green-50"
                          : "border-red-200 text-red-600 hover:bg-red-50"
                      }`}
        >
          {isSuspended ? (
            <>
              <ShieldCheck size={15} /> Débloquer
            </>
          ) : (
            <>
              <ShieldOff size={15} /> Suspendre
            </>
          )}
        </button>

        {/* Email */}
        {ownerEmail && (
          <a
            href={`mailto:${ownerEmail}`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                       border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Mail size={15} />
            Envoyer un email
          </a>
        )}

        {/* Reset mot de passe */}
        <button
          onClick={handleResetPassword}
          disabled={loading === "reset"}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                     border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors
                     disabled:opacity-50"
        >
          {loading === "reset" ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          Reset MDP
        </button>

        {/* Voir en tant que client */}
        <button
          onClick={handleImpersonate}
          disabled={loading === "impersonate"}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                     border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors
                     disabled:opacity-50"
        >
          {loading === "impersonate" ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
          Voir en tant que client
        </button>
      </div>

      {/* Lien de reset MDP */}
      {resetLink && (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-medium text-amber-800">
            Lien de réinitialisation (usage unique) — à transmettre au client :
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-xs text-amber-900">{resetLink}</code>
            <a
              href={resetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-amber-600"
            >
              <ExternalLink size={11} />
              Ouvrir
            </a>
          </div>
        </div>
      )}

      {/* Lien d'impersonation */}
      {impersonateLink && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-600 font-medium mb-1">
            Lien de connexion temporaire (usage unique, 24h) :
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-blue-800 break-all flex-1">{impersonateLink}</code>
            <a
              href={impersonateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600
                         text-white text-xs rounded font-medium transition-colors"
            >
              <ExternalLink size={11} />
              Ouvrir
            </a>
          </div>
          <p className="text-xs text-blue-400 mt-1">
            ⚠️ Ce lien te connecte en tant que ce client — déconnecte-toi de ton compte admin avant de l&apos;ouvrir dans le même navigateur.
          </p>
        </div>
      )}

      {/* ── Dialog essai ─────────────────────────────────────── */}
      {showTrialDialog && (
        <Dialog title="Accès d'essai" onClose={() => setShowTrialDialog(false)}>
          <form onSubmit={handleTrial} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée (jours)
              </label>
              <input
                type="number"
                name="days"
                defaultValue={14}
                min={1}
                max={90}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <select
                name="source"
                defaultValue="demo_by_medhi"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="demo_by_medhi">Démarché par Medhi</option>
                <option value="organic">Organique (inscription spontanée)</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optionnel)
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Ex: rencontré au salon CHR Paris, intéressé par le module factures"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading === "trial"}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500
                           hover:bg-amber-600 text-white text-sm font-medium rounded-lg
                           transition-colors disabled:opacity-60"
              >
                {loading === "trial" && <Loader2 size={14} className="animate-spin" />}
                Accorder l&apos;accès
              </button>
              <button
                type="button"
                onClick={() => setShowTrialDialog(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700
                           border border-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ── Dialog suspension ─────────────────────────────────── */}
      {showSuspendDialog && (
        <Dialog
          title={isSuspended ? "Débloquer le compte" : "Suspendre le compte"}
          onClose={() => setShowSuspendDialog(false)}
        >
          <form onSubmit={handleSuspend} className="space-y-4">
            {!isSuspended && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison de la suspension
                </label>
                <textarea
                  name="reason"
                  rows={2}
                  defaultValue={suspendedReason ?? ""}
                  placeholder="Ex: impayé depuis 30 jours, en attente de régularisation"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
              </div>
            )}
            {isSuspended && (
              <p className="text-sm text-gray-600">
                Confirmer le déblocage du compte ?{" "}
                {suspendedReason && (
                  <span className="text-gray-400">
                    (suspendu pour : {suspendedReason})
                  </span>
                )}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading === "suspend"}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-white
                           text-sm font-medium rounded-lg transition-colors disabled:opacity-60 ${
                             isSuspended
                               ? "bg-green-500 hover:bg-green-600"
                               : "bg-red-500 hover:bg-red-600"
                           }`}
              >
                {loading === "suspend" && <Loader2 size={14} className="animate-spin" />}
                {isSuspended ? "Débloquer" : "Suspendre"}
              </button>
              <button
                type="button"
                onClick={() => setShowSuspendDialog(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700
                           border border-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

// ── Dialog générique ────────────────────────────────────────────────────────

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Contenu */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
