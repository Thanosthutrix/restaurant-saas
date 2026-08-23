"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";

type Props = {
  ownerId: string;
  ownerEmail: string;
  invoicePath: string;
};

export function AdminInvoiceImpersonateButton({ ownerId, ownerEmail, invoicePath }: Props) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImpersonate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      setLink(data.link as string);
      window.open(data.link as string, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleImpersonate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
        Voir comme {ownerEmail}
      </button>
      <p className="mt-2 text-xs text-gray-500">
        Après connexion, ouvrez :{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-700">{invoicePath}</code>
      </p>
      {link && (
        <p className="mt-1 break-all text-xs text-gray-400">
          <a href={link} className="text-amber-600 underline" target="_blank" rel="noreferrer">
            Rouvrir le lien d&apos;impersonation
          </a>
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
