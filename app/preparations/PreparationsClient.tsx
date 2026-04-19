"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PreparationCandidateDish, PreparationCandidatePrep, PreparationRecord } from "@/lib/preparations/types";
import {
  lookupPreparationByLotAction,
  recordPreparation2hAndDlcAction,
  recordPreparationTempEndAction,
  startPreparationAction,
} from "./actions";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

/** DLC : jour J+n par rapport à aujourd’hui (calendrier local), format AAAA-MM-JJ pour l’input date. */
function localDatePlusDaysISO(offsetDays: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function needsComplement2hDlc(r: PreparationRecord): boolean {
  return Boolean(r.temp_end_recorded_at && !r.temp_2h_recorded_at);
}

function lotLookupStatusLabel(rec: PreparationRecord): string {
  if (rec.temp_2h_recorded_at) return "Clôturé";
  if (!rec.temp_end_recorded_at) return "1er relevé manquant";
  return "En attente complément";
}

/** Même idée que `matchesSearch` dans InventoryItemSearchOrCreate : lot + libellé. */
function matchesLotRecord(rec: PreparationRecord, searchNorm: string): boolean {
  const labelNorm = normalizeSearch(rec.label);
  const lotCompact = normalizeSearch((rec.lot_reference ?? "").replace(/\s+/g, ""));
  const sn = searchNorm.replace(/\s+/g, "");
  return (
    lotCompact.includes(sn) ||
    sn.includes(lotCompact) ||
    labelNorm.includes(searchNorm) ||
    searchNorm.includes(labelNorm)
  );
}

function formatIsoDateFr(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return new Date(ymd + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const UNITS_NEW = ["kg", "g", "l", "ml", "unit", "sceau"] as const;

type Props = {
  restaurantId: string;
  inventoryPreps: PreparationCandidatePrep[];
  dishes: PreparationCandidateDish[];
  awaitingTempEnd: PreparationRecord[];
  awaiting2h: PreparationRecord[];
  /** Derniers lots (filtrage instantané dans le champ, comme les composants dans un plat). */
  recordsWithLot: PreparationRecord[];
};

export function PreparationsClient({
  restaurantId,
  inventoryPreps,
  dishes,
  awaitingTempEnd,
  awaiting2h,
  recordsWithLot,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"inventory" | "dish" | "new">("inventory");
  const [inventoryId, setInventoryId] = useState("");
  const [dishId, setDishId] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<(typeof UNITS_NEW)[number]>("kg");
  const [startComment, setStartComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [tempEndById, setTempEndById] = useState<Record<string, string>>({});
  const [temp2hById, setTemp2hById] = useState<Record<string, string>>({});
  const [dlcById, setDlcById] = useState<Record<string, string>>({});

  const [inventoryFilter, setInventoryFilter] = useState("");
  const [dishFilter, setDishFilter] = useState("");

  const [lotSearchInput, setLotSearchInput] = useState("");
  const [lookupRecord, setLookupRecord] = useState<PreparationRecord | null>(null);
  const [lookupHint, setLookupHint] = useState<"none" | "notfound" | "done" | "need_first" | "found">("none");
  const [lastLotAck, setLastLotAck] = useState<string | null>(null);

  const lotSearchNorm = normalizeSearch(lotSearchInput);
  const lotMatches = useMemo(() => {
    if (lotSearchNorm.length < 1) return [];
    return recordsWithLot.filter((r) => matchesLotRecord(r, lotSearchNorm)).slice(0, 10);
  }, [recordsWithLot, lotSearchNorm]);

  const filteredPreps = useMemo(() => {
    const q = normalizeSearch(inventoryFilter);
    if (!q) return inventoryPreps;
    return inventoryPreps.filter((p) => p.name.toLowerCase().includes(q));
  }, [inventoryPreps, inventoryFilter]);

  const filteredDishes = useMemo(() => {
    const q = normalizeSearch(dishFilter);
    if (!q) return dishes;
    return dishes.filter((d) => d.name.toLowerCase().includes(q));
  }, [dishes, dishFilter]);

  const mergedAwaiting2h = useMemo(() => {
    const byId = new Map<string, PreparationRecord>();
    for (const r of awaiting2h) byId.set(r.id, r);
    if (lookupRecord && needsComplement2hDlc(lookupRecord)) {
      byId.set(lookupRecord.id, lookupRecord);
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ta = a.temp_2h_due_at ? new Date(a.temp_2h_due_at).getTime() : 0;
      const tb = b.temp_2h_due_at ? new Date(b.temp_2h_due_at).getTime() : 0;
      return ta - tb;
    });
  }, [awaiting2h, lookupRecord]);

  function openModal() {
    setShowModal(true);
    setError(null);
    setNewName("");
    setNewUnit("kg");
    setStartComment("");
    setInventoryFilter("");
    setDishFilter("");
    if (inventoryPreps.length > 0) {
      setMode("inventory");
      setInventoryId(inventoryPreps[0].id);
      setDishId(dishes[0]?.id ?? "");
    } else if (dishes.length > 0) {
      setMode("dish");
      setDishId(dishes[0].id);
      setInventoryId("");
    } else {
      setMode("new");
      setInventoryId("");
      setDishId("");
    }
  }

  const canStart =
    (mode === "inventory" && Boolean(inventoryId)) ||
    (mode === "dish" && Boolean(dishId)) ||
    (mode === "new" && newName.trim().length > 0);

  function startPrep() {
    setError(null);
    start(async () => {
      const r = await startPreparationAction(restaurantId, {
        mode,
        inventoryItemId: mode === "inventory" ? inventoryId : null,
        dishId: mode === "dish" ? dishId : null,
        newName: mode === "new" ? newName : null,
        newUnit: mode === "new" ? newUnit : null,
        comment: startComment.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShowModal(false);
      router.refresh();
    });
  }

  function submitTempEnd(id: string) {
    const raw = tempEndById[id] ?? "";
    setError(null);
    start(async () => {
      const r = await recordPreparationTempEndAction(restaurantId, id, raw);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLastLotAck(r.lotReference);
      setLookupHint("none");
      setLookupRecord(null);
      setTempEndById((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      router.refresh();
    });
  }

  function applyLotLookupResult(rec: PreparationRecord) {
    setError(null);
    if (rec.temp_2h_recorded_at) {
      setLookupHint("done");
      setLookupRecord(rec);
      return;
    }
    if (!rec.temp_end_recorded_at) {
      setLookupHint("need_first");
      setLookupRecord(rec);
      return;
    }
    setLookupHint("found");
    setLookupRecord(rec);
    start(() => {
      router.refresh();
    });
  }

  function searchByLot() {
    if (lotMatches.length >= 1) {
      applyLotLookupResult(lotMatches[0]);
      return;
    }
    setError(null);
    setLookupHint("none");
    setLookupRecord(null);
    start(async () => {
      const r = await lookupPreparationByLotAction(restaurantId, lotSearchInput);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!r.record) {
        setLookupHint("notfound");
        return;
      }
      applyLotLookupResult(r.record);
    });
  }

  function selectLotSuggestion(rec: PreparationRecord) {
    setLotSearchInput(rec.lot_reference ?? "");
    applyLotLookupResult(rec);
  }

  function submit2h(id: string) {
    const t = temp2hById[id] ?? "";
    const dlc = dlcById[id] ?? "";
    setError(null);
    start(async () => {
      const r = await recordPreparation2hAndDlcAction(restaurantId, id, {
        temperatureRaw: t,
        dlcDate: dlc,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTemp2hById((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      setDlcById((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      setLookupRecord(null);
      setLookupHint("none");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {lastLotAck && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            <span className="font-semibold">1er relevé enregistré.</span> Lot attribué :{" "}
            <span className="font-mono font-bold tracking-tight">{lastLotAck}</span>
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            La fiche est en attente du complément (T° +2 h & DLC). Vous pouvez revenir plus tard : saisissez ce numéro
            ci-dessous pour la retrouver.
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-emerald-900 underline"
            onClick={() => setLastLotAck(null)}
          >
            Masquer
          </button>
        </div>
      )}

      <section className={`${uiCard}`}>
        <h2 className="text-sm font-semibold text-slate-900">Retrouver une préparation par n° de lot</h2>
        <p className="mt-1 text-xs text-slate-500">
          Comme pour les composants d’un plat : tapez pour filtrer la liste (n° de lot ou libellé). Douchette ou saisie
          exacte possible en secours.
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              className={`${uiInput} min-w-[12rem] flex-1 font-mono text-sm`}
              value={lotSearchInput}
              onChange={(e) => setLotSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchByLot()}
              placeholder="Filtrer les lots récents…"
              aria-autocomplete="list"
              aria-expanded={lotMatches.length > 0}
            />
            <button type="button" disabled={pending} className={uiBtnSecondary} onClick={searchByLot}>
              {lotMatches.length >= 1 ? "Ouvrir le 1er résultat" : "Rechercher (exact)"}
            </button>
          </div>
          {lotMatches.length > 0 && (
            <ul
              className="max-h-48 overflow-auto rounded-xl border border-slate-100 bg-white shadow-sm"
              role="listbox"
            >
              {lotMatches.map((rec) => (
                <li key={rec.id} role="option">
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-indigo-50/60"
                    onClick={() => selectLotSuggestion(rec)}
                  >
                    <span className="font-mono font-semibold tracking-tight text-indigo-900">
                      {rec.lot_reference ?? "—"}
                    </span>
                    <span className="text-slate-800">{rec.label}</span>
                    <span className="text-xs text-slate-500">{lotLookupStatusLabel(rec)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lookupHint === "notfound" && lotSearchInput.trim().length > 0 && (
          <p className="mt-2 text-sm text-slate-600">Aucune fiche ne correspond exactement à ce numéro.</p>
        )}
        {lookupHint === "none" && lotSearchNorm.length >= 1 && lotMatches.length === 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Aucune concordance parmi les derniers lots chargés — affinez ou utilisez « Rechercher (exact) » avec le numéro
            complet.
          </p>
        )}
        {lookupHint === "done" && lookupRecord && (
          <p className="mt-2 text-sm text-slate-600">
            Ce lot est déjà clôturé (T° +2 h et DLC enregistrés). Consultez le{" "}
            <Link href="/preparations/registre" className="font-medium text-indigo-700 underline">
              registre
            </Link>
            .
          </p>
        )}
        {lookupHint === "need_first" && lookupRecord && (
          <p className="mt-2 text-sm text-amber-800">
            Ce lot n’a pas encore de 1er relevé de température : complétez la section « 1er relevé » ci-dessous pour la
            préparation « {lookupRecord.label} ».
          </p>
        )}
        {lookupHint === "found" && lookupRecord && (
          <p className="mt-2 text-sm text-emerald-800">
            Fiche ouverte : complément (T° +2 h & DLC) affiché dans la section en attente.
          </p>
        )}
      </section>

      <section>
        <button type="button" className={uiBtnPrimarySm} onClick={openModal}>
          Préparation
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Choisissez une préparation (stock), un plat de la carte, ou créez un nouveau composant « préparation ».
        </p>
      </section>

      {awaitingTempEnd.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">1er relevé — température en fin de préparation</h2>
          <p className="mb-3 text-xs text-slate-500">
            Tant que le 1er relevé n’est pas fait, aucun numéro de lot n’est attribué. Ensuite la fiche passe en attente
            du complément (vous pouvez la reprendre plus tard).
          </p>
          <ul className="space-y-3">
            {awaitingTempEnd.map((r) => (
              <li key={r.id} className={uiCard}>
                <p className="font-medium text-slate-900">{r.label}</p>
                <p className="text-xs text-slate-500">
                  Démarré le{" "}
                  {new Date(r.started_at).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[8rem] flex-1">
                    <label className={uiLabel} htmlFor={`te-${r.id}`}>
                      T° fin (°C)
                    </label>
                    <input
                      id={`te-${r.id}`}
                      type="text"
                      inputMode="decimal"
                      className={`${uiInput} mt-1 w-full tabular-nums`}
                      value={tempEndById[r.id] ?? ""}
                      onChange={(e) => setTempEndById((m) => ({ ...m, [r.id]: e.target.value }))}
                      placeholder="ex. 63"
                    />
                  </div>
                  <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={() => submitTempEnd(r.id)}>
                    Enregistrer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mergedAwaiting2h.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">En attente — T° +2 h & DLC</h2>
          <p className="mb-3 text-xs text-slate-500">
            Après le 1er relevé, un numéro de lot est créé. Vous pouvez interrompre et revenir plus tard : recherche par
            lot ci-dessus. Les données sont enregistrées au registre une fois le complément validé.
          </p>
          <ul className="space-y-4">
            {mergedAwaiting2h.map((r) => {
              const due = r.temp_2h_due_at ? new Date(r.temp_2h_due_at) : null;
              return (
                <li
                  key={r.id}
                  className={`${uiCard} ${lookupRecord?.id === r.id ? "ring-2 ring-indigo-300" : ""}`}
                >
                  {r.lot_reference && (
                    <p className="font-mono text-sm font-semibold tracking-tight text-indigo-900">
                      Lot {r.lot_reference}
                    </p>
                  )}
                  <p className="font-medium text-slate-900">{r.label}</p>
                  <p className="text-xs text-slate-500">
                    Fin prépa :{" "}
                    {r.temp_end_recorded_at
                      ? new Date(r.temp_end_recorded_at).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    {due && (
                      <>
                        {" "}
                        · Contrôle cible vers{" "}
                        {due.toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <label className={uiLabel} htmlFor={`t2-${r.id}`}>
                        T° à +2 h (°C)
                      </label>
                      <input
                        id={`t2-${r.id}`}
                        type="text"
                        inputMode="decimal"
                        className={`${uiInput} mt-1 w-full max-w-xs tabular-nums`}
                        value={temp2hById[r.id] ?? ""}
                        onChange={(e) => setTemp2hById((m) => ({ ...m, [r.id]: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={uiLabel} htmlFor={`dlc-${r.id}`}>
                        DLC
                      </label>
                      <p className="mb-2 text-xs text-slate-500">
                        J = aujourd’hui (calendrier local). La liste calcule automatiquement la date limite.
                      </p>
                      <label className="sr-only" htmlFor={`dlc-quick-${r.id}`}>
                        Proposition de DLC (J à J+4)
                      </label>
                      <select
                        id={`dlc-quick-${r.id}`}
                        className={`${uiSelect} mt-1 w-full max-w-lg`}
                        value={
                          (() => {
                            const cur = dlcById[r.id] ?? "";
                            const quick = [0, 1, 2, 3, 4].map(localDatePlusDaysISO);
                            return quick.includes(cur) ? cur : "";
                          })()
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setDlcById((m) => ({ ...m, [r.id]: v }));
                        }}
                      >
                        <option value="">— Choisir J, J+1 … J+4 —</option>
                        {[0, 1, 2, 3, 4].map((offset) => {
                          const iso = localDatePlusDaysISO(offset);
                          const label = offset === 0 ? "J" : `J+${offset}`;
                          return (
                            <option key={offset} value={iso}>
                              {label} — {formatIsoDateFr(iso)}
                            </option>
                          );
                        })}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">Ou autre date (saisie manuelle) :</p>
                      <input
                        id={`dlc-${r.id}`}
                        type="date"
                        className={`${uiInput} mt-1 w-full max-w-[12rem]`}
                        value={dlcById[r.id] ?? ""}
                        onChange={(e) => setDlcById((m) => ({ ...m, [r.id]: e.target.value }))}
                      />
                      {dlcById[r.id] && (
                        <p className="mt-1 text-xs text-slate-600">
                          DLC retenue : <span className="font-medium">{formatIsoDateFr(dlcById[r.id])}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className={`${uiBtnPrimarySm} mt-3`}
                    onClick={() => submit2h(r.id)}
                  >
                    Valider contrôle & DLC
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {awaitingTempEnd.length === 0 && mergedAwaiting2h.length === 0 && (
        <p className="text-sm text-slate-500">Aucune préparation en cours. Utilisez le bouton « Préparation » pour démarrer.</p>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={`${uiCard} max-h-[90vh] w-full max-w-md overflow-y-auto shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">Nouvelle préparation</h3>
            <div className="mt-3 flex gap-2 text-sm">
              <button
                type="button"
                className={mode === "inventory" ? uiBtnPrimarySm : uiBtnSecondary}
                onClick={() => {
                  setMode("inventory");
                  setInventoryFilter("");
                  if (inventoryPreps[0]) setInventoryId(inventoryPreps[0].id);
                }}
              >
                Composant
              </button>
              <button
                type="button"
                className={mode === "dish" ? uiBtnPrimarySm : uiBtnSecondary}
                onClick={() => {
                  setMode("dish");
                  setDishFilter("");
                  if (dishes[0]) setDishId(dishes[0].id);
                }}
              >
                Plat
              </button>
              <button
                type="button"
                className={mode === "new" ? uiBtnPrimarySm : uiBtnSecondary}
                onClick={() => setMode("new")}
              >
                Créer
              </button>
            </div>

            {mode === "inventory" && (
              <div className="mt-3">
                <label className={uiLabel} htmlFor="prep-inv-search">
                  Préparation (stock)
                </label>
                <p className="mb-1 text-xs text-slate-500">Tapez pour filtrer la liste.</p>
                <input
                  id="prep-inv-search"
                  type="search"
                  autoComplete="off"
                  className={`${uiInput} w-full`}
                  value={inventoryFilter}
                  onChange={(e) => setInventoryFilter(e.target.value)}
                  placeholder="Rechercher par nom…"
                />
                {inventoryPreps.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Aucune préparation en stock (type « préparation »).</p>
                ) : (
                  <ul
                    className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white"
                    role="listbox"
                  >
                    {filteredPreps.length === 0 ? (
                      <li className="px-3 py-4 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</li>
                    ) : (
                      filteredPreps.map((p) => (
                        <li key={p.id} role="option" aria-selected={inventoryId === p.id}>
                          <button
                            type="button"
                            className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                              inventoryId === p.id ? "bg-indigo-50 font-medium text-indigo-900" : "text-slate-800"
                            }`}
                            onClick={() => setInventoryId(p.id)}
                          >
                            {p.name}{" "}
                            <span className="font-normal text-slate-500">({p.unit})</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
                {inventoryId && (
                  <p className="mt-2 text-xs text-slate-600">
                    Sélection :{" "}
                    <span className="font-medium text-slate-900">
                      {inventoryPreps.find((x) => x.id === inventoryId)?.name ?? "—"}
                    </span>
                  </p>
                )}
              </div>
            )}

            {mode === "dish" && (
              <div className="mt-3">
                <label className={uiLabel} htmlFor="prep-dish-search">
                  Plat
                </label>
                <p className="mb-1 text-xs text-slate-500">Tapez pour filtrer la liste.</p>
                <input
                  id="prep-dish-search"
                  type="search"
                  autoComplete="off"
                  className={`${uiInput} w-full`}
                  value={dishFilter}
                  onChange={(e) => setDishFilter(e.target.value)}
                  placeholder="Rechercher un plat…"
                />
                {dishes.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Aucun plat sur la carte.</p>
                ) : (
                  <ul
                    className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white"
                    role="listbox"
                  >
                    {filteredDishes.length === 0 ? (
                      <li className="px-3 py-4 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</li>
                    ) : (
                      filteredDishes.map((d) => (
                        <li key={d.id} role="option" aria-selected={dishId === d.id}>
                          <button
                            type="button"
                            className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                              dishId === d.id ? "bg-indigo-50 font-medium text-indigo-900" : "text-slate-800"
                            }`}
                            onClick={() => setDishId(d.id)}
                          >
                            {d.name}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
                {dishId && (
                  <p className="mt-2 text-xs text-slate-600">
                    Sélection :{" "}
                    <span className="font-medium text-slate-900">
                      {dishes.find((x) => x.id === dishId)?.name ?? "—"}
                    </span>
                  </p>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className={uiLabel} htmlFor="prep-new-name">
                    Nom de la préparation
                  </label>
                  <input
                    id="prep-new-name"
                    className={`${uiInput} mt-1 w-full`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex. Sauce béchamel"
                  />
                </div>
                <div>
                  <label className={uiLabel} htmlFor="prep-new-unit">
                    Unité de stock
                  </label>
                  <select
                    id="prep-new-unit"
                    className={`${uiSelect} mt-1 w-full`}
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as (typeof UNITS_NEW)[number])}
                  >
                    {UNITS_NEW.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-500">
                  Un composant « préparation » sera ajouté au stock (recette à compléter plus tard dans Stock).
                </p>
              </div>
            )}

            <div className="mt-3">
              <label className={uiLabel}>Commentaire (optionnel)</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[3rem] w-full`}
                value={startComment}
                onChange={(e) => setStartComment(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !canStart}
                className={uiBtnPrimarySm}
                onClick={startPrep}
              >
                {pending ? "Création…" : "Démarrer"}
              </button>
              <button
                type="button"
                disabled={pending}
                className={uiBtnSecondary}
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
