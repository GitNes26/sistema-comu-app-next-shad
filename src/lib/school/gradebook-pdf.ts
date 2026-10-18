import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"
import { PALETTE, centeredX, drawCheck, drawCross, drawFieldLine, drawLogoBox, textTools, type PdfLogo } from "@/lib/pdf/kit"
import type { GradebookDto } from "@/lib/school/server"

// «Lista de asistencia y calificaciones» de un grupo de la escuela, con el formato de las
// hojas impresas: encabezado con logo y datos del grupo, una columna por clase con su fecha,
// promedios y resultado. Continúa en hojas siguientes si hay muchos alumnos.

const W = 792
const H = 612
const M = 28
const MIN_ROWS = 18

const fmt = (v: number | null) => (v === null ? "" : v.toFixed(1))
const fmtDate = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(2, 4)}` : "")

export interface SheetBranding {
  organizationName: string
  logo: PdfLogo | null
}

export async function renderGradebookPdf(book: GradebookDto, branding: SheetBranding): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = branding.logo ? await pdf.embedPng(branding.logo.buffer).catch(() => null) : null
  const tools = textTools()
  const { safe, fit } = tools
  const fonts = { regular, bold }

  const weeks = Math.max(1, Math.min(book.group.weeks, 16))
  const university = book.group.schoolKind === "university"
  const tableW = W - M * 2
  const noW = 22
  const weekW = weeks > 10 ? 17 : 21
  const extra: { key: string; label: string; w: number }[] = [
    { key: "tasks", label: "TAREAS", w: 38 },
    { key: "exercises", label: "EJERC.", w: 38 },
    { key: "final", label: "FINAL", w: 34 },
    ...(university ? [{ key: "points", label: "PUNTOS", w: 38 }] : []),
    { key: "result", label: "RESULTADO", w: 62 },
  ]
  const nameW = tableW - noW - weekW * weeks - extra.reduce((a, b) => a + b.w, 0)
  const widths = [noW, nameW, ...Array(weeks).fill(weekW), ...extra.map((e) => e.w)] as number[]
  const xs: number[] = []
  let acc = M
  for (const w of widths) {
    xs.push(acc)
    acc += w
  }
  const weekStart = 2
  const extraStart = 2 + weeks
  const border = { borderColor: PALETTE.line, borderWidth: 0.7 }
  const dateOfWeek = new Map(book.sessions.map((s) => [s.week, s.date]))

  const header = (page: PDFPage, first: boolean): number => {
    const y = H - M
    if (!first) {
      page.drawText(safe(`${branding.organizationName} - ${book.group.courseName} - ${book.group.name} (continuación)`, regular), { x: M, y: y - 6, size: 8, font: regular, color: PALETTE.muted })
      return y - 18
    }
    drawLogoBox(page, { x: M, top: y, w: 118, h: 74 }, logo, branding.logo, branding.organizationName, { bold }, tools)
    const title = "LISTA DE ASISTENCIA Y CALIFICACIONES"
    page.drawText(title, { x: W - M - bold.widthOfTextAtSize(title, 16), y: y - 14, size: 16, font: bold, color: PALETTE.ink })
    const fx = M + 140
    const half = (W - M - fx - 20) / 2
    drawFieldLine(page, fonts, tools, "Libro", book.group.courseName, fx, y - 36, half, 9)
    drawFieldLine(page, fonts, tools, "Grupo", book.group.name, fx + half + 20, y - 36, half, 9)
    drawFieldLine(page, fonts, tools, "Maestro", book.group.teacherName, fx, y - 52, half, 9)
    drawFieldLine(page, fonts, tools, "Auxiliar", book.group.assistantName, fx + half + 20, y - 52, half, 9)
    drawFieldLine(page, fonts, tools, "Inicio", fmtDate(book.group.startDate), fx, y - 68, half, 9)
    drawFieldLine(page, fonts, tools, "Fin", fmtDate(book.group.endDate), fx + half + 20, y - 68, half, 9)
    return y - 90
  }

  const head = (page: PDFPage, y: number): number => {
    const h = 28
    page.drawRectangle({ x: M, y: y - h, width: tableW, height: h, color: PALETTE.band, ...border })
    const labels = ["No", "NOMBRE DEL ALUMNO", ...Array.from({ length: weeks }, (_, i) => String(i + 1)), ...extra.map((e) => e.label)]
    labels.forEach((l, i) => {
      page.drawRectangle({ x: xs[i], y: y - h, width: widths[i], height: h, ...border })
      const isWeek = i >= weekStart && i < extraStart
      const size = i === 1 ? 8.5 : 7
      const tx = i === 1 ? xs[i] + 4 : centeredX(bold, l, size, xs[i], widths[i])
      page.drawText(safe(l, bold), { x: tx, y: y - (isWeek ? 11 : 17), size, font: bold, color: PALETTE.ink })
      if (isWeek) {
        const d = dateOfWeek.get(i - weekStart + 1)
        if (d) {
          const s = `${d.slice(8, 10)}/${d.slice(5, 7)}`
          page.drawText(s, { x: centeredX(regular, s, 5, xs[i], widths[i]), y: y - 22, size: 5, font: regular, color: PALETTE.muted })
        }
      }
    })
    return y - h
  }

  const row = (page: PDFPage, r: GradebookDto["rows"][number] | null, n: number, y: number, rh: number) => {
    xs.forEach((x, i) => page.drawRectangle({ x, y: y - rh, width: widths[i], height: rh, ...border }))
    page.drawText(String(n), { x: centeredX(bold, String(n), 7, xs[0], widths[0]), y: y - rh + (rh - 7) / 2 + 0.5, size: 7, font: bold, color: PALETTE.ink })
    if (!r) return
    page.drawText(fit(safe(r.name, regular), regular, 8.5, nameW - 8), { x: xs[1] + 4, y: y - rh + (rh - 8.5) / 2 + 1, size: 8.5, font: regular, color: PALETTE.slate })
    for (let w = 1; w <= weeks; w++) {
      const st = r.attendance[w]
      const cx = xs[weekStart + w - 1] + weekW / 2
      const cy = y - rh / 2
      if (st === "present") drawCheck(page, cx, cy, Math.min(10, rh - 3))
      else if (st === "absent") drawCross(page, cx, cy, Math.min(10, rh - 3))
      else if (st === "excused") page.drawText("J", { x: cx - 2.5, y: cy - 3, size: 7.5, font: bold, color: PALETTE.muted })
    }
    const result = r.passed === true ? "Aprobado" : r.passed === false ? "No aprobado" : r.status === "enrolled" ? "En curso" : ""
    const values: Record<string, string> = {
      tasks: fmt(r.tasksAvg),
      exercises: fmt(r.exercisesAvg),
      final: fmt(r.finalGrade),
      points: r.points === null ? "" : String(r.points),
      result,
    }
    extra.forEach((e, i) => {
      const v = values[e.key]
      if (!v) return
      const size = e.key === "result" ? 7 : 8
      const f = e.key === "result" ? bold : regular
      page.drawText(safe(v, f), { x: centeredX(f, v, size, xs[extraStart + i], e.w), y: y - rh + (rh - size) / 2 + 1, size, font: f, color: e.key === "result" && r.passed ? PALETTE.blue : PALETTE.slate })
    })
  }

  let page = pdf.addPage([W, H])
  let y = head(page, header(page, true))
  const rows = book.rows
  const total = Math.max(MIN_ROWS, rows.length)
  const rh = 14
  const bottom = M + 70
  for (let i = 0; i < total; i++) {
    if (y - rh < bottom) {
      page = pdf.addPage([W, H])
      y = head(page, header(page, false))
    }
    row(page, rows[i] ?? null, i + 1, y, rh)
    y -= rh
  }

  // Claves y firmas
  y -= 14
  page.drawText(safe(`Aprobar: promedio final de ${book.group.passScore.toFixed(1)} o más${university ? ` o ${book.group.pointsToPass} puntos` : ""}.   Asistencia: palomita = asistió, X = faltó, J = justificada.`, regular), {
    x: M,
    y,
    size: 7.5,
    font: regular,
    color: PALETTE.muted,
  })
  y -= 34
  const half = (tableW - 40) / 2
  ;(["Maestro", "Director de la escuela"] as const).forEach((label, i) => {
    const x = M + i * (half + 40)
    page.drawLine({ start: { x, y }, end: { x: x + half, y }, thickness: 0.7, color: PALETTE.line })
    page.drawText(safe(label, bold), { x, y: y - 10, size: 8, font: bold, color: PALETTE.ink })
  })
  pdf.getPages().forEach((p, i, all) => {
    const label = `${branding.organizationName} - ${book.group.courseName} - ${book.group.name}   |   Página ${i + 1} de ${all.length}`
    const s = safe(label, regular)
    p.drawText(fit(s, regular, 7, tableW), { x: M, y: M - 8, size: 7, font: regular, color: PALETTE.muted })
  })
  return Buffer.from(await pdf.save())
}

export type { PDFFont }
