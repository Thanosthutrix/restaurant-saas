"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CustomerDiningHabitsReport } from "@/lib/customers/customerDiningHabits";
import type {
  CustomerConsentLog,
  CustomerTag,
  CustomerTimelineEvent,
  CustomerWithTags,
  CustomerSource,
} from "@/lib/customers/types";
import {
  addCustomerNoteAction,
  addCustomerTimelineEventAction,
  assignCustomerTagAction,
  createCustomerTagAction,
  deactivateCustomerAction,
  registerCustomerVisitAction,
  removeCustomerTagAction,
  updateCustomerAction,
} from "../actions";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiCard, uiInput, uiSectionTitleSm } from "@/components/ui/premium";

const SOURCES: { value: CustomerSource; label: string }[] = [
  { value: "walk_in", label: "Passage" },
  { value: "phone", label: "Téléphone" },
  { value: "website", label: "Site / web" },
  { value: "referral", label: "Recommandation" },
  { value: "social", label: "Réseaux sociaux" },
  { value: "event", label: "Événement" },
  { value: "import", label: "Import" },
  { value: "other", label: "Autre" },
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  restaurantId: string;
  customer: CustomerWithTags;
  allTags: CustomerTag[];
  timeline: CustomerTimelineEvent[];
  consentLogs: CustomerConsentLog[];
  diningHabits: CustomerDiningHabitsReport | null;
  diningHabitsError: string | null;
};

function fmtEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function ClientDetailClient({
  restaurantId,
  customer: initial,
  allTags,
  timeline,
  consentLogs,
  diningHabits,
  diningHabitsError,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [serviceMemo, setServiceMemo] = useState(initial.service_memo ?? "");
  const [noteTitle, setNoteTitle] = useState("Note");
  const [noteBody, setNoteBody] = useState("");
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  const assignedIds = new Set(initial.tags.map((t) => t.id));
  const availableToAdd = allTags.filter((t) => !assignedIds.has(t.id));

  useEffect(() => {
    setServiceMemo(initial.service_memo ?? "");
  }, [initial.service_memo]);

  function refresh() {
    router.refresh();
  }

  function saveServiceMemo(e: React.FormEvent) {
    e.preventDefault();
    if (!initial.is_active) return;
    setError(null);
    start(async () => {
      const r = await updateCustomerAction(restaurantId, initial.id, { service_memo: serviceMemo.trim() || null });
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  function onUpdateForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!initial.is_active) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateCustomerAction(restaurantId, initial.id, {
        display_name: String(fd.get("display_name") ?? "").trim(),
        first_name: String(fd.get("first_name") ?? "").trim() || null,
        last_name: String(fd.get("last_name") ?? "").trim() || null,
        email: String(fd.get("email") ?? "").trim() || null,
        phone: String(fd.get("phone") ?? "").trim() || null,
        preferred_locale: String(fd.get("preferred_locale") ?? "fr"),
        birth_date: String(fd.get("birth_date") ?? "").trim() || null,
        company_name: String(fd.get("company_name") ?? "").trim() || null,
        address_line1: String(fd.get("address_line1") ?? "").trim() || null,
        address_line2: String(fd.get("address_line2") ?? "").trim() || null,
        postal_code: String(fd.get("postal_code") ?? "").trim() || null,
        city: String(fd.get("city") ?? "").trim() || null,
        country: String(fd.get("country") ?? "FR").trim() || "FR",
        internal_notes: String(fd.get("internal_notes") ?? "").trim() || null,
        allergens_note: String(fd.get("allergens_note") ?? "").trim() || null,
        source: String(fd.get("source") ?? "other") as CustomerSource,
        marketing_opt_in: fd.get("marketing_opt_in") === "on",
        service_messages_opt_in: fd.get("service_messages_opt_in") === "on",
        analytics_opt_in: fd.get("analytics_opt_in") === "on",
      });
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setError(null);
    start(async () => {
      const r = await addCustomerNoteAction(restaurantId, initial.id, noteTitle.trim() || "Note", noteBody.trim());
      if (!r.ok) setError(r.error);
      else {
        setNoteBody("");
        refresh();
      }
    });
  }

  function onVisit() {
    setError(null);
    start(async () => {
      const r = await registerCustomerVisitAction(restaurantId, initial.id, null);
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  function onQuickEvent(type: "call" | "email", label: string) {
    setError(null);
    start(async () => {
      const r = await addCustomerTimelineEventAction(restaurantId, initial.id, type, label, null);
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  function onAssignTag(tagId: string) {
    setError(null);
    start(async () => {
      const r = await assignCustomerTagAction(restaurantId, initial.id, tagId);
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  function onRemoveTag(tagId: string) {
    setError(null);
    start(async () => {
      const r = await removeCustomerTagAction(restaurantId, initial.id, tagId);
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  function onCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagLabel.trim()) return;
    setError(null);
    start(async () => {
      const t = await createCustomerTagAction(restaurantId, newTagLabel.trim(), newTagColor);
      if (!t.ok) {
        setError(t.error);
        return;
      }
      const a = await assignCustomerTagAction(restaurantId, initial.id, t.id);
      if (!a.ok) setError(a.error);
      else {
        setNewTagLabel("");
        refresh();
      }
    });
  }

  function onArchive() {
    if (!confirm("Archiver cette fiche ? Elle ne sera plus proposée par défaut dans les listes.")) return;
    setError(null);
    start(async () => {
      const r = await deactivateCustomerAction(restaurantId, initial.id);
      if (!r.ok) setError(r.error);
      else {
        refresh();
        router.push("/clients");
      }
    });
  }

  const c = initial;

  return (
    <div className="space-y-8">
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !c.is_active} onClick={onVisit} className={uiBtnPrimarySm}>
          Enregistrer une visite
        </button>
        <button
          type="button"
          disabled={pending || !c.is_active}
          onClick={() => onQuickEvent("call", "Appel")}
          className={uiBtnOutlineSm}
        >
          Journal : appel
        </button>
        <button
          type="button"
          disabled={pending || !c.is_active}
          onClick={() => onQuickEvent("email", "Échange e-mail")}
          className={uiBtnOutlineSm}
        >
          Journal : e-mail
        </button>
        <button type="button" disabled={pending || !c.is_active} onClick={onArchive} className={`${uiBtnOutlineSm} text-rose-700`}>
          Archiver la fiche
        </button>
      </div>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Mémo service (salle &amp; caisse)</h2>
        <p className="text-xs text-slate-600">
          Rappel court pour l’équipe — affiché sur la commande lorsque la fiche est liée (ex. opération, préférence
          temporaire). Les notes internes détaillées restent dans la section ci‑dessous.
        </p>
        <form onSubmit={saveServiceMemo} className="space-y-2">
          <textarea
            name="service_memo_quick"
            rows={4}
            disabled={!c.is_active || pending}
            value={serviceMemo}
            onChange={(e) => setServiceMemo(e.target.value)}
            className={`${uiInput} w-full resize-y text-sm`}
            placeholder="Ex. Opération du genou prévue vendredi — se montrer attentif à l’installation."
          />
          {c.is_active ? (
            <button type="submit" disabled={pending} className={uiBtnPrimarySm}>
              {pending ? "Enregistrement…" : "Enregistrer le mémo"}
            </button>
          ) : null}
        </form>
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Aperçu commandes &amp; habitudes</h2>
        {diningHabitsError ? (
          <p className="text-sm text-rose-700">{diningHabitsError}</p>
        ) : diningHabits ? (
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <strong className="tabular-nums">{diningHabits.settledOrdersCount}</strong> commande
                {diningHabits.settledOrdersCount !== 1 ? "s" : ""} réglée{diningHabits.settledOrdersCount !== 1 ? "s" : ""}
              </span>
            </div>
            {diningHabits.openTickets.length > 0 ? (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-amber-900">
                  Ticket{diningHabits.openTickets.length > 1 ? "s" : ""} en cours
                </p>
                <p className="mt-0.5 text-[11px] text-amber-800/90">
                  Ouvrez la commande pour consulter le mémo, les plats, encaisser ou ajouter une note au fil de
                  l’eau.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {diningHabits.openTickets.map((t) => (
                    <li key={t.orderId}>
                      <Link
                        href={`/salle/commande/${t.orderId}?from=clients&clientId=${encodeURIComponent(c.id)}`}
                        className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
                      >
                        {t.label}
                      </Link>
                      <span className="text-xs text-slate-500"> · {formatWhen(t.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p>
              Total encaissé (TTC) :{" "}
              <span className="font-semibold tabular-nums">{fmtEur(diningHabits.totalSpentTtc)}</span>
              {diningHabits.settledOrdersCount > 0 ? (
                <>
                  {" "}
                  · panier moyen{" "}
                  <span className="font-semibold tabular-nums">{fmtEur(diningHabits.averageTicketTtc)}</span>
                </>
              ) : null}
            </p>
            {diningHabits.lastSettledAt ? (
              <p className="text-xs text-slate-600">
                Dernière commande réglée : {formatWhen(diningHabits.lastSettledAt)}
                {diningHabits.firstSettledAt && diningHabits.firstSettledAt !== diningHabits.lastSettledAt ? (
                  <> · première : {formatWhen(diningHabits.firstSettledAt)}</>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Aucune commande réglée avec cette fiche pour l’instant.</p>
            )}
            {diningHabits.preferredWeekdayLabel && diningHabits.settledOrdersCount >= 2 ? (
              <p className="text-xs text-slate-600">
                Jour le plus fréquent : <span className="font-medium capitalize">{diningHabits.preferredWeekdayLabel}</span>{" "}
                (sur les visites enregistrées)
              </p>
            ) : null}
            {diningHabits.favoriteDishes.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-slate-500">Plats les plus commandés (quantités)</p>
                <ul className="mt-1 list-inside list-disc text-slate-700">
                  {diningHabits.favoriteDishes.map((d) => (
                    <li key={d.name}>
                      {d.name}{" "}
                      <span className="tabular-nums text-slate-500">
                        ({d.lineCount % 1 === 0 ? String(d.lineCount) : d.lineCount.toFixed(1)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {diningHabits.paymentMix.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-slate-500">Moyens de paiement (commandes)</p>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {diningHabits.paymentMix.map((p) => (
                    <li key={p.method}>
                      {p.label} : {p.count}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement impossible.</p>
        )}
      </section>

      <details className={`${uiCard} group`}>
        <summary className="cursor-pointer list-none py-1 text-left marker:content-none [&::-webkit-details-marker]:hidden">
          <span className={uiSectionTitleSm}>
            Coordonnées &amp; préférences
            <span className="ml-2 text-xs font-normal text-slate-500">(cliquer pour développer)</span>
          </span>
        </summary>
        <form onSubmit={onUpdateForm} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-500">
              Nom affiché *
              <input
                name="display_name"
                required
                disabled={!c.is_active}
                defaultValue={c.display_name}
                className={`${uiInput} mt-1 w-full`}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Entreprise
              <input name="company_name" disabled={!c.is_active} defaultValue={c.company_name ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Prénom
              <input name="first_name" disabled={!c.is_active} defaultValue={c.first_name ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Nom
              <input name="last_name" disabled={!c.is_active} defaultValue={c.last_name ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Email
              <input name="email" type="email" disabled={!c.is_active} defaultValue={c.email ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Téléphone
              <input name="phone" type="tel" disabled={!c.is_active} defaultValue={c.phone ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Langue
              <select name="preferred_locale" disabled={!c.is_active} defaultValue={c.preferred_locale} className={`${uiInput} mt-1 w-full`}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Naissance
              <input name="birth_date" type="date" disabled={!c.is_active} defaultValue={c.birth_date ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
          </div>
          <div className="grid gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Adresse
              <input name="address_line1" disabled={!c.is_active} defaultValue={c.address_line1 ?? ""} className={`${uiInput} mt-1 w-full`} />
            </label>
            <input name="address_line2" disabled={!c.is_active} defaultValue={c.address_line2 ?? ""} className={uiInput} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-slate-500">
                CP
                <input name="postal_code" disabled={!c.is_active} defaultValue={c.postal_code ?? ""} className={`${uiInput} mt-1 w-full`} />
              </label>
              <label className={`block text-xs font-medium text-slate-500 sm:col-span-2`}>
                Ville
                <input name="city" disabled={!c.is_active} defaultValue={c.city ?? ""} className={`${uiInput} mt-1 w-full`} />
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-500">
              Pays
              <input name="country" disabled={!c.is_active} defaultValue={c.country} className={`${uiInput} mt-1 w-full`} />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            Origine
            <select name="source" disabled={!c.is_active} defaultValue={c.source} className={`${uiInput} mt-1 w-full`}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Notes internes (dossier)
            <textarea
              name="internal_notes"
              rows={3}
              disabled={!c.is_active}
              defaultValue={c.internal_notes ?? ""}
              className={`${uiInput} mt-1 w-full`}
            />
            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
              Texte long ou administratif. Pour le rappel court affiché en caisse, utilisez le « Mémo service »
              ci‑dessus.
            </span>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Allergies / régimes
            <textarea name="allergens_note" rows={2} disabled={!c.is_active} defaultValue={c.allergens_note ?? ""} className={`${uiInput} mt-1 w-full`} />
          </label>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="service_messages_opt_in"
                disabled={!c.is_active}
                defaultChecked={c.service_messages_opt_in}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>Messages liés au service</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="marketing_opt_in"
                disabled={!c.is_active}
                defaultChecked={c.marketing_opt_in}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>Communications commerciales</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="analytics_opt_in"
                disabled={!c.is_active}
                defaultChecked={c.analytics_opt_in}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>Satisfaction / statistiques</span>
            </label>
          </div>

          {c.is_active ? (
            <button type="submit" disabled={pending} className={uiBtnPrimarySm}>
              {pending ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          ) : (
            <p className="text-sm text-slate-500">Fiche archivée — réactivation possible via support ou future action « Restaurer ».</p>
          )}
        </form>
      </details>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Étiquettes</h2>
        <div className="flex flex-wrap gap-2">
          {c.tags.length === 0 ? <span className="text-sm text-slate-500">Aucune</span> : null}
          {c.tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.label}
              {c.is_active ? (
                <button
                  type="button"
                  className="ml-1 rounded-full bg-white/20 px-1.5 hover:bg-white/30"
                  onClick={() => onRemoveTag(t.id)}
                  aria-label={`Retirer ${t.label}`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {c.is_active && availableToAdd.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500">Ajouter :</span>
            {availableToAdd.map((t) => (
              <button key={t.id} type="button" onClick={() => onAssignTag(t.id)} className={uiBtnOutlineSm}>
                + {t.label}
              </button>
            ))}
          </div>
        ) : null}
        {c.is_active ? (
          <form onSubmit={onCreateTag} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
            <label className="text-xs font-medium text-slate-500">
              Nouvelle étiquette
              <input value={newTagLabel} onChange={(e) => setNewTagLabel(e.target.value)} className={`${uiInput} mt-1`} placeholder="VIP, Entreprise…" />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Couleur
              <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="mt-1 h-9 w-14 cursor-pointer rounded border border-slate-200" />
            </label>
            <button type="submit" className={uiBtnPrimarySm} disabled={pending}>
              Créer et assigner
            </button>
          </form>
        ) : null}
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Fréquentation</h2>
        <p className="text-sm text-slate-700">
          <span className="font-semibold tabular-nums">{c.visit_count}</span> visite{c.visit_count > 1 ? "s" : ""} enregistrée
          {c.visit_count > 1 ? "s" : ""}
          {c.last_visit_at ? (
            <>
              {" "}
              · dernière : {formatWhen(c.last_visit_at)}
            </>
          ) : null}
        </p>
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Ajouter une note au journal</h2>
        <form onSubmit={addNote} className="space-y-2">
          <input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className={uiInput}
            placeholder="Titre"
          />
          <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} className={uiInput} placeholder="Contenu…" />
          <button type="submit" disabled={pending || !c.is_active} className={uiBtnPrimarySm}>
            Ajouter
          </button>
        </form>
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Journal</h2>
        <ul className="space-y-3">
          {timeline.length === 0 ? <li className="text-sm text-slate-500">Aucun événement.</li> : null}
          {timeline.map((ev) => (
            <li key={ev.id} className="border-b border-slate-100 pb-3 last:border-0">
              <p className="text-xs text-slate-500">{formatWhen(ev.occurred_at)} · {ev.event_type}</p>
              <p className="font-medium text-slate-900">{ev.title}</p>
              {ev.body ? <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.body}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Historique des consentements</h2>
        <p className="text-xs text-slate-500">
          Traçabilité minimale des changements (marketing, messages service, analyses). Conservez votre politique de
          confidentialité à jour.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Type</th>
                <th className="py-2">Avant</th>
                <th className="py-2">Après</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consentLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500">
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              ) : (
                consentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 whitespace-nowrap text-slate-600">{formatWhen(log.recorded_at)}</td>
                    <td className="py-2">{log.consent_key}</td>
                    <td className="py-2">{log.previous_value == null ? "—" : log.previous_value ? "oui" : "non"}</td>
                    <td className="py-2">{log.new_value ? "oui" : "non"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
