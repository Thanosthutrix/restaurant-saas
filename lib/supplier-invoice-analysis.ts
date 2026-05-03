/**
 * Structure attendue de supplier_invoices.analysis_result_json (V1).
 * Compatible avec un futur remplissage par OCR / IA (même forme).
 */

export type SupplierInvoiceAnalysisLine = {
  label: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
};

/** Infos vendeur lues sur la facture (émetteur), pour préremplir la fiche fournisseur. */
export type SupplierInvoiceVendorHint = {
  legal_name: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  siret: string | null;
};

export type SupplierInvoiceAnalysisView = {
  invoice_number: string | null;
  invoice_date: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  /** Fournisseur émetteur (champ optionnel selon version d’analyse). */
  vendor: SupplierInvoiceVendorHint | null;
  lines: SupplierInvoiceAnalysisLine[];
  raw_text: string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function parseLine(raw: unknown): SupplierInvoiceAnalysisLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label =
    str(o.label) ??
    str(o.libelle) ??
    str(o.description) ??
    str(o.name) ??
    "—";
  return {
    label,
    quantity: num(o.quantity ?? o.qty ?? o.quantite),
    unit: str(o.unit ?? o.unite) ?? null,
    unit_price: num(o.unit_price ?? o.prix_unitaire ?? o.unitPrice),
    line_total: num(o.line_total ?? o.total ?? o.total_line ?? o.montant_ligne),
  };
}

/**
 * Lit analysis_result_json et produit une vue stable pour l’UI et le préremplissage.
 */
export function parseSupplierInvoiceAnalysis(json: unknown): SupplierInvoiceAnalysisView | null {
  if (json == null) return null;
  let obj: Record<string, unknown>;
  if (typeof json === "string") {
    try {
      obj = JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof json === "object") {
    obj = json as Record<string, unknown>;
  } else {
    return null;
  }

  const header = (obj.header && typeof obj.header === "object" ? obj.header : obj) as Record<string, unknown>;

  const amount_ht =
    num(header.amount_ht) ??
    num(header.total_ht) ??
    num(header.amountHT) ??
    num(obj.amount_ht) ??
    num(obj.total_ht);

  const amount_ttc =
    num(header.amount_ttc) ??
    num(header.total_ttc) ??
    num(header.amountTTC) ??
    num(obj.amount_ttc) ??
    num(obj.total_ttc);

  const rawLines = (Array.isArray(obj.lines) ? obj.lines : null) ?? (Array.isArray(obj.items) ? obj.items : []) ?? [];

  const lines: SupplierInvoiceAnalysisLine[] = [];
  for (const row of rawLines) {
    const line = parseLine(row);
    if (line) lines.push(line);
  }

  const vendor = parseVendorBlock(obj);

  return {
    invoice_number:
      str(header.invoice_number) ?? str(header.number) ?? str(obj.invoice_number) ?? str(obj.number) ?? null,
    invoice_date:
      normalizeDate(header.invoice_date) ??
      normalizeDate(header.date) ??
      normalizeDate(obj.invoice_date) ??
      normalizeDate(obj.date) ??
      null,
    amount_ht,
    amount_ttc,
    vendor,
    lines,
    raw_text: str(obj.raw_text) ?? str(obj.rawText) ?? str(obj.raw) ?? null,
  };
}

function parseVendorBlock(obj: Record<string, unknown>): SupplierInvoiceVendorHint | null {
  const header = obj.header && typeof obj.header === "object" ? (obj.header as Record<string, unknown>) : null;
  const raw =
    obj.vendor ??
    obj.supplier ??
    obj.emitter ??
    header?.vendor ??
    header?.supplier ??
    null;
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const legal_name =
    str(v.legal_name) ??
    str(v.company_name) ??
    str(v.name) ??
    str(v.raison_sociale) ??
    null;
  const address = str(v.address) ?? str(v.adresse) ?? null;
  const email = str(v.email) ?? null;
  const phone = str(v.phone) ?? str(v.telephone) ?? str(v.tel) ?? null;
  const vat_number =
    str(v.vat_number) ?? str(v.vat) ?? str(v.numero_tva) ?? str(v.tva_intracommunautaire) ?? null;
  const siret = str(v.siret) ?? str(v.siren) ?? null;
  if (!legal_name && !address && !email && !phone && !vat_number && !siret) return null;
  return {
    legal_name,
    address,
    email,
    phone,
    vat_number,
    siret,
  };
}

function isDbStringEmpty(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === "";
}

/**
 * Champs à écrire en base uniquement là où la facture n’a pas encore de valeur saisie.
 */
export function buildMetadataPatchFromAnalysis(
  current: {
    invoice_number: string | null;
    invoice_date: string | null;
    amount_ht: number | null;
    amount_ttc: number | null;
  },
  extracted: SupplierInvoiceAnalysisView
): { invoice_number?: string; invoice_date?: string; amount_ht?: number; amount_ttc?: number } | null {
  const patch: {
    invoice_number?: string;
    invoice_date?: string;
    amount_ht?: number;
    amount_ttc?: number;
  } = {};

  if (isDbStringEmpty(current.invoice_number) && extracted.invoice_number) {
    patch.invoice_number = extracted.invoice_number.trim();
  }
  if (isDbStringEmpty(current.invoice_date) && extracted.invoice_date) {
    patch.invoice_date = extracted.invoice_date;
  }
  if (current.amount_ht == null && extracted.amount_ht != null) {
    patch.amount_ht = extracted.amount_ht;
  }
  if (current.amount_ttc == null && extracted.amount_ttc != null) {
    patch.amount_ttc = extracted.amount_ttc;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}
