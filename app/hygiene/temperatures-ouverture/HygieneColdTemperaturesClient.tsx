"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,
  LayoutGrid,
  List,
  Refrigerator,
  Snowflake,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { KitchenTemperaturePlanView } from "@/components/cuisine/KitchenTemperaturePlanView";
import {
  isStoredKitchenFloorPlanDocumentEmpty,
  loadKitchenFloorPlanDocument,
  resolveStoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanLayout";
import type { StoredKitchenFloorPlanDocument } from "@/lib/cuisine/kitchenFloorPlanDocument";
import type { HygieneElement } from "@/lib/hygiene/types";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_COLD_EVENT_LABEL_FR,
  type HygieneColdEventKind,
  type HygieneColdTemperatureReadingWithElement,
} from "@/lib/hygiene/types";
import { submitColdTemperatureReading } from "@/lib/offline/submitColdTemperatureReading";
import {
  queuedReadingsByElement,
  useQueuedColdReadings,
} from "@/lib/hooks/useQueuedColdReadings";
import { uiBtnPrimary, uiInput, uiLabel } from "@/components/ui/premium";

type ViewMode = "list" | "plan";

type Props = {
  restaurantId: string;
  coldElements: HygieneElement[];
  recentReadings: HygieneColdTemperatureReadingWithElement[];
  kitchenPlanDocument: StoredKitchenFloorPlanDocument | null;
  todayOpeningByElement: Record<string, number>;
  todayClosingByElement: Record<string, number>;
};

function coldMeta(category: string): { Icon: LucideIcon; tone: string } {
  if (category === "congelateur") return { Icon: Snowflake, tone: "bg-cyan-50 text-cyan-700" };
  return { Icon: Refrigerator, tone: "bg-sky-50 text-sky-700" };
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short" })} · ${d.toLocaleTimeString(
    "fr-FR",
    { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }
  )}`;
}

export function HygieneColdTemperaturesClient({
  restaurantId,
  coldElements,
  recentReadings,
  kitchenPlanDocument,
  todayOpeningByElement,
  todayClosingByElement,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [eventKind, setEventKind] = useState<HygieneColdEventKind>("opening");
  const [initials, setInitials] = useState("");
  const [temps, setTemps] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);

  const queuedReadings = useQueuedColdReadings(restaurantId, eventKind);
  const queuedByElement = useMemo(() => queuedReadingsByElement(queuedReadings), [queuedReadings]);

  useEffect(() => {
    const local = loadKitchenFloorPlanDocument(restaurantId);
    const { document } = resolveStoredKitchenFloorPlanDocument(kitchenPlanDocument, local);
    if (!isStoredKitchenFloorPlanDocumentEmpty(document)) {
      setViewMode("plan");
    }
  }, [restaurantId, kitchenPlanDocument]);

  const todayRecordedByElement =
    eventKind === "opening" ? todayOpeningByElement : todayClosingByElement;

  const filledIds = useMemo(
    () => coldElements.filter((el) => (temps[el.id] ?? "").trim() !== "").map((el) => el.id),
    [coldElements, temps]
  );

  function setTemp(id: string, v: string) {
    setTemps((m) => ({ ...m, [id]: v }));
    setSavedCount(0);
    if (rowErrors[id]) setRowErrors((m) => ({ ...m, [id]: "" }));
  }

  function submitAll() {
    setFormError(null);
    setSavedCount(0);
    setQueuedCount(0);
    if (filledIds.length === 0) {
      setFormError("Saisissez au moins une température.");
      return;
    }
    const entries = coldElements.filter((el) => filledIds.includes(el.id));
    start(async () => {
      const results = await Promise.all(
        entries.map(async (el) => {
          const r = await submitColdTemperatureReading(restaurantId, el.id, {
            eventKind,
            temperatureCelsiusRaw: temps[el.id],
            initials,
            comment: (comments[el.id] ?? "").trim() || null,
            elementName: el.name,
          });
          return { id: el.id, r };
        })
      );

      const nextErrors: Record<string, string> = {};
      const succeeded: string[] = [];
      let queued = 0;
      for (const { id, r } of results) {
        if (r.ok) {
          succeeded.push(id);
          if ("queued" in r && r.queued) queued += 1;
        } else nextErrors[id] = r.error;
      }
      setRowErrors(nextErrors);
      setTemps((m) => {
        const next = { ...m };
        for (const id of succeeded) delete next[id];
        return next;
      });
      setComments((m) => {
        const next = { ...m };
        for (const id of succeeded) delete next[id];
        return next;
      });
      setSavedCount(succeeded.length - queued);
      setQueuedCount(queued);
      if (Object.keys(nextErrors).length > 0) {
        setFormError("Certaines lignes n'ont pas pu être enregistrées — vérifiez les valeurs en rouge.");
      } else if (queued > 0) {
        setFormError(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {coldElements.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                viewMode === "list"
                  ? "bg-copper-700 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <List className="h-4 w-4" aria-hidden />
              Vue liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode("plan")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                viewMode === "plan"
                  ? "bg-copper-700 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Vue plan
            </button>
          </div>
          <Link
            href="/hygiene/cuisine-plan"
            className="text-sm font-semibold text-copper-700 transition hover:text-copper-600"
          >
            Configurer le plan cuisine →
          </Link>
        </div>
      ) : null}

      {coldElements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-stone-800">Aucun équipement froid actif</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            Ajoutez une chambre froide, un frigo ou un congélateur dans{" "}
            <Link href="/hygiene/elements" className="font-medium text-copper-800 underline">
              Éléments à nettoyer
            </Link>{" "}
            en choisissant la catégorie correspondante.
          </p>
        </div>
      ) : viewMode === "plan" ? (
        <KitchenTemperaturePlanView
          restaurantId={restaurantId}
          coldElements={coldElements}
          serverStoredDocument={kitchenPlanDocument}
          todayRecordedByElement={todayRecordedByElement}
          eventKind={eventKind}
          onEventKindChange={setEventKind}
          initials={initials}
          onInitialsChange={setInitials}
          onReadingSaved={() => router.refresh()}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-stone-100 bg-stone-50/50 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
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
                      onClick={() => setEventKind(k)}
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
              <label className={uiLabel} htmlFor="cold-initials">
                Initiales (optionnel)
              </label>
              <input
                id="cold-initials"
                type="text"
                autoComplete="off"
                maxLength={16}
                className={`${uiInput} mt-1 w-full`}
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="ex. J.D."
              />
            </div>
          </div>

          <ul className="divide-y divide-stone-100">
            {coldElements.map((el) => {
              const meta = coldMeta(el.category);
              const Icon = meta.Icon;
              const rowError = rowErrors[el.id];
              const hasTemp = (temps[el.id] ?? "").trim() !== "";
              const todayRecorded = todayRecordedByElement[el.id];
              const queued = queuedByElement[el.id];
              return (
                <li key={el.id} className={`px-4 py-3 ${rowError ? "bg-rose-50/40" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900">{el.name}</p>
                      <p className="truncate text-xs text-stone-400">
                        {el.area_label ||
                          HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR]}
                        {todayRecorded != null ? (
                          <span className="ml-2 font-medium text-emerald-700">
                            · Relevé : {todayRecorded} °C
                          </span>
                        ) : queued ? (
                          <span className="ml-2 font-medium text-sky-700">
                            · {queued.temperatureCelsiusRaw} °C — en attente de sync
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Température ${el.name}`}
                        className={`${uiInput} h-11 w-24 text-center text-base tabular-nums ${rowError ? "border-rose-300" : ""}`}
                        value={temps[el.id] ?? ""}
                        onChange={(e) => setTemp(el.id, e.target.value)}
                        placeholder="°C"
                      />
                    </div>
                  </div>
                  {hasTemp ? (
                    <input
                      type="text"
                      autoComplete="off"
                      className={`${uiInput} mt-2 w-full text-sm`}
                      value={comments[el.id] ?? ""}
                      onChange={(e) => setComments((m) => ({ ...m, [el.id]: e.target.value }))}
                      placeholder="Note / anomalie (optionnel)"
                    />
                  ) : null}
                  {rowError ? <p className="mt-1 text-xs text-rose-700">{rowError}</p> : null}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 bg-white px-4 py-3">
            <button
              type="button"
              disabled={pending || filledIds.length === 0}
              className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}
              onClick={submitAll}
            >
              {pending
                ? "Enregistrement…"
                : `Enregistrer ${filledIds.length > 0 ? filledIds.length : ""} relevé${filledIds.length > 1 ? "s" : ""}`.trim()}
            </button>
            <span className="text-xs text-stone-500">Plage acceptée : -40 °C à +25 °C.</span>
            {savedCount > 0 && !formError ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" aria-hidden />
                {savedCount} relevé{savedCount > 1 ? "s" : ""} enregistré{savedCount > 1 ? "s" : ""}
              </span>
            ) : null}
            {queuedCount > 0 ? (
              <span className="text-sm font-medium text-sky-700">
                {queuedCount} relevé{queuedCount > 1 ? "s" : ""} enregistré{queuedCount > 1 ? "s" : ""} localement — sync
                au retour du réseau.
              </span>
            ) : null}
            {formError ? <span className="text-sm text-rose-700">{formError}</span> : null}
          </div>
        </div>
      )}

      {recentReadings.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-stone-900">Derniers relevés</h2>
            <Link
              href="/hygiene/registre-temperatures"
              className="inline-flex items-center gap-1 text-sm font-semibold text-copper-700 transition hover:text-copper-600"
            >
              Registre complet
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="space-y-2">
            {recentReadings.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    r.event_kind === "opening" ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {r.event_kind === "opening" ? (
                    <Sunrise className="h-3 w-3" aria-hidden />
                  ) : (
                    <Sunset className="h-3 w-3" aria-hidden />
                  )}
                  {HYGIENE_COLD_EVENT_LABEL_FR[r.event_kind]}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{r.element_name}</span>
                <span className="font-semibold tabular-nums text-stone-800">{r.temperature_celsius} °C</span>
                <span className="text-xs text-stone-400">{fmtDateTime(r.recorded_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
