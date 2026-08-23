"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import {
  ADMIN_EMAIL_TEMPLATES,
  type AdminEmailTemplateId,
} from "@/lib/admin/supportTypes";
import { buildAdminSupportEmail } from "@/lib/messaging/adminEmailTemplates";

type Props = {
  restaurantId: string;
  restaurantName: string;
  ownerEmail: string | null;
  ownerName: string | null;
};

export function AdminSendEmailPanel({
  restaurantId,
  restaurantName,
  ownerEmail,
  ownerName,
}: Props) {
  const [templateId, setTemplateId] = useState<AdminEmailTemplateId>("follow_up");
  const [to, setTo] = useState(ownerEmail ?? "");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const built = buildAdminSupportEmail(templateId, {
      contactName: ownerName ?? to.split("@")[0] ?? "Bonjour",
      restaurantName,
      ownerEmail: to,
    });
    if (templateId !== "custom") {
      setSubject(built.subject);
      setText(built.text);
    }
  }, [templateId, ownerName, restaurantName, to]);

  useEffect(() => {
    if (ownerEmail) setTo(ownerEmail);
  }, [ownerEmail]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          templateId,
          to: to.trim(),
          subject,
          text,
          contactName: ownerName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible.");
      setMessage({ type: "success", text: "Email envoyé." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur.",
      });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25";

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Mail size={16} className="text-amber-600" />
        Envoyer un email
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Modèle</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value as AdminEmailTemplateId)}
          className={inputClass}
        >
          {ADMIN_EMAIL_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          {ADMIN_EMAIL_TEMPLATES.find((t) => t.id === templateId)?.description}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Destinataire</label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Sujet</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={8}
          className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
        />
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !to.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {loading ? "Envoi…" : "Envoyer via Resend"}
      </button>
    </form>
  );
}
