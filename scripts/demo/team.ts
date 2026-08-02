/**
 * Équipe du restaurant de démo : postes, contrats HCR et planning.
 *
 * Règle de cohérence tenue par ce module : les heures réellement planifiées
 * de chaque salarié collent à son contrat (± 1 h/semaine), aucun salarié ne
 * dépasse 11 h par jour ni 48 h par semaine (plafonds convention HCR), et
 * chaque service ouvert dispose d'une couverture minimale en cuisine et en salle.
 */

export type Station = "cuisine" | "salle" | "bar" | "plonge";

export type StaffDef = {
  displayName: string;
  firstName: string;
  lastName: string;
  roleLabel: string;
  appRole: "manager" | "service" | "cuisine" | "hygiene" | "achats" | "lecture_seule";
  station: Station;
  contractType: "cdi" | "cdd" | "extra";
  /** Heures contractuelles hebdomadaires. */
  weeklyHours: number;
  /** Taux horaire brut. */
  hourlyRate: number;
  /** Niveau et échelon de la grille HCR. */
  hcrLevel: string;
  contractStart: string;
  /** CDD uniquement. */
  contractEnd?: string;
  /** Motif du CDD (obligatoire au contrat). */
  cddReason?: string;
  birthDate: string;
  address: string;
  /** Jours de repos hebdomadaires (0 = dimanche). Le dimanche est fermé pour tous. */
  restDays: number[];
  /** Initiales utilisées pour signer les registres. */
  initials: string;
  colorIndex: number;
};

/** SMIC horaire brut 2026 retenu pour la démo. */
export const SMIC = 11.88;

/**
 * Jours d'ouverture (mardi → samedi). Comme beaucoup de brasseries parisiennes,
 * la maison ferme dimanche et lundi : cela donne à toute l'équipe deux jours de
 * repos consécutifs et permet de couvrir chaque service avec l'effectif en place.
 */
export const OPEN_DAYS = [2, 3, 4, 5, 6];

export const STAFF: StaffDef[] = [
  {
    displayName: "Antoine Leroy", firstName: "Antoine", lastName: "Leroy",
    roleLabel: "Chef de cuisine", appRole: "manager", station: "cuisine",
    contractType: "cdi", weeklyHours: 39, hourlyRate: 16.8, hcrLevel: "Niveau IV — Échelon 1",
    contractStart: "2023-03-06", birthDate: "1986-04-12", address: "18 rue Oberkampf, 75011 Paris",
    restDays: [0, 1], initials: "AL", colorIndex: 0,
  },
  {
    displayName: "Marie Dupont", firstName: "Marie", lastName: "Dupont",
    roleLabel: "Second de cuisine", appRole: "cuisine", station: "cuisine",
    contractType: "cdi", weeklyHours: 39, hourlyRate: 14.2, hcrLevel: "Niveau III — Échelon 2",
    contractStart: "2024-01-08", birthDate: "1993-09-27", address: "7 avenue de la République, 75011 Paris",
    restDays: [0, 1], initials: "MD", colorIndex: 1,
  },
  {
    displayName: "Karim Benali", firstName: "Karim", lastName: "Benali",
    roleLabel: "Commis de cuisine", appRole: "cuisine", station: "cuisine",
    contractType: "cdd", weeklyHours: 35, hourlyRate: 12.1, hcrLevel: "Niveau I — Échelon 2",
    contractStart: "2026-04-01", contractEnd: "2026-10-31",
    cddReason: "Accroissement temporaire d'activité — saison estivale",
    birthDate: "2001-02-19", address: "22 rue des Panoyaux, 75020 Paris",
    restDays: [0, 1], initials: "KB", colorIndex: 2,
  },
  {
    displayName: "Nina Costa", firstName: "Nina", lastName: "Costa",
    roleLabel: "Plonge / polyvalente", appRole: "hygiene", station: "plonge",
    contractType: "cdi", weeklyHours: 30, hourlyRate: SMIC, hcrLevel: "Niveau I — Échelon 1",
    contractStart: "2024-09-02", birthDate: "1990-05-15", address: "5 rue Bichat, 75010 Paris",
    restDays: [0, 1], initials: "NC", colorIndex: 3,
  },
  {
    displayName: "Sophie Martin", firstName: "Sophie", lastName: "Martin",
    roleLabel: "Responsable de salle", appRole: "manager", station: "salle",
    contractType: "cdi", weeklyHours: 39, hourlyRate: 15.2, hcrLevel: "Niveau III — Échelon 3",
    contractStart: "2023-06-19", birthDate: "1989-11-03", address: "34 rue du Faubourg-du-Temple, 75011 Paris",
    restDays: [0, 1], initials: "SM", colorIndex: 4,
  },
  {
    displayName: "Lucas Petit", firstName: "Lucas", lastName: "Petit",
    roleLabel: "Serveur", appRole: "service", station: "salle",
    contractType: "cdi", weeklyHours: 35, hourlyRate: 12.6, hcrLevel: "Niveau II — Échelon 1",
    contractStart: "2025-02-03", birthDate: "1998-07-21", address: "11 rue Saint-Maur, 75011 Paris",
    restDays: [0, 1], initials: "LP", colorIndex: 5,
  },
  {
    displayName: "Paul Durand", firstName: "Paul", lastName: "Durand",
    roleLabel: "Barman", appRole: "service", station: "bar",
    contractType: "cdi", weeklyHours: 35, hourlyRate: 13.4, hcrLevel: "Niveau II — Échelon 2",
    contractStart: "2024-05-13", birthDate: "1995-12-08", address: "3 passage Charles-Dallery, 75011 Paris",
    restDays: [0, 1], initials: "PD", colorIndex: 6,
  },
  {
    displayName: "Emma Rousseau", firstName: "Emma", lastName: "Rousseau",
    roleLabel: "Serveuse (extra)", appRole: "service", station: "salle",
    contractType: "extra", weeklyHours: 20, hourlyRate: 12.0, hcrLevel: "Niveau I — Échelon 3",
    contractStart: "2026-05-04", birthDate: "2003-03-30", address: "9 rue de la Roquette, 75011 Paris",
    restDays: [0, 1, 2, 3], initials: "ER", colorIndex: 7,
  },
];

// ---------------------------------------------------------------------------
// CRÉNEAUX
// ---------------------------------------------------------------------------

export type SlotKind = "lunch" | "dinner";

export type SlotTemplate = {
  /** Heure murale Paris, format HH:MM. */
  start: string;
  end: string;
  breakMinutes: number;
};

/** Créneaux par poste. La cuisine arrive plus tôt (mise en place) et part après le nettoyage. */
const SLOTS: Record<Station, Record<SlotKind, SlotTemplate>> = {
  cuisine: {
    lunch: { start: "09:30", end: "15:00", breakMinutes: 30 },
    dinner: { start: "17:30", end: "23:30", breakMinutes: 30 },
  },
  salle: {
    lunch: { start: "11:00", end: "15:00", breakMinutes: 0 },
    dinner: { start: "18:00", end: "23:30", breakMinutes: 30 },
  },
  bar: {
    lunch: { start: "11:00", end: "15:00", breakMinutes: 0 },
    dinner: { start: "17:45", end: "23:45", breakMinutes: 30 },
  },
  plonge: {
    lunch: { start: "11:30", end: "15:00", breakMinutes: 0 },
    dinner: { start: "18:30", end: "23:45", breakMinutes: 15 },
  },
};

export function slotTemplate(station: Station, kind: SlotKind): SlotTemplate {
  return SLOTS[station][kind];
}

function slotHours(station: Station, kind: SlotKind): number {
  const s = SLOTS[station][kind];
  return (toMinutes(s.end) - toMinutes(s.start) - s.breakMinutes) / 60;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// GÉNÉRATION DU PLANNING
// ---------------------------------------------------------------------------

export type PlannedShift = {
  staffIndex: number;
  /** Date civile Paris (AAAA-MM-JJ). */
  date: string;
  kind: SlotKind;
  start: string;
  end: string;
  breakMinutes: number;
  hours: number;
};

/**
 * Effectif requis par service. Dimensionné pour que la somme des besoins
 * corresponde aux heures contractuelles disponibles sur chaque poste :
 * cuisine 110,5 h pour 113 h dues, salle 95 h pour 94 h, bar 35,5 h pour 35 h,
 * plonge 29,75 h pour 30 h.
 */
/** Charge relative d'un service, utilisée pour l'ordre d'affectation et le volume de couverts. */
export function serviceLoad(dow: number, kind: SlotKind): number {
  const dayWeight: Record<number, number> = { 2: 0, 3: 1, 4: 2, 5: 4, 6: 5 };
  return (kind === "dinner" ? 6 : 0) + (dayWeight[dow] ?? 0);
}

function staffingNeed(dow: number, kind: SlotKind): Record<Station, number> {
  const busyLunch = dow === 5 || dow === 6; // vendredi et samedi midi
  return {
    cuisine: 2,
    salle: 2,
    bar: kind === "dinner" || busyLunch ? 1 : 0,
    plonge: kind === "dinner" || dow === 6 ? 1 : 0,
  };
}

/** Renfort du samedi soir, le service le plus chargé de la semaine. */
function staffingReinforcement(dow: number, kind: SlotKind): Record<Station, number> {
  const saturdayDinner = dow === 6 && kind === "dinner";
  return {
    cuisine: saturdayDinner ? 1 : 0,
    salle: saturdayDinner ? 1 : 0,
    bar: 0,
    plonge: 0,
  };
}

/**
 * Construit le planning d'une semaine en partant des besoins de chaque service,
 * puis en désignant à chaque poste le salarié le plus « en retard » sur ses
 * heures contractuelles. On ajuste ensuite les horaires pour coller au contrat.
 */
export function buildWeekShifts(weekDates: string[]): PlannedShift[] {
  const assigned: { staffIndex: number; date: string; kind: SlotKind }[] = [];
  const hoursDone = STAFF.map(() => 0);
  const dayHours = STAFF.map(() => new Map<string, number>());

  const services: { date: string; dow: number; kind: SlotKind }[] = [];
  for (const date of weekDates) {
    const dow = dayOfWeek(date);
    if (!OPEN_DAYS.includes(dow)) continue;
    for (const kind of ["lunch", "dinner"] as SlotKind[]) services.push({ date, dow, kind });
  }

  function fillPost(svc: { date: string; dow: number; kind: SlotKind }, station: Station): void {
    // Candidats : bon poste, pas en repos, pas déjà sur ce service, sous les plafonds.
    const eligible = STAFF.map((s, i) => ({ s, i }))
      .filter(({ s, i }) => {
        if (s.station !== station) return false;
        if (s.restDays.includes(svc.dow)) return false;
        if (assigned.some((a) => a.staffIndex === i && a.date === svc.date && a.kind === svc.kind)) return false;
        const h = slotHours(station, svc.kind);
        if ((dayHours[i].get(svc.date) ?? 0) + h > 11) return false;
        if (hoursDone[i] + h > s.weeklyHours + 1) return false;
        return true;
      })
      // Priorité au salarié dont il reste le plus d'heures à pourvoir, en part de son contrat.
      .sort((a, b) => {
        const ra = (a.s.weeklyHours - hoursDone[a.i]) / a.s.weeklyHours;
        const rb = (b.s.weeklyHours - hoursDone[b.i]) / b.s.weeklyHours;
        return rb - ra;
      });

    const pick = eligible[0];
    if (!pick) return; // poste non pourvu : remonté par checkCoverage
    const h = slotHours(station, svc.kind);
    assigned.push({ staffIndex: pick.i, date: svc.date, kind: svc.kind });
    hoursDone[pick.i] += h;
    dayHours[pick.i].set(svc.date, (dayHours[pick.i].get(svc.date) ?? 0) + h);
  }

  const STATIONS: Station[] = ["cuisine", "salle", "bar", "plonge"];

  const byLoad = [...services].sort(
    (a, b) => serviceLoad(b.dow, b.kind) - serviceLoad(a.dow, a.kind)
  );

  // Passe 1 — socle : chaque service ouvert reçoit son effectif minimum. On commence
  // par les services les plus chargés, sinon le samedi soir se retrouve servi en
  // dernier avec des quotas déjà consommés. Le socle (105 h en cuisine, 90 h en salle)
  // reste inférieur aux heures contractuelles disponibles : les services calmes de
  // début de semaine sont donc pourvus eux aussi.
  for (const svc of byLoad) {
    const need = staffingNeed(svc.dow, svc.kind);
    for (const station of STATIONS) {
      for (let n = 0; n < need[station]; n++) fillPost(svc, station);
    }
  }

  // Passe 2 — renforts, en commençant par le service le plus chargé.
  for (const svc of byLoad) {
    const extra = staffingReinforcement(svc.dow, svc.kind);
    for (const station of STATIONS) {
      for (let n = 0; n < extra[station]; n++) fillPost(svc, station);
    }
  }

  // Mise en forme + ajustement final sur les heures contractuelles.
  const out: PlannedShift[] = [];
  STAFF.forEach((staff, staffIndex) => {
    const mine = assigned
      .filter((a) => a.staffIndex === staffIndex)
      .sort((a, b) => (a.date === b.date ? (a.kind === "lunch" ? -1 : 1) : a.date < b.date ? -1 : 1));

    let remainder = staff.weeklyHours - hoursDone[staffIndex];

    // Le reliquat est étalé sur l'ensemble des créneaux, par tranches de 15 min et
    // au plus 30 min par service : une mise en place un peu plus longue reste crédible,
    // une prise de poste trois heures avant l'ouverture ne l'est pas.
    const MAX_ADJUST_MIN = 30;

    for (const a of mine) {
      const tpl = SLOTS[staff.station][a.kind];
      let start = tpl.start;
      let end = tpl.end;

      if (remainder >= 0.25) {
        const dayTotal = dayHours[staffIndex].get(a.date) ?? 0;
        const room = Math.min(remainder, 11 - dayTotal, MAX_ADJUST_MIN / 60);
        const extraMin = Math.floor((room * 60) / 15) * 15;
        if (extraMin > 0) {
          start = fromMinutes(toMinutes(tpl.start) - extraMin);
          dayHours[staffIndex].set(a.date, dayTotal + extraMin / 60);
          remainder -= extraMin / 60;
        }
      } else if (remainder <= -0.25) {
        // Départ anticipé pour ne pas dépasser le contrat.
        const cutMin = Math.min(Math.floor((-remainder * 60) / 15) * 15, MAX_ADJUST_MIN);
        if (cutMin > 0) {
          end = fromMinutes(toMinutes(tpl.end) - cutMin);
          remainder += cutMin / 60;
        }
      }

      out.push({
        staffIndex, date: a.date, kind: a.kind,
        start, end, breakMinutes: tpl.breakMinutes,
        hours: (toMinutes(end) - toMinutes(start) - tpl.breakMinutes) / 60,
      });
    }
  });

  return out;
}

export function dayOfWeek(dateYmd: string): number {
  return new Date(`${dateYmd}T12:00:00.000Z`).getUTCDay();
}

/**
 * Contrôle de couverture : chaque service ouvert doit avoir au moins
 * 2 personnes en cuisine et 2 en salle (bar compris).
 */
export function checkCoverage(shifts: PlannedShift[], weekDates: string[]): string[] {
  const problems: string[] = [];
  for (const date of weekDates) {
    if (!OPEN_DAYS.includes(dayOfWeek(date))) continue;
    for (const kind of ["lunch", "dinner"] as SlotKind[]) {
      const onDuty = shifts.filter((s) => s.date === date && s.kind === kind);
      const kitchen = onDuty.filter((s) => STAFF[s.staffIndex].station === "cuisine").length;
      const floor = onDuty.filter((s) => ["salle", "bar"].includes(STAFF[s.staffIndex].station)).length;
      if (kitchen < 2) problems.push(`${date} ${kind} : ${kitchen} en cuisine`);
      if (floor < 2) problems.push(`${date} ${kind} : ${floor} en salle`);
    }
  }
  return problems;
}
