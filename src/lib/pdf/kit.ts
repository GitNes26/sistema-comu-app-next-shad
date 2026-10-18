import { rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"

// Piezas comunes de los formatos impresos (hojas de seguimiento, listas, reportes):
// paleta de la marca, texto compatible con WinAnsi, marca de «hecho» dibujada y el
// encabezado con el cuadro del logo y los campos con línea, como las hojas de papel.

export const PALETTE = {
  ink: rgb(0.1, 0.12, 0.16),
  /** Pizarra de la marca (#303f4e). */
  slate: rgb(0.19, 0.25, 0.31),
  /** Azul comunidad (#2689cf). */
  blue: rgb(0.15, 0.54, 0.81),
  muted: rgb(0.4, 0.43, 0.48),
  line: rgb(0.16, 0.18, 0.22),
  grid: rgb(0.52, 0.55, 0.6),
  soft: rgb(0.93, 0.95, 0.97),
  band: rgb(0.88, 0.92, 0.96),
  white: rgb(1, 1, 1),
}

export type PdfValue = string | number | null | undefined

/** Herramientas de texto ligadas a una fuente: sanea lo que WinAnsi no codifica y recorta con «…». */
export function textTools() {
  const cache = new Map<string, string>()
  const safe = (v: PdfValue, f: PDFFont): string => {
    const s = v === null || v === undefined ? "" : String(v)
    let out = ""
    for (const ch of s) {
      const key = `${f.name}${ch}`
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
  return { safe, fit }
}

/** Palomita dibujada con dos trazos (la fuente estándar no trae ✓). */
export function drawCheck(page: PDFPage, cx: number, cy: number, size: number, color = PALETTE.ink) {
  const s = size
  page.drawLine({ start: { x: cx - s * 0.45, y: cy - s * 0.02 }, end: { x: cx - s * 0.12, y: cy - s * 0.38 }, thickness: 1.3, color })
  page.drawLine({ start: { x: cx - s * 0.12, y: cy - s * 0.38 }, end: { x: cx + s * 0.5, y: cy + s * 0.45 }, thickness: 1.3, color })
}

/** Equis fina (falta). */
export function drawCross(page: PDFPage, cx: number, cy: number, size: number, color = PALETTE.grid) {
  const s = size * 0.3
  page.drawLine({ start: { x: cx - s, y: cy - s }, end: { x: cx + s, y: cy + s }, thickness: 0.8, color })
  page.drawLine({ start: { x: cx - s, y: cy + s }, end: { x: cx + s, y: cy - s }, thickness: 0.8, color })
}

export interface PdfLogo {
  buffer: Buffer
  width: number
  height: number
}

/** Cuadro oscuro con el logo (o el nombre) de la iglesia, como en las hojas impresas. */
export function drawLogoBox(
  page: PDFPage,
  box: { x: number; top: number; w: number; h: number },
  logo: PDFImage | null,
  logoSize: { width: number; height: number } | null,
  name: string,
  fonts: { bold: PDFFont },
  tools: ReturnType<typeof textTools>
) {
  page.drawRectangle({ x: box.x, y: box.top - box.h, width: box.w, height: box.h, color: PALETTE.slate })
  if (logo && logoSize) {
    const scale = Math.min((box.w - 24) / logoSize.width, (box.h - 24) / logoSize.height)
    const w = logoSize.width * scale
    const h = logoSize.height * scale
    page.drawImage(logo, { x: box.x + (box.w - w) / 2, y: box.top - box.h + (box.h - h) / 2, width: w, height: h })
  } else {
    const words = tools.safe(name.toUpperCase(), fonts.bold).split(" ")
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w
      if (fonts.bold.widthOfTextAtSize(test, 11) > box.w - 16 && cur) {
        lines.push(cur)
        cur = w
      } else cur = test
    }
    if (cur) lines.push(cur)
    const startY = box.top - box.h / 2 + ((lines.length - 1) * 14) / 2 - 4
    lines.slice(0, 4).forEach((l, i) => {
      const t = tools.fit(l, fonts.bold, 11, box.w - 12)
      page.drawText(t, { x: box.x + (box.w - fonts.bold.widthOfTextAtSize(t, 11)) / 2, y: startY - i * 14, size: 11, font: fonts.bold, color: PALETTE.white })
    })
  }
}

/** «Etiqueta: ______» con el valor escrito sobre la línea. */
export function drawFieldLine(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  tools: ReturnType<typeof textTools>,
  label: string,
  value: PdfValue,
  x: number,
  y: number,
  width: number,
  size = 9
) {
  const lab = tools.safe(`${label}:`, fonts.bold)
  const lw = fonts.bold.widthOfTextAtSize(lab, size)
  page.drawText(lab, { x, y: y + 2, size, font: fonts.bold, color: PALETTE.ink })
  page.drawLine({ start: { x: x + lw + 3, y }, end: { x: x + width, y }, thickness: 0.7, color: PALETTE.line })
  const v = tools.fit(tools.safe(value, fonts.regular), fonts.regular, size, width - lw - 8)
  if (v) page.drawText(v, { x: x + lw + 6, y: y + 2.5, size, font: fonts.regular, color: PALETTE.slate })
}

export const centeredX = (font: PDFFont, text: string, size: number, x: number, w: number) => x + (w - font.widthOfTextAtSize(text, size)) / 2
