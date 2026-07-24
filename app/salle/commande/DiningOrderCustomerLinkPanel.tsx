"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { filterCustomersLocalPool, type CustomerLookupRow } from "@/lib/customers/customersDb";
import { searchCustomersLookupAction } from "@/app/clients/actions";
import {
  createCustomerFromDiningOrderAction,
  setDiningOrderCustomerAction,
  setDiningOrderGuestLabelAction,
} from "@/app/salle/actions";
import { CustomerTicketMemoDialog } from "./CustomerTicketMemoDialog";
import { uiBtnOutlineSm, uiError, uiInput } from "@/components/ui/premium";

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
  /** Barre compacte (table / modale salle). */
  variant?: "default" | "compact";
};

function TableOrderCustomerField({
  restaurantId,
  orderId,
  linked,
  recentCustomerPool,
  guestLabel,
  onUpdated,
}: Omit<Props, "isTableOrder" | "variant">) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [serverHits, setServerHits] = useState<CustomerLookupRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (linked) {
      setQuery(linked.display_name);
      return;
    }
    setQuery(guestLabel?.trim() ?? "");
  }, [linked, guestLabel, orderId]);

  const refresh = () => onUpdated?.();

  const localMatches = useMemo(
    () => filterCustomersLocalPool(recentCustomerPool, query, 8),
    [recentCustomerPool, query]
  );

  const runServerSearch = useCallback(
    (value: string) => {
      if (value.trim().length < 2) {
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
        const r = await searchCustomersLookupAction(restaurantId, value);
        setSearchLoading(false);
        setServerHits(r.ok ? r.rows : []);
      })();
    },
    [restaurantId, localMatches.length]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2 || linked) {
      setServerHits([]);
      return;
    }
    if (localMatches.length > 0) {
      setServerHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => runServerSearch(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, localMatches.length, runServerSearch, linked]);

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
    setActionError(null);
    setListOpen(false);
    startTransition(async () => {
      const r = await setDiningOrderCustomerAction({ restaurantId, orderId, customerId: c.id });
      if (!r.ok) {
        setActionError(r.error);
        return;
      }
      refresh();
    });
  }

  function onClearLink() {
    startTransition(async () => {
      const r = await setDiningOrderCustomerAction({ restaurantId, orderId, customerId: null });
      if (r.ok) refresh();
    });
  }

  function scheduleGuestLabelSave(name: string) {
    if (linked) return;
    if (guestSaveRef.current) clearTimeout(guestSaveRef.current);
    guestSaveRef.current = setTimeout(() => {
      const trimmed = name.trim();
      if (trimmed === (guestLabel ?? "").trim()) return;
      void setDiningOrderGuestLabelAction({
        restaurantId,
        orderId,
        guestLabel: trimmed || null,
      }).then((r) => {
        if (r.ok) refresh();
      });
    }, 450);
  }

  function associateOrCreate() {
    setActionError(null);
    const name = query.trim();
    if (!name) {
      setActionError("Indiquez un nom.");
      return;
    }

    const exact = suggestions.find((s) => s.display_name.trim().toLowerCase() === name.toLowerCase());
    if (exact) {
      onPick(exact);
      return;
    }
    if (suggestions.length === 1) {
      onPick(suggestions[0]);
      return;
    }

    startTransition(async () => {
      const r = await createCustomerFromDiningOrderAction({
        restaurantId,
        orderId,
        displayName: name,
        email: null,
        phone: null,
      });
      if (!r.ok) {
        setActionError(r.error);
        return;
      }
      setListOpen(false);
      refresh();
    });
  }

  const showDropdown = listOpen && !linked && query.trim().length > 0 && (suggestions.length > 0 || searchLoading);

  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          {linked ? (
            <div className="flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-emerald-900"
                onClick={() => setMemoOpen(true)}
                title="Voir mémo et allergies"
              >
                {linked.display_name}
              </button>
              <Link
                href={`/clients/${linked.id}`}
                className="shrink-0 text-[10px] font-semibold text-copper-700 hover:underline"
                title="Ouvrir la fiche"
              >
                Fiche
              </Link>
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-white/80 hover:text-stone-800"
                aria-label="Retirer le lien client"
                disabled={pending}
                onClick={onClearLink}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                className={`${uiInput} w-full py-1.5 text-xs sm:text-sm`}
                placeholder="Nom du client…"
                value={query}
                disabled={pending}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setListOpen(true);
                  scheduleGuestLabelSave(e.target.value);
                }}
                onFocus={() => setListOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setListOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    associateOrCreate();
                  }
                }}
              />
              {showDropdown ? (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-40 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-copper-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPick(c)}
                    >
                      <span className="text-xs font-medium text-stone-900 sm:text-sm">{c.display_name}</span>
                      <span className="text-[10px] text-stone-500 sm:text-[11px]">
                        {[c.email, c.phone].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                  {searchLoading ? <div className="px-2 py-1 text-[11px] text-stone-500">Recherche…</div> : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        {!linked ? (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-copper-200 bg-copper-50 text-copper-800 shadow-sm transition hover:bg-copper-100 active:scale-[0.97] disabled:opacity-50"
            aria-label="Associer ou créer en base clients"
            title="Associer ou créer en base clients"
            disabled={pending || !query.trim()}
            onClick={associateOrCreate}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {actionError ? <p className={`${uiError} mt-1 text-[11px]`}>{actionError}</p> : null}
      {linked ? (
        <CustomerTicketMemoDialog open={memoOpen} onClose={() => setMemoOpen(false)} customer={linked} />
      ) : null}
    </>
  );
}

export function DiningOrderCustomerLinkPanel({
  restaurantId,
  orderId,
  linked,
  recentCustomerPool,
  isTableOrder = false,
  guestLabel = null,
  onUpdated,
  variant = "default",
}: Props) {
  if (isTableOrder || variant === "compact") {
    return (
      <TableOrderCustomerField
        restaurantId={restaurantId}
        orderId={orderId}
        linked={linked}
        recentCustomerPool={recentCustomerPool}
        guestLabel={guestLabel}
        onUpdated={onUpdated}
      />
    );
  }

  const [memoOpen, setMemoOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [serverHits, setServerHits] = useState<CustomerLookupRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => onUpdated?.();

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

  if (!editing && linked) {
    return (
      <>
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
            — les plats seront ajoutés à l’historique à l’encaissement.
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
        <CustomerTicketMemoDialog open={memoOpen} onClose={() => setMemoOpen(false)} customer={linked} />
      </>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="text-xs font-medium text-stone-700">Associer un client</p>
      <div className="relative mt-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            className={`${uiInput} w-full py-1.5 text-sm`}
            placeholder="Nom, e-mail ou téléphone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={pending}
          />
          {q.trim().length > 0 && suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-md">
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
    </div>
  );
}
