"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { filterCustomersLocalPool, type CustomerLookupRow } from "@/lib/customers/customersDb";
import { searchCustomersLookupAction } from "@/app/clients/actions";
import {
  createCustomerFromDiningOrderAction,
  setDiningOrderCustomerAction,
  setDiningOrderGuestLabelAction,
} from "@/app/salle/actions";
import { CustomerTicketMemoDialog } from "./CustomerTicketMemoDialog";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiError, uiInput } from "@/components/ui/premium";

type LinkedCustomer = {
  id: string;
  display_name: string;
  service_memo: string | null;
  allergens_note: string | null;
};

type Props = {
  restaurantId: string;
  orderId: string;
  linked: LinkedCustomer | null;
  recentCustomerPool: CustomerLookupRow[];
  /** Commande liée à une table (pas comptoir). */
  isTableOrder?: boolean;
  guestLabel?: string | null;
  onUpdated?: () => void;
};

export function DiningOrderCustomerLinkPanel({
  restaurantId,
  orderId,
  linked,
  recentCustomerPool,
  isTableOrder = false,
  guestLabel = null,
  onUpdated,
}: Props) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [serverHits, setServerHits] = useState<CustomerLookupRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [guestName, setGuestName] = useState(guestLabel ?? "");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setGuestName(guestLabel ?? "");
  }, [guestLabel]);

  const refresh = () => {
    onUpdated?.();
  };

  const localMatches = useMemo(() => filterCustomersLocalPool(recentCustomerPool, q, 8), [recentCustomerPool, q]);

  const runServerSearch = useCallback(
    (query: string) => {
      if (query.trim().length < 2) {
        setServerHits([]);
        setSearchLoading(false);
        return;
      }
      if (localMatches.length > 0) {
        setServerHits([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      void (async () => {
        const r = await searchCustomersLookupAction(restaurantId, query);
        setSearchLoading(false);
        setServerHits(r.ok ? r.rows : []);
      })();
    },
    [restaurantId, localMatches.length]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setServerHits([]);
      return;
    }
    if (localMatches.length > 0) {
      setServerHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => runServerSearch(q), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, localMatches.length, runServerSearch]);

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
    return out.slice(0, 8);
  }, [localMatches, serverHits]);

  function onPick(c: CustomerLookupRow) {
    setQ("");
    setEditing(false);
    startTransition(async () => {
      const r = await setDiningOrderCustomerAction({ restaurantId, orderId, customerId: c.id });
      if (r.ok) refresh();
    });
  }

  function onClear() {
    if (!confirm("Retirer le lien avec cette fiche client ?")) return;
    startTransition(async () => {
      const r = await setDiningOrderCustomerAction({ restaurantId, orderId, customerId: null });
      if (r.ok) refresh();
    });
  }

  function saveGuestName() {
    setGuestError(null);
    startTransition(async () => {
      const r = await setDiningOrderGuestLabelAction({
        restaurantId,
        orderId,
        guestLabel: guestName.trim() || null,
      });
      if (!r.ok) {
        setGuestError(r.error);
        return;
      }
      refresh();
    });
  }

  function openCreateForm() {
    setCreateError(null);
    setCreateName(guestName.trim() || q.trim() || "");
    setCreateEmail("");
    setCreatePhone("");
    setCreateOpen(true);
  }

  function submitCreateCustomer() {
    setCreateError(null);
    startTransition(async () => {
      const r = await createCustomerFromDiningOrderAction({
        restaurantId,
        orderId,
        displayName: createName,
        email: createEmail || null,
        phone: createPhone || null,
      });
      if (!r.ok) {
        setCreateError(r.error);
        return;
      }
      setCreateOpen(false);
      setEditing(false);
      setQ("");
      refresh();
    });
  }

  const guestSection =
    isTableOrder && !linked ? (
      <div className="rounded-xl border border-copper-200/80 bg-copper-50/40 px-3 py-2">
        <p className="text-xs font-medium text-copper-900">Nom à la table (sans fiche client)</p>
        <p className="text-[11px] text-stone-500">
          Utile pour identifier le groupe avant d’ouvrir une fiche en base.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            className={`${uiInput} min-w-0 flex-1 py-1.5 text-sm`}
            placeholder="Ex. Martin Dupont"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={pending}
          />
          <button
            type="button"
            className={uiBtnOutlineSm}
            disabled={pending || guestName.trim() === (guestLabel ?? "").trim()}
            onClick={saveGuestName}
          >
            Enregistrer
          </button>
        </div>
        {guestError ? <p className={`${uiError} mt-2 text-xs`}>{guestError}</p> : null}
      </div>
    ) : null;

  if (!editing && linked) {
    return (
      <>
        {guestSection}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-emerald-900">
            Client :{" "}
            <button
              type="button"
              className="font-semibold text-copper-800 underline"
              onClick={() => setMemoOpen(true)}
            >
              {linked.display_name}
            </button>{" "}
            <Link href={`/clients/${linked.id}`} className="text-copper-800 hover:underline">
              (fiche)
            </Link>{" "}
            — les plats de cette commande seront ajoutés à l’historique à l’encaissement.
            {linked.service_memo?.trim() ? (
              <span className="ml-1 text-emerald-800/90" title="Mémo renseigné sur la fiche">
                {" "}
                · mémo
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={() => setEditing(true)}>
              Changer
            </button>
            <button type="button" className={`${uiBtnOutlineSm} text-rose-700`} disabled={pending} onClick={onClear}>
              Retirer le lien
            </button>
          </div>
        </div>
        <CustomerTicketMemoDialog
          open={memoOpen}
          onClose={() => setMemoOpen(false)}
          customer={linked}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {guestSection}

      <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
        <p className="text-xs font-medium text-stone-700">Associer un client (base clients)</p>
        <p className="text-[11px] text-stone-500">
          Tapez le nom, l’e-mail ou le téléphone — ou créez une nouvelle fiche.
        </p>
        <div className="relative mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              className={`${uiInput} w-full py-1.5 text-sm`}
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={pending}
            />
            {q.trim().length > 0 && suggestions.length > 0 ? (
              <div
                ref={listRef}
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-md"
              >
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full flex-col items-start px-2 py-1.5 text-left text-sm hover:bg-copper-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(c)}
                  >
                    <span className="font-medium text-stone-900">{c.display_name}</span>
                    <span className="text-[11px] text-stone-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
                {searchLoading ? <div className="px-2 py-1 text-xs text-stone-500">Recherche…</div> : null}
              </div>
            ) : null}
          </div>
          {editing && linked ? (
            <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={() => setEditing(false)}>
              Annuler
            </button>
          ) : null}
        </div>

        {isTableOrder ? (
          <div className="mt-3 border-t border-stone-100 pt-3">
            {!createOpen ? (
              <button
                type="button"
                className={`${uiBtnPrimarySm} inline-flex items-center gap-1.5`}
                disabled={pending}
                onClick={openCreateForm}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Ajouter à la base clients
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-700">Nouvelle fiche client</p>
                <input
                  className={`${uiInput} w-full py-1.5 text-sm`}
                  placeholder="Nom affiché *"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={pending}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className={`${uiInput} py-1.5 text-sm`}
                    placeholder="E-mail (optionnel)"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    disabled={pending}
                  />
                  <input
                    className={`${uiInput} py-1.5 text-sm`}
                    placeholder="Téléphone (optionnel)"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    disabled={pending}
                  />
                </div>
                {createError ? <p className={`${uiError} text-xs`}>{createError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={uiBtnPrimarySm}
                    disabled={pending || !createName.trim()}
                    onClick={submitCreateCustomer}
                  >
                    Créer et lier
                  </button>
                  <button
                    type="button"
                    className={uiBtnOutlineSm}
                    disabled={pending}
                    onClick={() => setCreateOpen(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
