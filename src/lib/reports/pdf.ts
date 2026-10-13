import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { compactNumber, niceScale } from "./rules"
import type { CellValue, ReportChart, ReportDoc, ReportSection } from "./types"

// Genera el PDF de un reporte: encabezado con el nombre (y logo) de la iglesia,
// cifras clave y tablas que continúan en páginas siguientes con su encabezado.

export interface PdfBranding {
  organizationName: string
  /** Logo ya convertido a PNG. */
  logo: { buffer: Buffer; width: number; height: number } | null
}

const MARGIN = 40
const ROW_H = 18
const HEAD_H = 20
const INK = rgb(0.13, 0.15, 0.2)
const MUTED = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.85, 0.87, 0.9)
const BRAND = rgb(0.1, 0.35, 0.55)

export async function renderReportPdf(doc: ReportDoc, branding: PdfBranding): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const wide = doc.sections.some((s) => s.columns.length > 6)
  const W = wide ? 792 : 612
  const H = wide ? 612 : 792
  const logo = branding.logo ? await pdf.embedPng(branding.logo.buffer).catch(() => null) : null

  // Texto compatible con WinAnsi: lo que la fuente no codifica se cambia por «?».
  const cache = new Map<string, string>()
  const safe = (v: CellValue, f: PDFFont): string => {
    const s = v === null || v === undefined ? "" : String(v)
    let out = ""
    for (const ch of s) {
      const key = ch
      let r = cache.get(key)
      if (r === undefined) {
        try {
          f.encodeText(ch)
          r = ch
        } catch {
          r = ch === "\n" || ch === "\t" ? " " : "?"
        }
        cache.set(key, r)
      }
      out += r
    }
    return out
  }
  const fit = (text: string, f: PDFFont, size: number, max: number): string => {
    if (f.widthOfTextAtSize(text, size) <= max) return text
    let t = text
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > max) t = t.slice(0, -1)
    return `${t}...`
  }

  let page: PDFPage = pdf.addPage([W, H])
  let y = H - MARGIN
  const pages: PDFPage[] = [page]

  const header = (first: boolean) => {
    y = H - MARGIN
    if (first) {
      let x = MARGIN
      if (logo) {
        const scale = Math.min(44 / logo.height, 120 / logo.width)
        page.drawImage(logo, { x, y: y - logo.height * scale + 6, width: logo.width * scale, height: logo.height * scale })
        x += logo.width * scale + 12
      }
      page.drawText(safe(branding.organizationName, bold), { x, y: y - 8, size: 13, font: bold, color: INK })
      page.drawText(safe(doc.title, bold), { x, y: y - 26, size: 17, font: bold, color: BRAND })
      page.drawText(safe(doc.periodLabel, font), { x, y: y - 42, size: 10, font, color: MUTED })
      y -= 62
      page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: LINE })
      y -= 16
    } else {
      page.drawText(safe(`${branding.organizationName} - ${doc.title}`, font), { x: MARGIN, y: y - 6, size: 9, font, color: MUTED })
      y -= 22
    }
  }
  const newPage = () => {
    page = pdf.addPage([W, H])
    pages.push(page)
    header(false)
  }
  const ensure = (h: number) => {
    if (y - h < MARGIN + 18) newPage()
  }

  header(true)

  // Cifras clave.
  if (doc.kpis.length > 0) {
    const perRow = Math.min(4, doc.kpis.length)
    const gap = 8
    const cw = (W - MARGIN * 2 - gap * (perRow - 1)) / perRow
    for (let i = 0; i < doc.kpis.length; i += perRow) {
      ensure(46)
      doc.kpis.slice(i, i + perRow).forEach((k, j) => {
        const x = MARGIN + j * (cw + gap)
        page.drawRectangle({ x, y: y - 40, width: cw, height: 40, borderColor: LINE, borderWidth: 1, color: rgb(0.97, 0.98, 0.99) })
        page.drawText(fit(safe(k.value, bold), bold, 15, cw - 12), { x: x + 6, y: y - 18, size: 15, font: bold, color: INK })
        page.drawText(fit(safe(k.label, font), font, 8, cw - 12), { x: x + 6, y: y - 33, size: 8, font, color: MUTED })
      })
      y -= 50
    }
    y -= 4
  }

  const drawTable = (s: ReportSection) => {
    ensure(HEAD_H + ROW_H * 2 + 24)
    page.drawText(safe(s.title, bold), { x: MARGIN, y: y - 10, size: 12, font: bold, color: INK })
    y -= 18
    if (s.note) {
      page.drawText(fit(safe(s.note, font), font, 8, W - MARGIN * 2), { x: MARGIN, y: y - 7, size: 8, font, color: MUTED })
      y -= 12
    }
    const total = W - MARGIN * 2
    // Ancho por columna: proporcional al texto más largo (con mínimo y máximo).
    const weights = s.columns.map((c) => {
      const longest = Math.max(c.label.length, ...s.rows.slice(0, 80).map((r) => String(r[c.key] ?? "").length), String(s.totals?.[c.key] ?? "").length)
      return Math.min(32, Math.max(5, longest))
    })
    const sum = weights.reduce((a, b) => a + b, 0)
    const widths = weights.map((w) => (w / sum) * total)
    const cell = (text: string, i: number, x: number, rowY: number, f: PDFFont, size: number, color = INK) => {
      const col = s.columns[i]
      const t = fit(text, f, size, widths[i] - 8)
      const tw = f.widthOfTextAtSize(t, size)
      page.drawText(t, { x: col.align === "right" ? x + widths[i] - 4 - tw : x + 4, y: rowY, size, font: f, color })
    }
    const head = () => {
      page.drawRectangle({ x: MARGIN, y: y - HEAD_H, width: total, height: HEAD_H, color: rgb(0.92, 0.94, 0.97) })
      let x = MARGIN
      s.columns.forEach((c, i) => {
        cell(safe(c.label, bold), i, x, y - 13, bold, 8.5)
        x += widths[i]
      })
      y -= HEAD_H
    }
    head()
    const row = (r: Record<string, CellValue>, shaded: boolean, strong = false) => {
      if (y - ROW_H < MARGIN + 18) {
        newPage()
        head()
      }
      if (shaded) page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: total, height: ROW_H, color: rgb(0.98, 0.98, 0.99) })
      let x = MARGIN
      s.columns.forEach((c, i) => {
        cell(safe(r[c.key], strong ? bold : font), i, x, y - 12.5, strong ? bold : font, 9)
        x += widths[i]
      })
      page.drawLine({ start: { x: MARGIN, y: y - ROW_H }, end: { x: MARGIN + total, y: y - ROW_H }, thickness: 0.4, color: LINE })
      y -= ROW_H
    }
    if (s.rows.length === 0) {
      ensure(ROW_H)
      page.drawText("Sin información en este periodo.", { x: MARGIN + 4, y: y - 12.5, size: 9, font, color: MUTED })
      y -= ROW_H
    }
    s.rows.forEach((r, i) => row(r, i % 2 === 1))
    if (s.totals) row(s.totals, false, true)
    y -= 14
  }
  // Gráficas: barras agrupadas (comparativos) y líneas (tendencias).
  const SERIES = [rgb(0.1, 0.35, 0.55), rgb(0.62, 0.67, 0.74), rgb(0.85, 0.55, 0.15)]
  const chartH = 150
  const drawChart = (ch: ReportChart) => {
    if (ch.categories.length === 0 || ch.series.length === 0) return
    ensure(chartH + 56)
    page.drawText(safe(ch.title, bold), { x: MARGIN, y: y - 10, size: 11, font: bold, color: INK })
    // Leyenda
    let lx = W - MARGIN
    for (let i = ch.series.length - 1; i >= 0; i--) {
      const name = safe(ch.series[i].name, font)
      const tw = font.widthOfTextAtSize(name, 8)
      lx -= tw
      page.drawText(name, { x: lx, y: y - 9, size: 8, font, color: MUTED })
      lx -= 12
      page.drawRectangle({ x: lx, y: y - 10, width: 8, height: 8, color: SERIES[i % SERIES.length] })
      lx -= 10
    }
    y -= 22
    const left = MARGIN + 38
    const right = W - MARGIN
    const top = y
    const bottom = y - chartH + 28
    const maxV = Math.max(0, ...ch.series.flatMap((s) => s.values))
    const { max, step } = niceScale(maxV)
    const ticks = Math.round(max / step)
    const fmtV = (v: number) => (ch.unit === "money" ? `${compactNumber(v)}` : ch.unit === "percent" ? `${compactNumber(v)}%` : compactNumber(v))
    for (let t = 0; t <= ticks; t++) {
      const val = t * step
      const ty = bottom + ((top - bottom) * val) / max
      page.drawLine({ start: { x: left, y: ty }, end: { x: right, y: ty }, thickness: 0.4, color: LINE })
      const label = safe(fmtV(val), font)
      page.drawText(label, { x: left - 4 - font.widthOfTextAtSize(label, 7), y: ty - 2.5, size: 7, font, color: MUTED })
    }
    const n = ch.categories.length
    const slot = (right - left) / n
    const catLabel = (i: number) => fit(safe(ch.categories[i], font), font, 7, slot - 2)
    if (ch.kind === "bar") {
      const groupW = slot * 0.74
      const barW = groupW / ch.series.length
      ch.categories.forEach((_, i) => {
        const gx = left + slot * i + (slot - groupW) / 2
        ch.series.forEach((s, j) => {
          const v = s.values[i] ?? 0
          const h = max === 0 ? 0 : ((top - bottom) * v) / max
          page.drawRectangle({ x: gx + barW * j, y: bottom, width: Math.max(1, barW - 1.5), height: Math.max(0.5, h), color: SERIES[j % SERIES.length] })
          if (n <= 8 && v > 0) {
            const lab = safe(fmtV(v), font)
            const w = font.widthOfTextAtSize(lab, 6.5)
            page.drawText(lab, { x: gx + barW * j + (barW - 1.5) / 2 - w / 2, y: bottom + h + 2, size: 6.5, font, color: INK })
          }
        })
        const lab = catLabel(i)
        page.drawText(lab, { x: left + slot * i + slot / 2 - font.widthOfTextAtSize(lab, 7) / 2, y: bottom - 11, size: 7, font, color: MUTED })
      })
    } else {
      ch.series.forEach((s, j) => {
        const pts = s.values.map((v, i) => ({ x: left + slot * i + slot / 2, y: bottom + (max === 0 ? 0 : ((top - bottom) * v) / max) }))
        for (let k = 1; k < pts.length; k++) page.drawLine({ start: pts[k - 1], end: pts[k], thickness: 1.6, color: SERIES[j % SERIES.length] })
        pts.forEach((p) => page.drawCircle({ x: p.x, y: p.y, size: 2.2, color: SERIES[j % SERIES.length] }))
      })
      const every = Math.max(1, Math.ceil(n / 10))
      ch.categories.forEach((_, i) => {
        if (i % every !== 0) return
        const lab = catLabel(i)
        page.drawText(lab, { x: left + slot * i + slot / 2 - font.widthOfTextAtSize(lab, 7) / 2, y: bottom - 11, size: 7, font, color: MUTED })
      })
    }
    page.drawLine({ start: { x: left, y: bottom }, end: { x: right, y: bottom }, thickness: 0.8, color: MUTED })
    y = bottom - 26
  }
  for (const ch of doc.charts ?? []) drawChart(ch)

  for (const s of doc.sections) drawTable(s)

  // Pie en cada página.
  const stamp = new Date().toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  pages.forEach((p, i) => {
    p.drawText(safe(`Generado el ${stamp}`, font), { x: MARGIN, y: 22, size: 8, font, color: MUTED })
    const label = `Pagina ${i + 1} de ${pages.length}`
    p.drawText(label, { x: W - MARGIN - font.widthOfTextAtSize(label, 8), y: 22, size: 8, font, color: MUTED })
  })
  return Buffer.from(await pdf.save())
}
