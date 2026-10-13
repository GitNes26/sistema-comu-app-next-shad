import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import sharp from "sharp"

// Genera el PDF del diploma: sobre el diseño del sistema o sobre la imagen/PDF que
// subió la escuela, escribiendo el nombre del alumno en una cursiva legible.

export interface DiplomaRenderInput {
  name: string
  serial: string
  issuedAt: Date
  organizationName: string
  schoolName: string
  eventName: string | null
  director: string | null
  subdirector: string | null
  mode: "generated" | "uploaded"
  template: { bytes: Uint8Array; mime: string } | null
  placement: { x: number; y: number; size: number; color: string; showSerial: boolean }
}

const PAGE = { w: 792, h: 612 } // carta horizontal

async function cursiveFont(doc: PDFDocument): Promise<PDFFont> {
  doc.registerFontkit(fontkit)
  const bytes = await readFile(path.join(process.cwd(), "public", "fonts", "diploma", "dancing-script-600.woff"))
  return doc.embedFont(bytes, { subset: true })
}

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const n = m ? parseInt(m[1], 16) : 0x1f2937
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Texto centrado en x; reduce el tamaño para que no pase del ancho máximo. */
function drawCentered(page: PDFPage, font: PDFFont, text: string, cx: number, y: number, size: number, maxWidth: number, color: ReturnType<typeof rgb>) {
  let s = size
  while (s > 8 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1
  const w = font.widthOfTextAtSize(text, s)
  page.drawText(text, { x: cx - w / 2, y, size: s, font, color })
}

export async function renderDiplomaPdf(input: DiplomaRenderInput): Promise<Buffer> {
  const date = input.issuedAt.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })

  if (input.mode === "uploaded" && input.template) {
    let doc: PDFDocument
    let page: PDFPage
    if (input.template.mime === "application/pdf") {
      doc = await PDFDocument.load(input.template.bytes)
      while (doc.getPageCount() > 1) doc.removePage(doc.getPageCount() - 1)
      page = doc.getPage(0)
    } else {
      // pdf-lib solo lee PNG y JPG: cualquier otra imagen se convierte.
      const png = input.template.mime === "image/png" || input.template.mime === "image/jpeg" ? null : await sharp(input.template.bytes).png().toBuffer()
      doc = await PDFDocument.create()
      const img = png
        ? await doc.embedPng(png)
        : input.template.mime === "image/png"
          ? await doc.embedPng(input.template.bytes)
          : await doc.embedJpg(input.template.bytes)
      const width = PAGE.w
      const height = Math.round((img.height / img.width) * width)
      page = doc.addPage([width, height])
      page.drawImage(img, { x: 0, y: 0, width, height })
    }
    const font = await cursiveFont(doc)
    const { width, height } = page.getSize()
    const p = input.placement
    const cx = Math.min(1, Math.max(0, p.x)) * width
    const baseline = height - Math.min(1, Math.max(0, p.y)) * height
    const size = Math.max(10, p.size * width)
    // La posición marcada es el centro del nombre: se baja media altura de letra.
    drawCentered(page, font, input.name, cx, baseline - size * 0.3, size, width * 0.86, hexToRgb(p.color))
    if (p.showSerial) {
      const helv = await doc.embedFont(StandardFonts.Helvetica)
      drawCentered(page, helv, `Folio ${input.serial}`, width / 2, 14, 8, width * 0.5, rgb(0.4, 0.4, 0.4))
    }
    return Buffer.from(await doc.save())
  }

  // Diseño del sistema.
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE.w, PAGE.h])
  const cursive = await cursiveFont(doc)
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const gold = rgb(0.62, 0.42, 0.1)
  const ink = rgb(0.16, 0.16, 0.2)

  page.drawRectangle({ x: 0, y: 0, width: PAGE.w, height: PAGE.h, color: rgb(1, 0.99, 0.96) })
  page.drawRectangle({ x: 24, y: 24, width: PAGE.w - 48, height: PAGE.h - 48, borderColor: gold, borderWidth: 4 })
  page.drawRectangle({ x: 36, y: 36, width: PAGE.w - 72, height: PAGE.h - 72, borderColor: gold, borderWidth: 1 })

  const cx = PAGE.w / 2
  drawCentered(page, sans, input.organizationName.toUpperCase(), cx, 506, 12, PAGE.w - 160, gold)
  drawCentered(page, serifBold, "DIPLOMA", cx, 452, 48, PAGE.w - 160, ink)
  drawCentered(page, serif, "Se otorga a", cx, 408, 16, PAGE.w - 160, rgb(0.35, 0.35, 0.4))
  drawCentered(page, cursive, input.name, cx, 342, 54, PAGE.w - 140, ink)
  page.drawLine({ start: { x: 150, y: 330 }, end: { x: PAGE.w - 150, y: 330 }, thickness: 0.8, color: rgb(0.6, 0.6, 0.6) })
  drawCentered(page, serif, `por haber concluido satisfactoriamente la ${input.schoolName}`, cx, 296, 17, PAGE.w - 160, ink)
  if (input.eventName) drawCentered(page, serif, `y haber participado en «${input.eventName}»`, cx, 272, 15, PAGE.w - 160, rgb(0.3, 0.3, 0.35))
  drawCentered(page, serif, date, cx, 230, 14, PAGE.w - 160, rgb(0.35, 0.35, 0.4))

  for (const [x, who, role] of [
    [PAGE.w * 0.3, input.director, "Director de la escuela"],
    [PAGE.w * 0.7, input.subdirector, "Subdirector"],
  ] as const) {
    page.drawLine({ start: { x: x - 100, y: 140 }, end: { x: x + 100, y: 140 }, thickness: 0.8, color: rgb(0.5, 0.5, 0.5) })
    if (who) drawCentered(page, serif, who, x, 146, 14, 200, ink)
    drawCentered(page, sans, role, x, 124, 9, 200, rgb(0.45, 0.45, 0.5))
  }
  drawCentered(page, sans, `Folio ${input.serial}`, cx, 56, 8, 300, rgb(0.5, 0.5, 0.5))
  return Buffer.from(await doc.save())
}
