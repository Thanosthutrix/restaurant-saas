import "server-only";

import type { PlatformCompany, PlatformCustomer, EmittedInvoiceLineInput } from "@/lib/platform/emittedInvoicesDb";
import { parsePlatformAddress, sirenFromSiret } from "@/lib/platform/parsePlatformAddress";

export type En16931Invoice = {
  number: string;
  issue_date: string;
  type_code: number;
  currency_code: string;
  process_control: {
    specification_identifier: string;
    business_process_type?: string;
  };
  seller: Record<string, unknown>;
  buyer: Record<string, unknown>;
  lines: Record<string, unknown>[];
  vat_break_down: Record<string, unknown>[];
  totals: Record<string, unknown>;
  payment_due_date?: string;
};

function dec(n: number): string {
  return n.toFixed(2);
}

function electronicAddressFromSiret(siret: string | null | undefined): { scheme: string; value: string } | null {
  const siren = sirenFromSiret(siret);
  if (!siren) return null;
  return { scheme: "0225", value: siren };
}

function buildParty(params: {
  name: string;
  address: string | null;
  vatNumber: string | null;
  siret: string | null;
  email: string | null;
  requireElectronicAddress: boolean;
}): Record<string, unknown> {
  const party: Record<string, unknown> = {
    name: params.name,
    postal_address: parsePlatformAddress(params.address),
  };

  if (params.vatNumber?.trim()) party.vat_identifier = params.vatNumber.trim();
  if (params.siret?.trim()) {
    party.legal_registration_identifier = { scheme: "0009", value: params.siret.replace(/\D/g, "") };
  }
  if (params.email?.trim()) {
    party.contact = { email_address: params.email.trim() };
  }

  const electronic = electronicAddressFromSiret(params.siret);
  if (electronic) {
    party.electronic_address = electronic;
  } else if (params.requireElectronicAddress) {
    throw new Error("Adresse électronique (SIRET/SIREN) requise pour l'émission PA.");
  }

  return party;
}

export function buildEn16931Invoice(params: {
  company: PlatformCompany;
  customer: PlatformCustomer;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  lines: EmittedInvoiceLineInput[];
}): En16931Invoice {
  if (!params.lines.length) throw new Error("Au moins une ligne de facture est requise.");

  const vatBuckets = new Map<number, { taxable: number; tax: number }>();
  const enLines = params.lines.map((line, index) => {
    const qty = line.quantity;
    const unitPrice = line.unitPrice;
    const net = line.lineTotal ?? qty * unitPrice;
    const rate = line.vatRate;
    const vatAmount = net * (rate / 100);
    const bucket = vatBuckets.get(rate) ?? { taxable: 0, tax: 0 };
    bucket.taxable += net;
    bucket.tax += vatAmount;
    vatBuckets.set(rate, bucket);

    return {
      identifier: String(index + 1),
      invoiced_quantity: dec(qty),
      invoiced_quantity_code: line.unit || "C62",
      net_amount: dec(net),
      price_details: { item_net_price: dec(unitPrice) },
      item_information: { name: line.label.trim() },
      vat_information: {
        invoiced_item_vat_category_code: rate === 0 ? "Z" : "S",
        invoiced_item_vat_rate: dec(rate),
      },
    };
  });

  let sumHt = 0;
  let sumVat = 0;
  for (const bucket of vatBuckets.values()) {
    sumHt += bucket.taxable;
    sumVat += bucket.tax;
  }
  const sumTtc = sumHt + sumVat;

  const vatBreakDown = [...vatBuckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, bucket]) => ({
      vat_category_code: rate === 0 ? "Z" : "S",
      vat_category_rate: dec(rate),
      vat_category_taxable_amount: dec(bucket.taxable),
      vat_category_tax_amount: dec(bucket.tax),
    }));

  const invoice: En16931Invoice = {
    number: params.invoiceNumber.trim(),
    issue_date: params.issueDate,
    type_code: 380,
    currency_code: "EUR",
    process_control: {
      specification_identifier: "urn:cen.eu:en16931:2017",
      business_process_type: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    },
    seller: buildParty({
      name: params.company.legal_name,
      address: params.company.address,
      vatNumber: params.company.vat_number,
      siret: params.company.siret,
      email: params.company.contact_email,
      requireElectronicAddress: true,
    }),
    buyer: buildParty({
      name: params.customer.name,
      address: params.customer.address,
      vatNumber: params.customer.vat_number,
      siret: params.customer.siret,
      email: params.customer.email,
      requireElectronicAddress: true,
    }),
    lines: enLines,
    vat_break_down: vatBreakDown,
    totals: {
      sum_invoice_lines_amount: dec(sumHt),
      total_without_vat: dec(sumHt),
      total_vat_amount: { amount: dec(sumVat), currency_code: "EUR" },
      total_with_vat: dec(sumTtc),
      amount_due_for_payment: dec(sumTtc),
    },
  };

  if (params.dueDate) invoice.payment_due_date = params.dueDate;
  return invoice;
}

export function totalsFromLines(lines: EmittedInvoiceLineInput[]): { amountHt: number; amountTtc: number } {
  let amountHt = 0;
  let amountTtc = 0;
  for (const line of lines) {
    const net = line.lineTotal ?? line.quantity * line.unitPrice;
    amountHt += net;
    amountTtc += net * (1 + line.vatRate / 100);
  }
  return {
    amountHt: Math.round(amountHt * 100) / 100,
    amountTtc: Math.round(amountTtc * 100) / 100,
  };
}
