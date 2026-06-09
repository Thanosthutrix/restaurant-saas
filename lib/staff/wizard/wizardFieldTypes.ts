/**
 * Modèle de provenance par champ — cœur de l'hydratation du wizard.
 * Chaque champ pré-rempli sait d'où il vient (db/computed/user/missing),
 * conserve sa valeur DB d'origine (diff + rétro-enregistrement) et porte
 * son flag de persistance.
 */

export type FieldSource =
  | "db" // valeur lue directement d'une colonne/table existante
  | "computed" // dérivée (calendrier férié, besoin prédictif, suggestion)
  | "user" // surchargée par l'utilisateur dans le wizard (override)
  | "missing"; // donnée OBLIGATOIRE absente → bloque l'étape

/** Destination d'écriture si l'utilisateur coche « mettre à jour définitivement ». */
export type FieldWriteTarget =
  | { kind: "restaurant.securityFloor" }
  | { kind: "restaurant.staffTargetsWeekly" }
  | { kind: "restaurant.peakBandsWeekly" }
  | { kind: "staff.role"; staffMemberId: string }
  | { kind: "staff.contractWeeklyHours"; staffMemberId: string }
  | { kind: "staff.maxDailyHours"; staffMemberId: string }
  | { kind: "staff.defaultShiftPattern"; staffMemberId: string }
  | { kind: "staff.restRule"; staffMemberId: string };

export interface HydratedField<T> {
  /** Valeur courante (éditable). */
  value: T | null;
  /** D'où vient la valeur courante. */
  source: FieldSource;
  /** Valeur d'origine en base (null = jamais en base). Sert au diff + rétro-save. */
  dbValue: T | null;
  /** Si true et value invalide/null → blocage du passage à l'étape suivante. */
  required: boolean;
  /** Case « mettre à jour définitivement dans la fiche / l'établissement ». */
  persistToDb: boolean;
  /** Où écrire si persistToDb === true. Absent = non rétro-enregistrable. */
  writeTarget?: FieldWriteTarget;
}

// ── Fabriques ────────────────────────────────────────────────────────────────

export function fieldFromDb<T>(
  value: T,
  writeTarget?: FieldWriteTarget,
  required = false
): HydratedField<T> {
  return { value, source: "db", dbValue: value, required, persistToDb: false, writeTarget };
}

export function fieldComputed<T>(value: T, writeTarget?: FieldWriteTarget): HydratedField<T> {
  return { value, source: "computed", dbValue: null, required: false, persistToDb: false, writeTarget };
}

export function fieldMissing<T>(writeTarget?: FieldWriteTarget): HydratedField<T> {
  return { value: null, source: "missing", dbValue: null, required: true, persistToDb: false, writeTarget };
}

// ── Mutations (pures, renvoient un nouvel objet) ──────────────────────────────

/** Applique une surcharge utilisateur. Si la valeur revient à la valeur DB, repasse en "db". */
export function overrideField<T>(field: HydratedField<T>, value: T): HydratedField<T> {
  const backToDb =
    field.dbValue != null && JSON.stringify(value) === JSON.stringify(field.dbValue);
  return {
    ...field,
    value,
    source: backToDb ? "db" : "user",
  };
}

export function setPersist<T>(field: HydratedField<T>, persistToDb: boolean): HydratedField<T> {
  return { ...field, persistToDb };
}

// ── Prédicats ─────────────────────────────────────────────────────────────────

function isEmpty<T>(value: T | null): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Vrai si l'utilisateur a surchargé la valeur DB d'origine. */
export function isFieldModified<T>(field: HydratedField<T>): boolean {
  if (field.source !== "user") return false;
  return JSON.stringify(field.value) !== JSON.stringify(field.dbValue);
}

/** Vrai si le champ bloque la progression (requis + vide). */
export function isFieldBlocking<T>(field: HydratedField<T>): boolean {
  return field.required && isEmpty(field.value);
}

/** Vrai si le champ doit afficher l'état "donnée manquante" (orange). */
export function isFieldMissing<T>(field: HydratedField<T>): boolean {
  return field.source === "missing" || (field.required && isEmpty(field.value));
}

/** Vrai si la valeur affichée provient du système (badge "synchronisé"). */
export function isFieldSynced<T>(field: HydratedField<T>): boolean {
  return (field.source === "db" || field.source === "computed") && !isEmpty(field.value);
}
