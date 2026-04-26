"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchCustomersLookupAction } from "@/app/clients/actions";
import { createReservationAction } from "../actions";
import { filterCustomersLocalPool, type CustomerLookupRow } from "@/lib/customers/customersDb";
import type { ReservationSource } from "@/lib/reservations/types";
import { uiBtnPrimary, uiError, uiInput, uiLead } from "@/components/ui/premium";
import Link from "next/link";

type Props = {
  restaurantId: string;
  recentCustomerPool: CustomerLookupRow[];
};

const SOURCES: { v: ReservationSource; label: string }[] = [
  { v: "phone", label: "Téléphone" },
  { v: "walk_in", label: "Passage / comptoir" },
  { v: "website", label: "Site / en ligne" },
  { v: "other", label: "Autre" },
];

function parisYmd() {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export function NewReservationForm({ restaurantId, recentCustomerPool }: Props) {
  const router = useRouter();
  const [ymd, setYmd] = useState(parisYmd);
  const [timeHm, setTimeHm] = useState("19:30");
  const [partySize, setPartySize] = useState(2);
  const [duration, setDuration] = useState<number>(90);
  const [source, setSource] = useState<ReservationSource>("phone");
  const [createFiche, setCreateFiche] = useState(false);
  const [postSuccess, setPostSuccess] = useState<{ ymd: string; newCustomerId?: string } | null>(null);
  const [selectedClient, setSelectedClient] = useState<CustomerLookupRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [searchLoading, setSearchLoading] = useState(false);
  const [serverHits, setServerHits] = useState<CustomerLookupRow[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [listOpen, setListOpen] = useState(false);

  const nameNorm = name.trim().toLowerCase();
  const localMatches = useMemo(
    () => filterCustomersLocalPool(recentCustomerPool, name, 10),
    [recentCustomerPool, name]
  );

  const runServerSearch = useCallback(
    (q: string) => {
      if (q.trim().length < 2) {
        setServerHits([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      void (async () => {
        const r = await searchCustomersLookupAction(restaurantId, q);
        setSearchLoading(false);
        setServerHits(r.ok ? r.rows : []);
      })();
    },
    [restaurantId]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (nameNorm.length < 2) {
      setServerHits([]);
      return;
    }
    if (localMatches.length > 0) {
      setServerHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => runServerSearch(name), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, nameNorm, localMatches.length, runServerSearch]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: CustomerLookupRow[] = [];
    for (const r of localMatches) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    for (const r of serverHits) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out.slice(0, 10);
  }, [localMatches, serverHits]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || inputRef.current?.contains(t)) return;
      setListOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const selectClient = (c: CustomerLookupRow) => {
    setSelectedClient(c);
    setName(c.display_name);
    setCreateFiche(false);
    setListOpen(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createReservationAction({
        restaurantId,
        ymd,
        timeHm,
        partySize,
        durationMinutes: duration,
        source,
        customerId: selectedClient?.id ?? null,
        contactName: name.trim(),
        contactPhone: phone.trim() || null,
        contactEmail: email.trim() || null,
        notes: notes.trim() || null,
        createFicheFromContact: !selectedClient && createFiche,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.data?.newCustomerId) {
        setPostSuccess({ ymd, newCustomerId: r.data.newCustomerId });
        return;
      }
      router.push("/reservations?date=" + encodeURIComponent(ymd));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className={uiLead}>
        Heure et date en <strong>Europe/Paris</strong>. Liez une fiche client si la personne est déjà dans la base
        (recherche comme en caisse).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Jour
          <input type="date" className={`${uiInput} mt-1 w-full`} value={ymd} onChange={(e) => setYmd(e.target.value)} required />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Heure
          <input
            type="time"
            className={`${uiInput} mt-1 w-full`}
            value={timeHm}
            onChange={(e) => setTimeHm(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Couverts
          <input
            type="number"
            min={1}
            max={50}
            className={`${uiInput} mt-1 w-full tabular-nums`}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            required
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Durée (minutes, par pas de 15)
          <input
            type="number"
            min={30}
            max={360}
            step={15}
            className={`${uiInput} mt-1 w-full tabular-nums`}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            required
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
          Source
          <select
            className={`${uiInput} mt-1 w-full`}
            value={source}
            onChange={(e) => setSource(e.target.value as ReservationSource)}
          >
            {SOURCES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Client — nom (obligatoire si pas de fiche)</label>
        <div className="relative mt-1">
          <input
            ref={inputRef}
            className={`${uiInput} w-full ${selectedClient ? "border-emerald-300 bg-emerald-50/50" : ""}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (selectedClient && e.target.value.trim() !== selectedClient.display_name.trim()) {
                setSelectedClient(null);
              }
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            placeholder="Nom sur le carnet, ou rechercher une fiche…"
            required={!selectedClient}
            autoComplete="off"
          />
          {listOpen && (name.trim().length > 0 || suggestions.length > 0) && suggestions.length > 0 ? (
            <div
              ref={listRef}
              className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-indigo-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectClient(c)}
                >
                  <span className="font-medium text-slate-900">{c.display_name}</span>
                  <span className="text-xs text-slate-500">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              ))}
              {searchLoading ? <div className="px-3 py-2 text-xs text-slate-500">Recherche…</div> : null}
            </div>
          ) : null}
        </div>
        {selectedClient ? (
          <p className="mt-1 text-xs text-emerald-800">
            Fiche liée.{" "}
            <button type="button" className="font-semibold underline" onClick={clearClient}>
              Dissocier
            </button>
          </p>
        ) : (
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={createFiche}
              onChange={(e) => setCreateFiche(e.target.checked)}
            />
            <span>
              <span className="font-medium">Créer une fiche client</span> à partir de ce nom, du téléphone et de
              l’e-mail (droit « Base clients » requis). Après l’enregistrement, vous pourrez ouvrir la fiche pour
              compléter le dossier.
            </span>
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Téléphone
          <input className={`${uiInput} mt-1 w-full`} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          E-mail
          <input
            className={`${uiInput} mt-1 w-full`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Notes
        <textarea
          rows={3}
          className={`${uiInput} mt-1 w-full resize-y`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex. table calme, anniversaire, accès fauteuil…"
        />
      </label>

      {error ? <p className={uiError}>{error}</p> : null}

      {postSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
          <p className="font-medium">Réservation enregistrée.</p>
          {postSuccess.newCustomerId ? (
            <p className="mt-2 text-slate-800">
              Une fiche client a été créée avec le nom et le contact saisis. Vous pouvez la compléter (adresse,
              allergies, etc.) quand vous voulez.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {postSuccess.newCustomerId ? (
              <Link
                href={`/clients/${postSuccess.newCustomerId}`}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Ouvrir la fiche client
              </Link>
            ) : null}
            <Link
              href={"/reservations?date=" + encodeURIComponent(postSuccess.ymd)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Voir le planning du jour
            </Link>
            <Link
              href="/reservations"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100/80"
            >
              Retour réservations
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={uiBtnPrimary} disabled={pending || postSuccess != null}>
          {pending ? "Enregistrement…" : "Créer la réservation"}
        </button>
        <Link
          href="/reservations"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
