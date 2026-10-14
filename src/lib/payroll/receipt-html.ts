import { FREQUENCY_LABELS, PAY_METHOD_LABELS, SALARY_TYPE_LABELS, type ConceptLine } from "@/lib/payroll/calc"

// Cuerpo del recibo de nómina en HTML con estilos en línea: se usa para el
// correo y para imprimir (los clientes de correo no admiten variables CSS).

export interface ReceiptPeriod {
  folio: string
  frequency: string
  startDate: string
  endDate: string
}
export interface ReceiptEntry {
  employee: { fullName: string; position: string | null }
  salaryType: string
  daysWorked: number
  absences: number
  overtimeHours: number
  holidayDays: number
  restDaysWorked: number
  basePay: number
  overtimePay: number
  holidayPay: number
  restDayPay: number
  perceptions: ConceptLine[]
  deductions: ConceptLine[]
  grossPay: number
  netPay: number
  payMethod: string
  paidAt: string | null
  notes: string | null
}
export interface ReceiptCompany {
  name: string
  legalName: string | null
  taxId: string | null
  logoUrl?: string | null
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const date = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

export function receiptBodyHtml(period: ReceiptPeriod, e: ReceiptEntry, company: ReceiptCompany) {
  const row = (label: string, amount: number, sign = "") =>
    amount ? `<tr><td style="padding:6px 0;color:#4b5563">${esc(label)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${sign}${money(amount)}</td></tr>` : ""
  const perceptions = [
    row(`Sueldo (${SALARY_TYPE_LABELS[e.salaryType] ?? "base"})`, e.basePay),
    row(`Horas extra (${e.overtimeHours} h)`, e.overtimePay),
    row(`Festivos trabajados (${e.holidayDays})`, e.holidayPay),
    row(`Descansos trabajados (${e.restDaysWorked})`, e.restDayPay),
    ...e.perceptions.map((p) => row(p.name, p.amount)),
  ].join("")
  const deductions = e.deductions.map((d) => row(d.name, d.amount, "−")).join("")

  return `
    <p style="margin:0 0 4px;color:#6b7280;font-size:13px">Periodo ${esc(period.folio)} · ${esc(FREQUENCY_LABELS[period.frequency] ?? "")}</p>
    <p style="margin:0 0 18px;font-size:15px"><b>${esc(e.employee.fullName)}</b>${e.employee.position ? ` · ${esc(e.employee.position)}` : ""}<br/>
    <span style="color:#6b7280">${date(period.startDate)} al ${date(period.endDate)} · Días trabajados: ${e.daysWorked}${e.absences ? ` · Faltas: ${e.absences}` : ""}</span></p>
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.06em;color:#6b7280;text-transform:uppercase">Percepciones</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${perceptions}
      <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;font-weight:700">Total percepciones</td><td style="padding:8px 0;border-top:1px solid #e5e7eb;text-align:right;font-weight:700">${money(e.grossPay)}</td></tr>
    </table>
    ${deductions ? `<p style="margin:14px 0 0;font-size:12px;font-weight:700;letter-spacing:.06em;color:#6b7280;text-transform:uppercase">Deducciones</p><table style="width:100%;border-collapse:collapse;font-size:14px">${deductions}</table>` : ""}
    <div style="margin-top:18px;padding:16px;border-radius:14px;background:#f1f5f9;display:flex;justify-content:space-between">
      <span style="font-weight:700">Neto a pagar</span>
      <span style="font-size:22px;font-weight:800;float:right">${money(e.netPay)}</span>
    </div>
    <p style="margin:12px 0 0;color:#6b7280;font-size:13px">Forma de pago: ${esc(PAY_METHOD_LABELS[e.payMethod] ?? e.payMethod)}${e.paidAt ? ` · Pagado el ${new Date(e.paidAt).toLocaleDateString("es-MX")}` : ""}</p>
    ${e.notes ? `<p style="margin:8px 0 0;color:#4b5563;font-size:13px">${esc(e.notes)}</p>` : ""}
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px">Comprobante interno de pago emitido por ${esc(company.legalName ?? company.name)}${company.taxId ? ` (RFC ${esc(company.taxId)})` : ""}. No es un CFDI de nómina.</p>`
}

/** Documento completo para imprimir uno o varios recibos (uno por hoja). */
export function receiptPrintDocument(period: ReceiptPeriod, entries: ReceiptEntry[], company: ReceiptCompany) {
  const pages = entries
    .map(
      (e) => `<section class="sheet"><header><span style="display:flex;align-items:center;gap:12px;color:#20242b;font-size:18px;text-transform:none;letter-spacing:0">${company.logoUrl ? `<img src="${esc(company.logoUrl)}" alt="" style="height:44px;max-width:120px;object-fit:contain"/>` : ""}<b>${esc(company.name)}</b></span><span>Recibo de nómina</span></header>${receiptBodyHtml(period, e, company)}
      <div class="sign"><div>Firma de quien recibe<br/><b>${esc(e.employee.fullName)}</b></div><div>Entregó<br/><b>${esc(company.name)}</b></div></div></section>`
    )
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Recibos ${esc(period.folio)}</title><style>
    body{font-family:Arial,sans-serif;color:#20242b;margin:0;background:#f4f6f8}
    .sheet{background:#fff;max-width:640px;margin:24px auto;padding:32px;border:1px solid #e5e7eb;border-radius:16px;page-break-after:always}
    header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #20242b;padding-bottom:10px;margin-bottom:16px;font-size:18px}
    header span{font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
    .sign{display:flex;gap:32px;margin-top:48px;font-size:12px;color:#6b7280;text-align:center}
    .sign div{flex:1;border-top:1px solid #9ca3af;padding-top:8px}
    @media print{body{background:#fff}.sheet{margin:0 auto;border:0;border-radius:0}}
  </style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`
}
