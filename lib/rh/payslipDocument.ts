import { formatPeriodMonthLabel, monthStartYmd } from "./payslipMonth";
import { PMSS_2026, PAYROLL_ENGINE_VERSION } from "./payrollEngine/constants2026";
import type { PayslipLineRow, PayslipPeriodBundle, PayslipRow } from "./payslipTypes";
import { PAYSLIP_LEGAL_NOTICE } from "./payslipTypes";

function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0);
  return last.toLocaleDateString("fr-FR");
}

function sectionTitle(section: PayslipLineRow["section"]): string {
  switch (section) {
    case "earning":
      return "Éléments de rémunération";
    case "employee_contrib":
      return "Cotisations salariales";
    case "employer_contrib":
      return "Cotisations patronales";
    case "deduction":
      return "Retenues";
    default:
      return "";
  }
}

function renderLinesTable(lines: PayslipLineRow[]): string {
  const sections = ["earning", "employee_contrib", "deduction", "employer_contrib"] as const;
  let html = "";

  for (const section of sections) {
    const sectionLines = lines.filter((l) => l.section === section && l.code !== "legal_notice");
    if (sectionLines.length === 0) continue;
    html += `<h3>${sectionTitle(section)}</h3><table><thead><tr><th>Libellé</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead><tbody>`;
    for (const line of sectionLines) {
      const amountClass = line.amount < 0 ? "neg" : "";
      html += `<tr>
        <td>${line.label}</td>
        <td class="num">${line.baseAmount != null ? eur(line.baseAmount) : "—"}</td>
        <td class="num">${line.rate != null ? `${line.rate.toFixed(2)} %` : "—"}</td>
        <td class="num ${amountClass}">${eur(line.amount)}</td>
      </tr>`;
    }
    html += "</tbody></table>";
  }
  return html;
}

export function buildPayslipPrintDocument(
  bundle: PayslipPeriodBundle,
  payslip: PayslipRow
): { title: string; html: string } {
  const periodLabel = formatPeriodMonthLabel(bundle.period.periodMonth);
  const emp = payslip.employeeSnapshot;
  const employer = payslip.employerSnapshot;
  const pay = payslip.paySnapshot;
  const lines = bundle.linesByPayslip[payslip.id] ?? [];
  const hourLines = bundle.hourLinesByPayslip[payslip.id] ?? [];
  const paymentDate = lastDayOfMonth(bundle.period.periodMonth);

  const title = `Bulletin de paie — ${emp.displayName} — ${periodLabel}`;

  const hoursRows = hourLines
    .map(
      (h) =>
        `<tr><td>${h.day}</td><td>${h.label}</td><td class="num">${h.plannedHours.toFixed(2)}</td><td class="num">${h.attendanceHours != null ? h.attendanceHours.toFixed(2) : "—"}</td><td class="num"><strong>${h.validatedHours.toFixed(2)}</strong></td></tr>`
    )
    .join("");

  const html = `
<article class="payslip">
  <header>
    <p class="eyebrow">Bulletin de salaire</p>
    <h1>${employer.legalName || "Employeur"}</h1>
    <p class="meta">SIRET ${employer.siret || "—"}${employer.apeCode ? ` · APE ${employer.apeCode}` : ""}</p>
    <p class="meta">${employer.address || ""}</p>
    <p class="meta">URSSAF : ${employer.urssafOffice || "—"}</p>
    <p class="meta">Convention collective IDCC ${employer.collectiveAgreementIdcc || "—"} (HCR)</p>
    ${employer.healthProvider ? `<p class="meta">Organisme complémentaire santé : ${employer.healthProvider}</p>` : ""}
  </header>

  <section class="grid-2">
    <div>
      <h2>Salarié</h2>
      <p><strong>${emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.displayName}</strong></p>
      ${emp.jobTitle ? `<p>Emploi : ${emp.jobTitle}</p>` : ""}
      ${emp.socialSecurityNumber ? `<p>N° sécurité sociale : ${emp.socialSecurityNumber}</p>` : ""}
      ${emp.contractType ? `<p>Nature du contrat : ${emp.contractType.toUpperCase()}</p>` : ""}
      ${emp.targetWeeklyHours != null ? `<p>Durée collective : ${emp.targetWeeklyHours} h / semaine</p>` : ""}
    </div>
    <div>
      <h2>Période de paie</h2>
      <p><strong>Du ${monthStartYmd(bundle.period.periodMonth).split("-").reverse().join("/")} au ${paymentDate}</strong></p>
      <p>Date de paiement : ${paymentDate}</p>
      <p>Heures payées : ${payslip.hoursValidated != null ? payslip.hoursValidated.toFixed(2) : "—"} h</p>
      <p>Taux horaire brut : ${payslip.hourlyGrossRate != null ? eur(payslip.hourlyGrossRate) : "—"}</p>
    </div>
  </section>

  ${
    hoursRows
      ? `<section><h2>Détail des heures</h2><table><thead><tr><th>Date</th><th>Plage</th><th>Prévu (h)</th><th>Pointé (h)</th><th>Payé (h)</th></tr></thead><tbody>${hoursRows}</tbody></table></section>`
      : ""
  }

  ${renderLinesTable(lines)}

  ${
    pay
      ? `<section class="totals">
    <div class="total-row"><span>Salaire brut</span><strong>${eur(pay.grossTotal)}</strong></div>
    <div class="total-row"><span>Cotisations salariales</span><strong>− ${eur(pay.employeeContribTotal)}</strong></div>
    <div class="total-row"><span>Net social</span><strong>${eur(pay.grossTotal - pay.employeeContribTotal)}</strong></div>
    <div class="total-row highlight"><span>Net à payer avant impôt sur le revenu</span><strong>${eur(pay.netBeforeTax)}</strong></div>
    ${
      pay.pasAmount > 0
        ? `<div class="total-row"><span>Prélèvement à la source (${pay.pasRatePct?.toFixed(2) ?? "0"} %)</span><strong>− ${eur(pay.pasAmount)}</strong></div>`
        : ""
    }
    <div class="total-row highlight net-pay"><span>Net à payer</span><strong>${eur(pay.netPayable)}</strong></div>
    <div class="total-row muted"><span>Coût total employeur</span><strong>${eur(pay.employerCostTotal)}</strong></div>
  </section>

  <section class="mentions">
    <h2>Mentions légales</h2>
    <p>PMSS ${eur(PMSS_2026)} · Moteur paie ${pay.engineVersion ?? PAYROLL_ENGINE_VERSION}</p>
    ${
      emp.paidLeave
        ? `<p>Congés payés : acquis ${emp.paidLeave.acquiredThisMonth.toFixed(2)} j · pris ${emp.paidLeave.takenThisMonth.toFixed(2)} j · solde ${emp.paidLeave.balanceDays.toFixed(2)} j ouvrables.</p>`
        : `<p>Congés payés : suivi à renseigner (acquis / pris / solde).</p>`
    }
    <p>${PAYSLIP_LEGAL_NOTICE}</p>
  </section>`
      : ""
  }

  <footer class="disclaimer">
    <p>Document généré le ${new Date().toLocaleDateString("fr-FR")} — à conserver sans limitation de durée par l'employeur.</p>
    <p>La DSN mensuelle doit être transmise à l'URSSAF dans les délais légaux.</p>
  </footer>
</article>`;

  return { title, html };
}

export function payslipPrintStyles(): string {
  return `
@page { margin: 14mm; }
body { font-family: Georgia, "Times New Roman", serif; color: #1c1917; font-size: 11pt; line-height: 1.45; }
.payslip { max-width: 210mm; margin: 0 auto; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 9pt; color: #78716c; }
h1 { font-size: 18pt; margin: 0.2em 0; }
h2 { font-size: 11pt; margin: 1em 0 0.4em; border-bottom: 1px solid #d6d3d1; padding-bottom: 0.2em; }
h3 { font-size: 10pt; margin: 1em 0 0.3em; color: #57534e; }
.meta { margin: 0.1em 0; color: #57534e; font-size: 10pt; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
table { width: 100%; border-collapse: collapse; margin: 0.4em 0 1em; font-size: 9.5pt; }
th, td { border: 1px solid #e7e5e4; padding: 0.35em 0.5em; text-align: left; }
th { background: #fafaf9; font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.neg { color: #9f1239; }
.totals { margin-top: 1.2em; border: 1px solid #d6d3d1; padding: 0.8em 1em; }
.total-row { display: flex; justify-content: space-between; padding: 0.25em 0; }
.total-row.highlight { font-size: 11pt; border-top: 1px solid #d6d3d1; margin-top: 0.4em; padding-top: 0.5em; }
.total-row.net-pay { font-size: 13pt; border-top: 2px solid #1c1917; font-weight: 700; }
.total-row.muted { color: #78716c; font-size: 9.5pt; }
.mentions { margin-top: 1em; font-size: 9pt; color: #57534e; }
.disclaimer { margin-top: 1.5em; padding-top: 0.8em; border-top: 1px dashed #d6d3d1; font-size: 8.5pt; color: #78716c; }
`;
}

export function openPayslipPrintWindow(documentHtml: string, title: string): void {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>${title}</title><style>${payslipPrintStyles()}</style></head><body>${documentHtml}<script>window.print()</script></body></html>`
  );
  win.document.close();
}
