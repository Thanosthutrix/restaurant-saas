"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, Check, ChefHat, Clock, Plus, Sparkles, X } from "lucide-react";
import type { PreparationCandidateDish, PreparationCandidatePrep, PreparationRecord } from "@/lib/preparations/types";
import { closePreparationAction, recordPreparation2hAction, startPreparationAction } from "./actions";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";
import { EmptyState } from "@/components/ui/EmptyState";

const UNITS_NEW = ["kg", "g", "l", "ml", "unit", "sceau"] as const;

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

/** Date locale J+n au format AAAA-MM-JJ (pour input date et comparaisons). */
function localDatePlusDaysISO(offsetDays: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Date + heure déterministe (fuseau Paris, connecteur littéral) — évite le mismatch d'hydratation. */
function fmtDateTimeParis(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} à ${time}`;
}

function fmtDlc(dlc: string): string {
  return new Date(dlc + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Badge DLC. `todayIso` (null avant montage client) évite tout mismatch
 * d'hydratation : au 1er rendu (serveur + client) on affiche la date neutre,
 * l'urgence (rouge/ambre) n'apparaît qu'après montage.
 */
function dlcBadge(dlc: string | null, todayIso: string | null): { label: string; cls: string } | null {
  if (!dlc) return null;
  const neutral = { label: `DLC ${fmtDlc(dlc)}`, cls: "bg-stone-100 text-stone-600" };
  if (!todayIso) return neutral;
  const d = new Date(todayIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const tomorrow = d.toISOString().slice(0, 10);
  if (dlc < todayIso) return { label: "DLC dépassée", cls: "bg-rose-100 text-rose-800" };
  if (dlc === todayIso) return { label: "DLC aujourd’hui", cls: "bg-rose-100 text-rose-800" };
  if (dlc === tomorrow) return { label: `DLC ${fmtDlc(dlc)}`, cls: "bg-amber-100 text-amber-900" };
  return neutral;
}

function overdue2h(r: PreparationRecord, nowMs: number | null): boolean {
  if (nowMs == null) return false;
  if (r.temp_2h_recorded_at) return false;
  if (!r.temp_2h_due_at) return false;
  return new Date(r.temp_2h_due_at).getTime() < nowMs;
}

/** Rappel : échéance +2 h dans les 15 prochaines minutes (à partir de ~1h45). */
function reminder2h(r: PreparationRecord, nowMs: number | null): boolean {
  if (nowMs == null) return false;
  if (r.temp_2h_recorded_at) return false;
  if (!r.temp_2h_due_at) return false;
  const due = new Date(r.temp_2h_due_at).getTime();
  return due >= nowMs && due < nowMs + 15 * 60 * 1000;
}

type Props = {
  restaurantId: string;
  inventoryPreps: PreparationCandidatePrep[];
  dishes: PreparationCandidateDish[];
  active: PreparationRecord[];
};

export function PreparationsClient({ restaurantId, inventoryPreps, dishes, active }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastLotAck, setLastLotAck] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"inventory" | "dish" | "new">("inventory");
  const [inventoryId, setInventoryId] = useState<string>(inventoryPreps[0]?.id ?? "");
  const [dishId, setDishId] = useState<string>(dishes[0]?.id ?? "");
  const [inventoryFilter, setInventoryFilter] = useState("");
  const [dishFilter, setDishFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<(typeof UNITS_NEW)[number]>("kg");
  const [dlc, setDlc] = useState<string>(() => localDatePlusDaysISO(2));
  const [tempEnd, setTempEnd] = useState("");
  const [startComment, setStartComment] = useState("");

  const [temp2hById, setTemp2hById] = useState<Record<string, string>>({});

  // Temps « courant » côté client uniquement (évite mismatch d'hydratation + date figée serveur).
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [todayIso, setTodayIso] = useState<string | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    setTodayIso(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  }, []);

  const filteredPreps = useMemo(() => {
    const q = normalizeSearch(inventoryFilter);
    return q ? inventoryPreps.filter((p) => normalizeSearch(p.name).includes(q)) : inventoryPreps;
  }, [inventoryPreps, inventoryFilter]);

  const filteredDishes = useMemo(() => {
    const q = normalizeSearch(dishFilter);
    return q ? dishes.filter((d) => normalizeSearch(d.name).includes(q)) : dishes;
  }, [dishes, dishFilter]);

  const overdueCount = active.filter((r) => overdue2h(r, nowMs)).length;
  const reminderCount = active.filter((r) => reminder2h(r, nowMs)).length;

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showModal]);

  function openModal() {
    setError(null);
    setMode("inventory");
    setInventoryFilter("");
    setDishFilter("");
    setInventoryId(inventoryPreps[0]?.id ?? "");
    setDishId(dishes[0]?.id ?? "");
    setNewName("");
    setNewUnit("kg");
    setDlc(localDatePlusDaysISO(2));
    setTempEnd("");
    setStartComment("");
    setShowModal(true);
  }

  const canStart =
    tempEnd.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dlc) &&
    (mode === "inventory" ? !!inventoryId : mode === "dish" ? !!dishId : newName.trim().length > 0);

  function startPrep() {
    setError(null);
    start(async () => {
      const r = await startPreparationAction(restaurantId, {
        mode,
        inventoryItemId: mode === "inventory" ? inventoryId : null,
        dishId: mode === "dish" ? dishId : null,
        newName: mode === "new" ? newName : null,
        newUnit: mode === "new" ? newUnit : null,
        comment: startComment || null,
        tempEndRaw: tempEnd,
        dlcDate: dlc,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLastLotAck(r.lotReference);
      setShowModal(false);
      router.refresh();
    });
  }

  function submit2h(id: string) {
    const v = temp2hById[id];
    if (!v || !v.trim()) return;
    setError(null);
    start(async () => {
      const r = await recordPreparation2hAction(restaurantId, id, v);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTemp2hById((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      router.refresh();
    });
  }

  function closePrep(r: PreparationRecord) {
    if (!window.confirm(`Clôturer « ${r.label} » (lot ${r.lot_reference}) ? Elle quitte la page mais reste au registre.`)) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await closePreparationAction(restaurantId, r.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {lastLotAck && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Préparation lancée — lot <span className="font-mono font-bold">{lastLotAck}</span>. Pensez au contrôle à +2 h.
          </span>
          <button type="button" className="ml-auto text-xs font-semibold underline" onClick={() => setLastLotAck(null)}>
            Masquer
          </button>
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <span>
            <span className="font-semibold">{overdueCount}</span> préparation{overdueCount > 1 ? "s" : ""} en retard pour
            le contrôle de température à +2 h.
          </span>
        </div>
      )}

      {reminderCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
          <Clock className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
          <span>
            <span className="font-semibold">{reminderCount}</span> préparation{reminderCount > 1 ? "s" : ""} à relever
            bientôt (contrôle +2 h sous 15 min).
          </span>
        </div>
      )}

      <div>
        <button type="button" className={`${uiBtnPrimary} inline-flex items-center gap-1.5`} onClick={openModal}>
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle préparation
        </button>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="Aucune préparation en cours"
          description="Lancez une préparation : choisissez la DLC et la température de fin, puis suivez le contrôle à +2 h ici."
        />
      ) : (
        <ul className="space-y-2">
          {active.map((r) => {
            const od = overdue2h(r, nowMs);
            const rm = !od && reminder2h(r, nowMs);
            const done2h = !!r.temp_2h_recorded_at;
            const badge = dlcBadge(r.dlc_date, todayIso);
            return (
              <li
                key={r.id}
                className={`rounded-2xl border bg-white p-3 shadow-sm ${
                  od
                    ? "border-rose-300 ring-1 ring-rose-200"
                    : rm
                      ? "border-sky-300 ring-1 ring-sky-200"
                      : "border-stone-200/70"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                    <Boxes className="h-5 w-5" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-stone-900">{r.label}</span>
                      {badge ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      <span className="font-mono font-semibold text-copper-800">{r.lot_reference}</span>
                      {r.temp_end_recorded_at ? <> · fin {fmtDateTimeParis(r.temp_end_recorded_at)}</> : null}
                    </p>
                  </div>

                  {/* Deux cases : T° fin (remplie) + T° +2 h (à saisir) */}
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">T° fin</span>
                      <span className="flex h-10 min-w-[3.5rem] items-center justify-center rounded-xl border border-stone-200 bg-stone-50 px-2 text-sm font-semibold tabular-nums text-stone-800">
                        {r.temp_end_celsius != null ? `${r.temp_end_celsius}°` : "—"}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${od ? "text-rose-600" : rm ? "text-sky-600" : "text-stone-400"}`}>
                        {rm ? <Clock className="h-3 w-3" aria-hidden /> : null}
                        T° +2 h
                      </span>
                      {done2h ? (
                        <span className="flex h-10 min-w-[3.5rem] items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-sm font-semibold tabular-nums text-emerald-800">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          {r.temp_2h_celsius}°
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={temp2hById[r.id] ?? ""}
                            onChange={(e) => setTemp2hById((m) => ({ ...m, [r.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && submit2h(r.id)}
                            placeholder="°C"
                            className={`${uiInput} h-10 w-16 text-center tabular-nums ${od ? "border-rose-300" : rm ? "border-sky-300" : ""}`}
                            aria-label={`Température +2 h pour ${r.label}`}
                          />
                          <button
                            type="button"
                            disabled={pending || !(temp2hById[r.id] ?? "").trim()}
                            onClick={() => submit2h(r.id)}
                            className={`${uiBtnPrimary} h-10 px-3`}
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => closePrep(r)}
                    className="flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
                    title="Clôturer (stock épuisé, DLC dépassée…)"
                  >
                    Clôturer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Nouvelle préparation"
          onClick={() => {
            setShowModal(false);
            setError(null);
          }}
        >
          <div
            className="my-6 w-full max-w-md overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <Boxes className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-stone-900">Nouvelle préparation</p>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="max-h-[78vh] space-y-4 overflow-y-auto px-4 py-4">
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

              <div className="grid grid-cols-3 gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
                {(
                  [
                    { v: "inventory", label: "Composant", icon: Boxes },
                    { v: "dish", label: "Plat", icon: ChefHat },
                    { v: "new", label: "Créer", icon: Sparkles },
                  ] as const
                ).map(({ v, label, icon: ModeIcon }) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={mode === v}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition ${
                      mode === v ? "bg-white text-copper-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-700"
                    }`}
                    onClick={() => setMode(v)}
                  >
                    <ModeIcon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>

              {mode === "inventory" && (
                <div>
                  <label className={uiLabel}>Préparation (stock)</label>
                  <input
                    type="search"
                    autoComplete="off"
                    className={`${uiInput} mt-1 w-full`}
                    value={inventoryFilter}
                    onChange={(e) => setInventoryFilter(e.target.value)}
                    placeholder="Rechercher par nom…"
                  />
                  {inventoryPreps.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">Aucune préparation en stock (type « préparation »).</p>
                  ) : (
                    <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-stone-200 bg-white" role="listbox">
                      {filteredPreps.length === 0 ? (
                        <li className="px-3 py-4 text-center text-sm text-stone-500">Aucun résultat.</li>
                      ) : (
                        filteredPreps.map((p) => (
                          <li key={p.id} role="option" aria-selected={inventoryId === p.id}>
                            <button
                              type="button"
                              className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-stone-50 ${
                                inventoryId === p.id ? "bg-copper-50 font-medium text-copper-900" : "text-stone-800"
                              }`}
                              onClick={() => setInventoryId(p.id)}
                            >
                              {p.name} <span className="font-normal text-stone-500">({p.unit})</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}

              {mode === "dish" && (
                <div>
                  <label className={uiLabel}>Plat</label>
                  <input
                    type="search"
                    autoComplete="off"
                    className={`${uiInput} mt-1 w-full`}
                    value={dishFilter}
                    onChange={(e) => setDishFilter(e.target.value)}
                    placeholder="Rechercher un plat…"
                  />
                  {dishes.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">Aucun plat sur la carte.</p>
                  ) : (
                    <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-stone-200 bg-white" role="listbox">
                      {filteredDishes.length === 0 ? (
                        <li className="px-3 py-4 text-center text-sm text-stone-500">Aucun résultat.</li>
                      ) : (
                        filteredDishes.map((d) => (
                          <li key={d.id} role="option" aria-selected={dishId === d.id}>
                            <button
                              type="button"
                              className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-stone-50 ${
                                dishId === d.id ? "bg-copper-50 font-medium text-copper-900" : "text-stone-800"
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
                </div>
              )}

              {mode === "new" && (
                <div className="space-y-3">
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
                </div>
              )}

              {/* DLC + T° fin (obligatoires au lancement) */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                <div>
                  <label className={uiLabel} htmlFor="prep-dlc">
                    DLC
                  </label>
                  <input
                    id="prep-dlc"
                    type="date"
                    min={todayIso ?? undefined}
                    className={`${uiInput} mt-1 h-10 w-full`}
                    value={dlc}
                    onChange={(e) => setDlc(e.target.value)}
                  />
                </div>
                <div>
                  <label className={uiLabel} htmlFor="prep-tempend">
                    T° fin (°C)
                  </label>
                  <input
                    id="prep-tempend"
                    type="text"
                    inputMode="decimal"
                    className={`${uiInput} mt-1 h-10 w-full tabular-nums`}
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    placeholder="ex. 63"
                  />
                </div>
              </div>

              <div>
                <label className={uiLabel}>Commentaire (optionnel)</label>
                <textarea
                  className={`${uiInput} mt-1 min-h-[3rem] w-full`}
                  value={startComment}
                  onChange={(e) => setStartComment(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" disabled={pending || !canStart} className={`${uiBtnPrimary} flex-1`} onClick={startPrep}>
                  {pending ? "Création…" : "Démarrer la préparation"}
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
        </div>
      )}
    </div>
  );
}
