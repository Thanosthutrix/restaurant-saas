"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Refrigerator, Snowflake, Sunrise, Sunset, X, type LucideIcon } from "lucide-react";
import {
  InteractiveFloorPlan,
  type FloorPlanTableStatusState,
} from "@/components/salle/InteractiveFloorPlan";
import { FloorPlanLevelTabs } from "@/components/salle/FloorPlanLevelTabs";
import type { HygieneElement } from "@/lib/hygiene/types";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_COLD_EVENT_LABEL_FR,
  type HygieneColdEventKind,
} from "@/lib/hygiene/types";
import { submitColdTemperatureReading } from "@/lib/offline/submitColdTemperatureReading";
import { useQueuedColdReadings, queuedReadingsByElement } from "@/lib/hooks/useQueuedColdReadings";
import {
  parseStoredKitchenFloorPlanDocument,
  setActiveLevelId,
  sortLevels,
  type StoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDocument";
import { buildFloorEquipmentFromElements } from "@/lib/cuisine/kitchenEquipmentPlan";
import {
  buildRecordedCountByLevel,
  mergeEquipmentForTemperatureLevel,
  useKitchenFloorPlanDocumentPersistence,
} from "@/lib/cuisine/useKitchenFloorPlanPersistence";
import { isStoredKitchenFloorPlanDocumentEmpty } from "@/lib/cuisine/kitchenFloorPlanLayout";
import { uiBtnPrimary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  coldElements: HygieneElement[];
  serverStoredDocument: StoredKitchenFloorPlanDocument | null;
  todayRecordedByElement: Record<string, number>;
  eventKind: HygieneColdEventKind;
  onEventKindChange: (kind: HygieneColdEventKind) => void;
  initials: string;
  onInitialsChange: (value: string) => void;
  onReadingSaved: () => void;
};

function coldMeta(category: string): { Icon: LucideIcon; tone: string } {
  if (category === "congelateur") return { Icon: Snowflake, tone: "bg-cyan-50 text-cyan-700" };
  return { Icon: Refrigerator, tone: "bg-sky-50 text-sky-700" };
}

export function KitchenTemperaturePlanView({
  restaurantId,
  coldElements,
  serverStoredDocument,
  todayRecordedByElement,
  eventKind,
  onEventKindChange,
  initials,
  onInitialsChange,
  onReadingSaved,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { resolveDocument } = useKitchenFloorPlanDocumentPersistence(restaurantId, serverStoredDocument);
  const [mounted, setMounted] = useState(false);
  const [document, setDocument] = useState<StoredKitchenFloorPlanDocument>(() =>
    parseStoredKitchenFloorPlanDocument(serverStoredDocument)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draftTemps, setDraftTemps] = useState<Record<string, string>>({});
  const [queuedNotice, setQueuedNotice] = useState(false);

  const queuedReadings = useQueuedColdReadings(restaurantId, eventKind);
  const queuedByElement = useMemo(() => queuedReadingsByElement(queuedReadings), [queuedReadings]);

  const allEquipment = useMemo(() => buildFloorEquipmentFromElements(coldElements), [coldElements]);
  const elementById = useMemo(() => new Map(coldElements.map((el) => [el.id, el])), [coldElements]);

  const activeLevelId = document.activeLevelId;
  const levels = sortLevels(document.levels);

  const layout = useMemo(
    () => mergeEquipmentForTemperatureLevel(allEquipment, document, activeLevelId),
    [allEquipment, document, activeLevelId]
  );

  const planEmpty = isStoredKitchenFloorPlanDocumentEmpty(document);
  const hasPlacedEquipment = layout.tables.length > 0;

  const recordedIds = useMemo(
    () => new Set(Object.keys(todayRecordedByElement)),
    [todayRecordedByElement]
  );

  const recordedCountByLevel = useMemo(() => {
    const base = buildRecordedCountByLevel(document, recordedIds);
    const totals = Object.fromEntries(
      document.levels.map((level) => {
        const removed = new Set(level.layout.removedFromPlan ?? []);
        const total = Object.keys(level.layout.baseTables).filter((id) => !removed.has(id)).length;
        return [level.id, { recorded: base[level.id] ?? 0, total }];
      })
    );
    return totals;
  }, [document, recordedIds]);

  const tableStatusMap = useMemo(() => {
    const map: Record<string, { state: FloorPlanTableStatusState; temperature?: number }> = {};
    for (const table of layout.tables) {
      const recorded = todayRecordedByElement[table.id];
      const queued = queuedByElement[table.id];
      const draft = draftTemps[table.id];
      if (recorded != null) {
        map[table.id] = { state: "recorded", temperature: recorded };
      } else if (queued) {
        const temp = Number.parseFloat(queued.temperatureCelsiusRaw.replace(",", "."));
        map[table.id] = {
          state: "queued",
          temperature: Number.isFinite(temp) ? temp : undefined,
        };
      } else if (draft?.trim()) {
        map[table.id] = { state: "draft" };
      } else {
        map[table.id] = { state: "pending" };
      }
    }
    return map;
  }, [layout.tables, todayRecordedByElement, queuedByElement, draftTemps]);

  const selectedElement = selectedId ? elementById.get(selectedId) : null;

  useEffect(() => {
    setMounted(true);
    setDocument(resolveDocument());
  }, [restaurantId, serverStoredDocument]);

  useEffect(() => {
    if (!selectedId) return;
    setTempValue(draftTemps[selectedId] ?? "");
    setComment("");
    setError(null);
  }, [selectedId, draftTemps]);

  function switchLevel(levelId: string) {
    if (levelId === activeLevelId) return;
    setDocument(setActiveLevelId(document, levelId));
    setSelectedId(null);
  }

  function saveReading() {
    if (!selectedId || !selectedElement) return;
    setError(null);
    setQueuedNotice(false);
    start(async () => {
      const r = await submitColdTemperatureReading(restaurantId, selectedId, {
        eventKind,
        temperatureCelsiusRaw: tempValue,
        initials,
        comment: comment.trim() || null,
        elementName: selectedElement.name,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDraftTemps((m) => {
        const next = { ...m };
        delete next[selectedId];
        return next;
      });
      setSelectedId(null);
      if (r.queued) setQueuedNotice(true);
      onReadingSaved();
      if (!r.queued) router.refresh();
    });
  }

  if (!mounted) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
    );
  }

  if (planEmpty || !hasPlacedEquipment) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-6 py-10 text-center">
        <p className="text-base font-semibold text-amber-950">Plan cuisine non configuré</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-amber-900/80">
          Placez vos équipements froid sur le plan pour utiliser la saisie visuelle, ou revenez à la vue
          liste.
        </p>
        <Link
          href="/hygiene/cuisine-plan"
          className="mt-4 inline-flex rounded-xl bg-copper-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-copper-600"
        >
          Configurer le plan cuisine
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className={uiLabel}>Moment du relevé</span>
          <div className="mt-1 inline-grid grid-cols-2 gap-2">
            {(["opening", "closing"] as const).map((k) => {
              const active = eventKind === k;
              const Icon = k === "opening" ? Sunrise : Sunset;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onEventKindChange(k)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-copper-300 bg-copper-50 text-copper-800"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {HYGIENE_COLD_EVENT_LABEL_FR[k]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sm:w-56">
          <label className={uiLabel} htmlFor="kitchen-plan-initials">
            Initiales (optionnel)
          </label>
          <input
            id="kitchen-plan-initials"
            type="text"
            autoComplete="off"
            maxLength={16}
            className={`${uiInput} mt-1 w-full`}
            value={initials}
            onChange={(e) => onInitialsChange(e.target.value)}
            placeholder="ex. J.D."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-amber-400 bg-amber-50" aria-hidden />
          En attente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-50" aria-hidden />
          Relevé enregistré
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-sky-500 bg-sky-50" aria-hidden />
          En attente de sync
        </span>
        <Link
          href="/hygiene/cuisine-plan"
          className="ml-auto font-semibold text-copper-700 underline hover:text-copper-600"
        >
          Modifier le plan
        </Link>
      </div>

      <FloorPlanLevelTabs
        activeLevelId={activeLevelId}
        levels={levels}
        onSelect={switchLevel}
        countLabelByLevel={Object.fromEntries(
          Object.entries(recordedCountByLevel).map(([id, { recorded, total }]) => [
            id,
            total > 0 ? `${recorded}/${total} relevés` : "0 équip.",
          ])
        )}
      />

      <InteractiveFloorPlan
        mode="kitchen-temp"
        itemKind="equipment"
        hideCapacity
        hideHeader
        initialTables={layout.tables}
        initialFixtures={layout.fixtures}
        tableStatusMap={tableStatusMap}
        onTableClick={(table) => setSelectedId(table.id)}
        planCopy={{
          title: "Plan cuisine",
          description: "",
          canvasLabel: "Plan cuisine — relevés température",
        }}
      />

      {queuedNotice ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Relevé enregistré localement — il sera synchronisé dès que la connexion sera disponible.
        </p>
      ) : null}

      {selectedElement ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-temp-dialog-title"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {(() => {
                  const meta = coldMeta(selectedElement.category);
                  const Icon = meta.Icon;
                  return (
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  );
                })()}
                <div className="min-w-0">
                  <h3 id="kitchen-temp-dialog-title" className="truncate font-semibold text-stone-900">
                    {selectedElement.name}
                  </h3>
                  <p className="truncate text-xs text-stone-400">
                    {selectedElement.area_label ||
                      HYGIENE_CATEGORY_LABEL_FR[
                        selectedElement.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR
                      ]}{" "}
                    · {HYGIENE_COLD_EVENT_LABEL_FR[eventKind]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {todayRecordedByElement[selectedElement.id] != null ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Relevé déjà enregistré aujourd&apos;hui :{" "}
                <strong>{todayRecordedByElement[selectedElement.id]} °C</strong>. Vous pouvez enregistrer un
                nouveau relevé si besoin.
              </p>
            ) : null}

            <div className="mt-4">
              <label className={uiLabel} htmlFor="kitchen-temp-value">
                Température (°C)
              </label>
              <input
                id="kitchen-temp-value"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                className={`${uiInput} mt-1 w-full text-center text-lg tabular-nums`}
                value={tempValue}
                onChange={(e) => {
                  setTempValue(e.target.value);
                  setDraftTemps((m) => ({ ...m, [selectedElement.id]: e.target.value }));
                }}
                placeholder="-18"
              />
            </div>

            <div className="mt-3">
              <label className={uiLabel} htmlFor="kitchen-temp-comment">
                Note / anomalie (optionnel)
              </label>
              <input
                id="kitchen-temp-comment"
                type="text"
                autoComplete="off"
                className={`${uiInput} mt-1 w-full text-sm`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || tempValue.trim() === ""}
                className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}
                onClick={saveReading}
              >
                {pending ? "Enregistrement…" : "Enregistrer le relevé"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                Annuler
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-400">Plage acceptée : -40 °C à +25 °C.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
