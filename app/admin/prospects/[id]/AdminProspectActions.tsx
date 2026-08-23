"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, Mail, RefreshCw } from "lucide-react";
import type { AdminProspectStatus } from "@/lib/admin/types";

type Props = {
  prospectId: string;
  inviteUrl: string | null;
  currentStatus: AdminProspectStatus;
};

const STATUS_OPTIONS: { value: AdminProspectStatus; label: string }[] = [
  { value: "new", label: "Nouveau" },
  { value: "contacted", label: "Contacté" },
  { value: "demo_scheduled", label: "Démo planifiée" },
  { value: "invited", label: "Invité" },
  { value: "signed_up", label: "Inscrit" },
  { value: "lost", label: "Perdu" },
];

export function AdminProspectActions({ prospectId, inviteUrl, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [link, setLink] = useState(inviteUrl ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleStatusChange(next: AdminProspectStatus) {
    setLoading("status");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/prospect/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      setStatus(next);
      setSuccess("Statut mis à jour.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(null);
    }
  }

  async function handleInvite(sendEmail: boolean) {
    setLoading(sendEmail ? "invite-email" : "invite");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/prospect/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, sendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      setLink(data.inviteUrl);
      setSuccess(sendEmail ? "Invitation renvoyée par email." : "Lien régénéré.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(null);
    }
  }

  async function handleNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading("note");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/prospect/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, content: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      setNote("");
      setSuccess("Note ajoutée.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(null);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canInvite = status !== "signed_up" && status !== "lost";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Statut CRM</h3>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={loading === "status" || status === opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                status === opt.value
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:border-amber-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {canInvite && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Link2 size={15} />
            Invitation pré-inscription
          </h3>
          {link ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <code className="flex-1 truncate text-xs text-gray-700">{link}</code>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-white hover:text-amber-600"
                title="Copier"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          ) : (
            <p className="mb-3 text-xs text-gray-500">Aucun lien actif — régénérez une invitation.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!loading}
              onClick={() => handleInvite(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:border-amber-300"
            >
              {loading === "invite" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Régénérer le lien
            </button>
            <button
              type="button"
              disabled={!!loading}
              onClick={() => handleInvite(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
            >
              {loading === "invite-email" ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              Renvoyer par email
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleNote} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Ajouter une note</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Appel, relance, retour démo…"
          className="mb-3 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
        />
        <button
          type="submit"
          disabled={!!loading || !note.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading === "note" ? "Enregistrement…" : "Enregistrer la note"}
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}
    </div>
  );
}
