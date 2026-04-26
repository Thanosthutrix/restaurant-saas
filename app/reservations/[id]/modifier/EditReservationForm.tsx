"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchCustomersLookupAction } from "@/app/clients/actions";
import { updateReservationAction } from "../../actions";
import { filterCustomersLocalPool, type CustomerLookupRow } from "@/lib/customers/customersDb";
import { parisYmdTimeDurationFromIsos } from "@/lib/reservations/parisTime";
import type { RestaurantReservationRow, ReservationSource, ReservationStatus } from "@/lib/reservations/types";
import { uiBtnPrimary, uiError, uiInput, uiLead } from "@/components/ui/premium";

const SOURCES: { v: ReservationSource; label: string }[] = [
  { v: "phone", label: "Téléphone" },
  { v: "walk_in", label: "Passage / comptoir" },
  { v: "website", label: "Site / en ligne" },
  { v: "other", label: "Autre" },
];

const STATUS_OPTIONS: { v: ReservationStatus; label: string }[] = [
  { v: "pending", label: "En attente" },
  { v: "confirmed", label: "Confirmée" },
  { v: "seated", label: "Assis" },
  { v: "completed", label: "Terminée" },
  { v: "cancelled", label: "Annulée" },
  { v: "no_show", label: "No-show" },
];

function snapDuration(m: number) {
  const x = Math.round(m / 15) * 15;
  return Math.min(360, Math.max(30, x));
}

type Props = {
  restaurantId: string;
  reservation: RestaurantReservationRow;
  returnYmd: string;
  recentCustomerPool: CustomerLookupRow[];
};

export function EditReservationForm({ restaurantId, reservation: initial, returnYmd, recentCustomerPool }: Props) {
  const router = useRouter();
  const init = useMemo(() => {
    const { ymd, timeHm, durationMinutes } = parisYmdTimeDurationFromIsos(initial.starts_at, initial.ends_at);
    return {
      ymd: ymd || returnYmd,
      timeHm,
      duration: snapDuration(durationMinutes),
    };
  }, [initial.starts_at, initial.ends_at, returnYmd]);

  const [ymd, setYmd] = useState(init.ymd);
  const [timeHm, setTimeHm] = useState(init.timeHm);
  const [partySize, setPartySize] = useState(initial.party_size);
  const [duration, setDuration] = useState(init.duration);
  const [source, setSource] = useState<ReservationSource>(initial.source);
  const [status, setStatus] = useState<ReservationStatus>(initial.status);
  const [linkedId, setLinkedId] = useState<string | null>(initial.customer_id);
  const [name, setName] = useState(initial.contact_name ?? "");
  const [phone, setPhone] = useState(initial.contact_phone ?? "");
  const [email, setEmail] = useState(initial.contact_email ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, tr] = useTransition();

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
    setLinkedId(c.id);
    setName(c.display_name);
    setListOpen(false);
  };
  const clearClient = () => {
    setLinkedId(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    tr(async () => {
      const r = await updateReservationAction({
        restaurantId,
        reservationId: initial.id,
        ymd,
        timeHm,
        partySize,
        durationMinutes: duration,
        source,
        status,
        customerId: linkedId,
        contactName: name.trim(),
        contactPhone: phone.trim() || null,
        contactEmail: email.trim() || null,
        notes: notes.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/reservations?date=" + encodeURIComponent(ymd));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className={uiLead}>
        Modifiez le créneau, le contact ou le statut. Même règles de fuseau : <strong>Europe/Paris</strong>.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
          Statut
          <select
            className={`${uiInput} mt-1 w-full`}
            value={status}
            onChange={(e) => setStatus(e.target.value as ReservationStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
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
          Durée (minutes, pas 15)
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
        <label className="block text-xs font-medium text-slate-600">Client — nom</label>
        <div className="relative mt-1">
          <input
            ref={inputRef}
            className={`${uiInput} w-full ${linkedId ? "border-emerald-200 bg-emerald-50/40" : ""}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            placeholder="Nom, ou rechercher une fiche…"
            required={!linkedId}
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
        {linkedId ? (
          <p className="mt-1 text-xs text-slate-600">
            Fiche liée.{" "}
            <button type="button" className="font-semibold text-indigo-700 underline" onClick={clearClient}>
              Retirer le lien
            </button>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Téléphone
          <input className={`${uiInput} mt-1 w-full`} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          E-mail
          <input className={`${uiInput} mt-1 w-full`} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Notes
        <textarea
          rows={3}
          className={`${uiInput} mt-1 w-full resize-y`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error ? <p className={uiError}>{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={uiBtnPrimary} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les changements"}
        </button>
        <Link
          href={"/reservations?date=" + encodeURIComponent(returnYmd)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
