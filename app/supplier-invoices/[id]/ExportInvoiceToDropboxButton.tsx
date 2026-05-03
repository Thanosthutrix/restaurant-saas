"use client";

import { useEffect, useState } from "react";
import {
  exportSupplierInvoiceToDropboxAction,
  prepareSupplierInvoiceDropboxSaverAction,
} from "./actions";

type DropboxSaveOpts = {
  files: { url: string; filename: string }[];
  success?: () => void;
  error?: (msg: string) => void;
  cancel?: () => void;
};

declare global {
  interface Window {
    Dropbox?: {
      save: (opts: DropboxSaveOpts) => void;
      isBrowserSupported?: () => boolean;
    };
  }
}

const DROPBOX_DROPINS_SRC = "https://www.dropbox.com/static/api/2/dropins.js";

export function ExportInvoiceToDropboxButton({
  invoiceId,
  restaurantId,
  saverEnabled,
  serverUploadEnabled,
}: {
  invoiceId: string;
  restaurantId: string;
  saverEnabled: boolean;
  serverUploadEnabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [pendingSaver, setPendingSaver] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!saverEnabled) return;
    const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
    if (!appKey) return;
    if (document.getElementById("dropboxjs")) return;
    const s = document.createElement("script");
    s.id = "dropboxjs";
    s.type = "text/javascript";
    s.src = DROPBOX_DROPINS_SRC;
    s.setAttribute("data-app-key", appKey);
    document.body.appendChild(s);
  }, [saverEnabled]);

  async function handleServerUpload() {
    setFeedback(null);
    setPending(true);
    const res = await exportSupplierInvoiceToDropboxAction(invoiceId, restaurantId);
    setPending(false);
    if (res.ok) {
      setFeedback({
        kind: "ok",
        text: `Fichier envoyé dans Dropbox : ${res.pathDisplay}`,
      });
    } else {
      setFeedback({ kind: "err", text: res.error });
    }
  }

  async function handleSaver() {
    setFeedback(null);
    setPendingSaver(true);
    const prep = await prepareSupplierInvoiceDropboxSaverAction(invoiceId, restaurantId);
    setPendingSaver(false);
    if (!prep.ok) {
      setFeedback({ kind: "err", text: prep.error });
      return;
    }
    const dbx = window.Dropbox;
    if (!dbx?.save) {
      setFeedback({
        kind: "err",
        text: "Widget Dropbox non chargé. Patientez une seconde puis réessayez.",
      });
      return;
    }
    if (dbx.isBrowserSupported && !dbx.isBrowserSupported()) {
      setFeedback({
        kind: "err",
        text: "Ce navigateur n’est pas pris en charge par le widget Dropbox.",
      });
      return;
    }
    dbx.save({
      files: [{ url: prep.url, filename: prep.filename }],
      success: () =>
        setFeedback({
          kind: "ok",
          text: "Choisissez le dossier Dropbox et confirmez l’enregistrement dans la fenêtre qui s’ouvre.",
        }),
      error: (msg) =>
        setFeedback({
          kind: "err",
          text: msg?.trim() ? msg : "Erreur lors de l’enregistrement Dropbox.",
        }),
      cancel: () => {},
    });
  }

  return (
    <div className="space-y-4">
      {saverEnabled ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={pendingSaver}
            onClick={() => void handleSaver()}
            className="rounded border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pendingSaver ? "Préparation…" : "Enregistrer dans Dropbox (choisir le dossier)"}
          </button>
          <p className="text-[11px] leading-snug text-emerald-900/80">
            Comme un partage « vers une app » : une fenêtre Dropbox s’ouvre pour que vous choisissiez où enregistrer le PDF (compte Dropbox connecté au navigateur ou à l’app).
          </p>
        </div>
      ) : null}

      {serverUploadEnabled ? (
        <div className="space-y-2 border-t border-emerald-200/80 pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleServerUpload()}
            className="rounded border border-emerald-700 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          >
            {pending ? "Envoi…" : "Envoi automatique vers Dropbox (serveur)"}
          </button>
          <p className="text-[11px] leading-snug text-emerald-900/80">
            Le PDF est déposé dans le dossier Dropbox configuré sur le serveur (jeton OAuth). Partagez ce dossier avec votre comptable ou utilisez le compte du cabinet.
          </p>
        </div>
      ) : null}

      {feedback?.kind === "ok" ? (
        <p className="text-xs text-emerald-800">{feedback.text}</p>
      ) : null}
      {feedback?.kind === "err" ? (
        <p className="text-xs text-rose-700" role="alert">
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
