import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"
import { PALETTE, centeredX, drawCheck, drawCross, drawFieldLine, drawLogoBox, textTools, type PdfLogo } from "@/lib/pdf/kit"
import { GROWTH_COLUMNS, SHEET_NEW_ROWS, SHEET_SHEEP_ROWS, SHEET_WEEKS, type FollowUpSheet, type SheetRow } from "@/lib/cells/followup-rules"

// «Hoja de seguimiento mensual» como la que se entrega en papel a cada hogar de amor:
// encabezado con logo y datos del hogar, lista de ovejas con asistencia por semana y
// crecimiento, nuevos creyentes, total de ovejas, observaciones y claves.

const W = 792
const H = 612
const M = 28
const QUOTE = "Sé diligente en conocer el estado de tus ovejas, y mira con cuidado por tus rebaños"

export interface FollowUpBranding {
  organizationName: string
  logo: PdfLogo | null
}

export async function renderFollowUpPdf(sheets: FollowUpSheet[], branding: FollowUpBranding): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const logo = branding.logo ? await pdf.embedPng(branding.logo.buffer).catch(() => null) : null
  const tools = textTools()

  const list = sheets.length ? sheets : []
  for (const sheet of list) drawSheet(pdf, sheet, { regular, bold, italic }, logo, branding, tools)
  if (list.length === 0) {
    const page = pdf.addPage([W, H])
    page.drawText("No hay células para mostrar.", { x: M, y: H - M - 20, size: 12, font: regular, color: PALETTE.muted })
  }
  return Buffer.from(await pdf.save())
}

const lc1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont }
type Tools = ReturnType<typeof textTools>
type Logo = Awaited<ReturnType<PDFDocument["embedPng"]>> | null

function drawSheet(pdf: PDFDocument, sheet: FollowUpSheet, f: Fonts, logo: Logo, branding: FollowUpBranding, t: Tools) {
  const { safe, fit } = t
  let page = pdf.addPage([W, H])

  // Columnas de la tabla.
  const nW = 22
  const phoneW = 84
  const weekW = 18
  const growW = GROWTH_COLUMNS.map((g) => (g.short === "BES" ? 26 : 22))
  const tableW = W - M * 2
  const nameW = tableW - nW - phoneW - weekW * SHEET_WEEKS - growW.reduce((a, b) => a + b, 0)
  const colX: number[] = []
  let acc = M
  for (const w of [nW, nameW, phoneW, ...Array(SHEET_WEEKS).fill(weekW), ...growW]) {
    colX.push(acc)
    acc += w
  }
  const colW = [nW, nameW, phoneW, ...Array(SHEET_WEEKS).fill(weekW), ...growW] as number[]
  const weekStart = 3
  const growStart = 3 + SHEET_WEEKS

  // ── Encabezado ────────────────────────────────────────────────────────────
  const top = H - M
  drawLogoBox(page, { x: M, top, w: 150, h: 96 }, logo, branding.logo, branding.organizationName, { bold: f.bold }, t)

  const title = "HOJA DE SEGUIMIENTO MENSUAL"
  page.drawText(title, { x: W - M - f.bold.widthOfTextAtSize(title, 17), y: top - 14, size: 17, font: f.bold, color: PALETTE.ink })

  // Lema y cita
  const quoteW = 330
  const quoteX = M + 162
  const words = QUOTE.split(" ")
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (f.italic.widthOfTextAtSize(safe(test, f.italic), 11) > quoteW && cur) {
      lines.push(cur)
      cur = w
    } else cur = test
  }
  if (cur) lines.push(cur)
  lines.forEach((l, i) => page.drawText(safe(i === 0 ? `"${l}` : i === lines.length - 1 ? `${l}"` : l, f.italic), { x: quoteX, y: top - 30 - i * 14, size: 11, font: f.italic, color: PALETTE.slate }))
  page.drawText("Proverbios 27:23", { x: quoteX, y: top - 30 - lines.length * 14 - 12, size: 11, font: f.bold, color: PALETTE.blue })

  // Datos del hogar (líneas a la derecha)
  const fx = W - M - 250
  const fields: [string, string | null][] = [
    ["Líder", sheet.cell.leaders.join(" y ")],
    ["Colonia", sheet.cell.neighborhood],
    ["Calle/No.", sheet.cell.street],
    ["Teléfono", sheet.cell.leaderPhone],
    ["Día / Hora", sheet.cell.schedule],
    ["Anfitrión", sheet.cell.host],
    ["Red", sheet.cell.network],
  ]
  fields.forEach(([label, value], i) => drawFieldLine(page, f, t, label, value, fx, top - 36 - i * 12.5, 250, 8.5))
  drawFieldLine(page, f, t, "Pastor", sheet.cell.pastor, fx, top - 36 - fields.length * 12.5 - 6, 250, 8.5)

  // ── Mes y encabezado de la tabla ─────────────────────────────────────────
  let y = top - 150
  page.drawText("Mes:", { x: colX[weekStart] - 150, y: y + 14, size: 9, font: f.bold, color: PALETTE.ink })
  page.drawRectangle({ x: colX[weekStart] - 124, y: y + 9, width: 96, height: 16, borderColor: PALETTE.line, borderWidth: 0.8 })
  page.drawText(safe(sheet.monthLabel, f.bold), { x: colX[weekStart] - 120, y: y + 13, size: 9, font: f.bold, color: PALETTE.slate })
  const gx0 = colX[growStart]
  const gw = growW.reduce((a, b) => a + b, 0)
  page.drawText("CRECIMIENTO", { x: centeredX(f.bold, "CRECIMIENTO", 7.5, gx0, gw), y: y + 3, size: 7.5, font: f.bold, color: PALETTE.ink })

  const headH = 22
  const cellBorder = { borderColor: PALETTE.line, borderWidth: 0.7 }
  const drawHead = (p: PDFPage, hy: number) => {
    p.drawRectangle({ x: M, y: hy - headH, width: tableW, height: headH, color: PALETTE.band, ...cellBorder })
    const heads = ["No", "NOMBRE DE OVEJA", "Teléfono", ...Array.from({ length: SHEET_WEEKS }, (_, i) => String(i + 1)), ...GROWTH_COLUMNS.map((g) => g.short)]
    heads.forEach((h, i) => {
      p.drawRectangle({ x: colX[i], y: hy - headH, width: colW[i], height: headH, ...cellBorder })
      const size = i === 1 ? 8.5 : 7.5
      const left = i === 1 || i === 2
      const tx = left ? colX[i] + 4 : centeredX(f.bold, h, size, colX[i], colW[i])
      p.drawText(safe(h, f.bold), { x: tx, y: hy - (i >= weekStart && i < growStart ? 10 : 14), size, font: f.bold, color: PALETTE.ink })
      // Fecha de la reunión bajo el número de semana.
      if (i >= weekStart && i < growStart) {
        const d = sheet.weekDates[i - weekStart]
        if (d) {
          const label = `${d.slice(8, 10)}/${d.slice(5, 7)}`
          p.drawText(label, { x: centeredX(f.regular, label, 5, colX[i], colW[i]), y: hy - 18.5, size: 5, font: f.regular, color: PALETTE.muted })
        }
      }
    })
  }
  drawHead(page, y)
  y -= headH

  // ── Filas ─────────────────────────────────────────────────────────────────
  const drawRow = (p: PDFPage, r: SheetRow | null, n: number, ry: number, rh: number) => {
    colX.forEach((x, i) => p.drawRectangle({ x, y: ry - rh, width: colW[i], height: rh, ...cellBorder }))
    p.drawText(String(n), { x: centeredX(f.bold, String(n), 7, colX[0], colW[0]), y: ry - rh + (rh - 7) / 2 + 0.5, size: 7, font: f.bold, color: PALETTE.ink })
    if (!r) return
    p.drawText(fit(safe(r.name, f.regular), f.regular, 8.5, nameW - 8), { x: colX[1] + 4, y: ry - rh + (rh - 8.5) / 2 + 1, size: 8.5, font: f.regular, color: PALETTE.slate })
    if (r.phone) p.drawText(fit(safe(r.phone, f.regular), f.regular, 8, phoneW - 6), { x: colX[2] + 3, y: ry - rh + (rh - 8) / 2 + 1, size: 8, font: f.regular, color: PALETTE.slate })
    r.weeks.forEach((v, i) => {
      const cx = colX[weekStart + i] + weekW / 2
      const cy = ry - rh / 2
      if (v === true) drawCheck(p, cx, cy, Math.min(10, rh - 3))
      else if (v === false) drawCross(p, cx, cy, Math.min(10, rh - 3))
    })
    GROWTH_COLUMNS.forEach((g, i) => {
      const mark = r.growth[g.key]
      const cx = colX[growStart + i] + growW[i] / 2
      const cy = ry - rh / 2
      if (mark.done) drawCheck(p, cx, cy, Math.min(10, rh - 3), PALETTE.blue)
      else if (mark.partial) {
        const s = String(mark.partial)
        p.drawText(s, { x: cx - f.bold.widthOfTextAtSize(s, 7.5) / 2, y: cy - 3, size: 7.5, font: f.bold, color: PALETTE.muted })
      }
    })
  }

  // Altura de fila: llena el espacio de las 18 filas; si hay más ovejas, se compacta.
  const sheepCount = Math.max(SHEET_SHEEP_ROWS, sheet.sheep.length)
  const maxOnPage = 28
  const rows = Math.min(sheepCount, maxOnPage)
  const newRows = Math.max(SHEET_NEW_ROWS, Math.min(sheet.newBelievers.length, 8))
  const rowH = Math.max(9.5, Math.min(14.5, (y - 135) / (rows + newRows)))
  for (let i = 0; i < rows; i++) {
    drawRow(page, sheet.sheep[i] ?? null, i + 1, y, rowH)
    y -= rowH
  }

  // Ovejas que no caben: continúan en hojas siguientes con el mismo encabezado.
  let rest = sheet.sheep.slice(rows)
  let nextN = rows + 1
  while (rest.length > 0) {
    page = pdf.addPage([W, H])
    let cy = H - M - 8
    page.drawText(safe(`${branding.organizationName} - Hoja de seguimiento mensual - ${sheet.cell.name} - ${sheet.monthLabel} (continuación)`, f.regular), { x: M, y: cy, size: 8, font: f.regular, color: PALETTE.muted })
    cy -= 14
    drawHead(page, cy)
    cy -= headH
    for (const r of rest.slice(0, 32)) {
      drawRow(page, r, nextN++, cy, 14)
      cy -= 14
    }
    rest = rest.slice(32)
    y = cy
  }

  // ── Nuevos creyentes ──────────────────────────────────────────────────────
  y -= 4
  page.drawText("NUEVOS CREYENTES", { x: M, y: y - 11, size: 11, font: f.bold, color: PALETTE.ink })
  y -= 15
  const newH = Math.min(14.5, rowH)
  for (let i = 0; i < newRows; i++) {
    drawRow(page, sheet.newBelievers[i] ?? null, i + 1, y, newH)
    y -= newH
  }

  // ── Pie: total, observaciones y claves ───────────────────────────────────
  y -= 10
  page.drawText(safe(`No. de ovejas actual: ${sheet.sheepCount + sheet.newBelievers.length}`, f.bold), { x: M, y: y - 6, size: 9, font: f.bold, color: PALETTE.ink })
  const present = sheet.presentPerWeek.map((n, i) => (sheet.weekDates[i] ? `S${i + 1}: ${n}` : null)).filter(Boolean).join("   ")
  if (present) page.drawText(safe(`Asistentes por semana  ${present}`, f.regular), { x: M, y: y - 19, size: 8, font: f.regular, color: PALETTE.slate })
  const obsX = M + 330
  page.drawText("Observaciones:", { x: obsX, y: y - 6, size: 9, font: f.bold, color: PALETTE.ink })
  const obs = sheet.observations.join("  |  ")
  if (obs) {
    const maxW = W - M - obsX - 6
    const lines2: string[] = []
    let line = ""
    for (const w of safe(obs, f.regular).split(" ")) {
      const test = line ? `${line} ${w}` : w
      if (f.regular.widthOfTextAtSize(test, 7.5) > maxW && line) {
        lines2.push(line)
        line = w
      } else line = test
    }
    if (line) lines2.push(line)
    lines2.slice(0, 3).forEach((l, i) => page.drawText(l, { x: obsX + 74, y: y - 6 - i * 9, size: 7.5, font: f.regular, color: PALETTE.slate }))
  }
  page.drawLine({ start: { x: obsX + 72, y: y - 9 }, end: { x: W - M, y: y - 9 }, thickness: 0.5, color: PALETTE.grid })

  // Claves
  const legendY = M + 18
  page.drawRectangle({ x: M, y: legendY - 6, width: tableW, height: 34, ...cellBorder })
  page.drawText("UT: Universidad Teológica", { x: M + 6, y: legendY + 16, size: 8, font: f.regular, color: PALETTE.ink })
  const short = (k: string) => GROWTH_COLUMNS.find((g) => g.short === k)!
  const l2 = `BA: ${lc1(short("BA").label)}   BES: ${lc1(short("BES").label)}   EJ: ${short("EJ").label}   EM: ${short("EM").label}   EL: ${short("EL").label}`
  page.drawText(safe(l2, f.regular), { x: M + 6, y: legendY + 4, size: 8, font: f.regular, color: PALETTE.ink })
  const stamp = `${branding.organizationName} - ${sheet.cell.name} - ${sheet.monthLabel}`
  page.drawText(fit(safe(stamp, f.regular), f.regular, 7, tableW), { x: M, y: M - 6, size: 7, font: f.regular, color: PALETTE.muted })
}
