"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Download, FileWarning, Plus } from "lucide-react";
import {
  uiBadgeEmerald,
  uiBadgeSlate,
  uiBtnPrimary,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInfoBanner,
  uiInput,
  uiListRow,
  uiMuted,
  uiSectionTitleSm,
  uiWarn,
} from "@/components/ui/premium";
import {
  ARRET_MOTIF_OPTIONS,
  FIN_CONTRAT_MOTIF_OPTIONS,
  motifLabelForKind,
  REPRISE_MOTIF_OPTIONS,
} from "@/lib/rh/dsn/dsnSignalementMotifs";
import {
  DSN_SIGNALEMENT_KIND_LABELS,
  type DsnSignalementKind,
  type DsnSignalementRow,
} from "@/lib/rh/dsn/dsnSignalementTypes";
import { createDsnSignalementAction, exportDsnSignalementAction } from "./actions";

type StaffOption = { id: string; displayName: string; active: boolean };

type Props = {
  restaurantId: string;
  signalements: DsnSignalementRow[];
  staffOptions: StaffOption[];
  hasEmployerSiret: boolean;
};

function downloadBase64(filename: string, contentBase64: string) {
  const bytes = Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function daysSince(ymd: string): number {
  const start = new Date(ymd + "T12:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineWarning(row: DsnSignalementRow): string | null {
  if (row.status === "exported") return null;
  const days = daysSince(row.eventDate);
  if (days > 5) return `Délai légal dépassé (${days} jours) — transmettez d'urgence.`;
  if (days >= 4) return `Dernier jour pour transmettre (délai 5 jours ouvrés).`;
  return null;
}

const KIND_OPTIONS: { value: DsnSignalementKind; label: string }[] = [
  { value: "arret_travail", label: DSN_SIGNALEMENT_KIND_LABELS.arret_travail },
  { value: "reprise_arret", label: DSN_SIGNALEMENT_KIND_LABELS.reprise_arret },
  { value: "fin_contrat", label: DSN_SIGNALEMENT_KIND_LABELS.fin_contrat },
];

export function DsnSignalementsClient({
  restaurantId,
  signalements,
  staffOptions,
  hasEmployerSiret,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [kind, setKind] = useState<DsnSignalementKind>("arret_travail");
  const [staffMemberId, setStaffMemberId] = useState(staffOptions[0]?.id ?? "");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastWorkedDay, setLastWorkedDay] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [motifCode, setMotifCode] = useState<string>(ARRET_MOTIF_OPTIONS[0].code);
  const [subrogation, setSubrogation] = useState(false);
  const [notes, setNotes] = useState("");

  const motifOptions = useMemo(() => {
    if (kind === "arret_travail") return ARRET_MOTIF_OPTIONS;
    if (kind === "reprise_arret") return REPRISE_MOTIF_OPTIONS;
    return FIN_CONTRAT_MOTIF_OPTIONS;
  }, [kind]);

  function resetMotifForKind(nextKind: DsnSignalementKind) {
    const list =
      nextKind === "arret_travail"
        ? ARRET_MOTIF_OPTIONS
        : nextKind === "reprise_arret"
          ? REPRISE_MOTIF_OPTIONS
          : FIN_CONTRAT_MOTIF_OPTIONS;
    setMotifCode(list[0].code);
  }

  function handleCreate() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createDsnSignalementAction({
        restaurantId,
        staffMemberId,
        kind,
        eventDate,
        lastWorkedDay: lastWorkedDay || null,
        expectedEndDate: expectedEndDate || null,
        returnDate: returnDate || null,
        contractEndDate: contractEndDate || null,
        motifCode,
        subrogation,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess("Signalement enregistré — générez le fichier DSN.");
      setShowForm(false);
      router.refresh();
    });
  }

  function handleExport(signalementId: string, mode: "test" | "real") {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await exportDsnSignalementAction({ restaurantId, signalementId, mode });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      downloadBase64(res.data!.filename, res.data!.contentBase64);
      if (res.data!.warnings.length > 0) {
        setSuccess(`Fichier généré (${res.data!.lineCount} lignes) — voir avertissements.`);
      } else {
        setSuccess(`Fichier ${mode === "test" ? "test" : "réel"} téléchargé.`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className={uiInfoBanner}>
        <strong>Signalements DSN événementiels</strong> — Arrêt maladie (nature 04), reprise anticipée
        (05) et fin de contrat unique / FCTU (07). Délai légal : <strong>5 jours ouvrés</strong> après
        prise de connaissance.
      </div>

      {!hasEmployerSiret && (
        <div className={uiError}>
          Complétez le SIRET dans Administratif avant de créer un signalement.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${uiBtnPrimary} inline-flex items-center gap-2`}
          onClick={() => setShowForm((v) => !v)}
          disabled={!hasEmployerSiret || staffOptions.length === 0}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouveau signalement
        </button>
      </div>

      {showForm && (
        <div className={`${uiCard} space-y-4`}>
          <p className={uiSectionTitleSm}>Créer un signalement</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={uiMuted}>Type</label>
              <select
                className={`${uiInput} mt-1 w-full`}
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as DsnSignalementKind;
                  setKind(next);
                  resetMotifForKind(next);
                }}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={uiMuted}>Salarié</label>
              <select
                className={`${uiInput} mt-1 w-full`}
                value={staffMemberId}
                onChange={(e) => setStaffMemberId(e.target.value)}
              >
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                    {!s.active ? " (inactif)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={uiMuted}>Date de prise de connaissance</label>
              <input
                type="date"
                className={`${uiInput} mt-1 w-full`}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <label className={uiMuted}>Motif</label>
              <select
                className={`${uiInput} mt-1 w-full`}
                value={motifCode}
                onChange={(e) => setMotifCode(e.target.value)}
              >
                {motifOptions.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} — {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(kind === "arret_travail" || kind === "reprise_arret") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={uiMuted}>Dernier jour travaillé</label>
                <input
                  type="date"
                  className={`${uiInput} mt-1 w-full`}
                  value={lastWorkedDay}
                  onChange={(e) => setLastWorkedDay(e.target.value)}
                />
              </div>
              {kind === "arret_travail" && (
                <>
                  <div>
                    <label className={uiMuted}>Fin prévisionnelle (optionnel)</label>
                    <input
                      type="date"
                      className={`${uiInput} mt-1 w-full`}
                      value={expectedEndDate}
                      onChange={(e) => setExpectedEndDate(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={subrogation}
                      onChange={(e) => setSubrogation(e.target.checked)}
                    />
                    Subrogation (maintien de salaire par l&apos;employeur)
                  </label>
                </>
              )}
              {kind === "reprise_arret" && (
                <div>
                  <label className={uiMuted}>Date de reprise</label>
                  <input
                    type="date"
                    className={`${uiInput} mt-1 w-full`}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {kind === "fin_contrat" && (
            <div>
              <label className={uiMuted}>Date de fin de contrat</label>
              <input
                type="date"
                className={`${uiInput} mt-1 w-full max-w-xs`}
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className={uiMuted}>Notes internes (optionnel)</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. arrêt transmis par le salarié le…"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={uiBtnPrimary}
              onClick={handleCreate}
              disabled={pending || !staffMemberId}
            >
              Enregistrer
            </button>
            <button type="button" className={uiBtnSecondary} onClick={() => setShowForm(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <div className={uiError}>{error}</div>}
      {success && <div className={uiBadgeEmerald + " block px-3 py-2 text-sm"}>{success}</div>}

      {signalements.length === 0 ? (
        <div className={`${uiCard} text-center`}>
          <FileWarning className="mx-auto h-10 w-10 text-stone-300" aria-hidden />
          <p className="mt-2 text-sm text-stone-600">Aucun signalement DSN pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signalements.map((row) => {
            const warn = deadlineWarning(row);
            const emp = row.employeeSnapshot;
            return (
              <div key={row.id} className={uiListRow}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">
                    {DSN_SIGNALEMENT_KIND_LABELS[row.kind]} — {emp.displayName}
                  </p>
                  <p className={uiMuted}>
                    {motifLabelForKind(row.kind, row.motifCode)} · prise de connaissance{" "}
                    {formatYmd(row.eventDate)}
                    {row.lastWorkedDay ? ` · dernier jour ${formatYmd(row.lastWorkedDay)}` : ""}
                    {row.contractEndDate ? ` · fin ${formatYmd(row.contractEndDate)}` : ""}
                    {row.returnDate ? ` · reprise ${formatYmd(row.returnDate)}` : ""}
                  </p>
                  {warn && (
                    <p className={`${uiWarn} mt-1 inline-flex items-center gap-1 text-xs`}>
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      {warn}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <span
                    className={
                      row.status === "exported"
                        ? uiBadgeEmerald
                        : uiBadgeSlate + " bg-amber-100 text-amber-800"
                    }
                  >
                    {row.status === "exported" ? "Exporté" : "Brouillon"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={`${uiBtnSecondary} inline-flex items-center gap-1 text-xs`}
                      onClick={() => handleExport(row.id, "test")}
                      disabled={pending}
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      Test
                    </button>
                    <button
                      type="button"
                      className={`${uiBtnPrimary} inline-flex items-center gap-1 text-xs`}
                      onClick={() => handleExport(row.id, "real")}
                      disabled={pending}
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      Réel
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
