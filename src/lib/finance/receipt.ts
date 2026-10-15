import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { isUniqueViolation } from "@/lib/db"
import { loadLogoPng } from "@/lib/documents/branding"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { amountInWords, receiptFolio } from "@/lib/finance/receipt-rules"

// Recibo de donativo en PDF: folio consecutivo por año, importe con letra, campaña y
// medio. Es un comprobante INTERNO de la iglesia (no es un CFDI). Lo puede descargar
// quien dio y la tesorería; nadie más.

/** Helvetica estándar solo admite Latin-1: lo demás (emojis, comillas tipográficas) se sustituye. */
const safe = (s: string) => s.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'").replace(/[^ -~ -ÿ]/g, "?")

const KIND_LABEL: Record<string, string> = { tithe: "Diezmo", offering: "Ofrenda", donation: "Donativo" }

/** Asigna (una sola vez) el folio del recibo; reintenta si dos confirmaciones chocan. */
export async function ensureReceiptFolio(organizationId: string, donationId: string, paidAt: Date): Promise<string> {
  const current = await prisma.donation.findUnique({ where: { id: donationId }, select: { receiptFolio: true } })
  if (current?.receiptFolio) return current.receiptFolio
  const year = paidAt.getUTCFullYear()
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.donation.count({ where: { organizationId, receiptFolio: { startsWith: `R-${year}-` } } })
    const folio = receiptFolio(year, count + 1 + attempt)
    try {
      await prisma.donation.update({ where: { id: donationId }, data: { receiptFolio: folio } })
      return folio
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const again = await prisma.donation.findUnique({ where: { id: donationId }, select: { receiptFolio: true } })
      if (again?.receiptFolio) return again.receiptFolio
    }
  }
  throw new CrudError("No se pudo asignar el folio del recibo; intenta de nuevo", 500)
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function buildDonationReceipt(actor: Actor, donationId: string): Promise<{ pdf: Buffer; filename: string }> {
  const d = await prisma.donation.findFirst({
    where: { id: donationId, organizationId: actor.organizationId },
    include: { member: { select: { fullName: true } }, campaign: { select: { name: true } } },
  })
  if (!d) throw new CrudError("Donativo no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const isOwner = memberId !== null && d.memberId === memberId
  if (!isOwner && !actor.canManageFinance && !actor.canViewFinance) throw new CrudError("Donativo no encontrado", 404)
  if (d.status !== "paid") throw new CrudError("El recibo se emite cuando el donativo está confirmado", 409)

  const paidAt = d.paidAt ?? d.createdAt
  const folio = await ensureReceiptFolio(actor.organizationId, d.id, paidAt)
  const [org, profile] = await Promise.all([
    prisma.organization.findUnique({ where: { id: actor.organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({
      where: { organizationId: actor.organizationId },
      select: { tradeName: true, legalName: true, taxId: true, logoUrl: true, address: true, city: true, state: true, postalCode: true, phone: true, email: true },
    }),
  ])
  const church = safe(profile?.tradeName ?? org?.name ?? "Iglesia")
  const logo = await loadLogoPng(profile?.logoUrl, 240)
  const amount = Number(d.amount)

  const doc = await PDFDocument.create()
  doc.setTitle(`Recibo de donativo ${folio}`)
  doc.setAuthor(church)
  const page = doc.addPage([612, 792])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.12, 0.14, 0.17)
  const muted = rgb(0.4, 0.43, 0.48)
  const accent = rgb(0.15, 0.47, 0.75)
  const { width } = page.getSize()
  const left = 56
  const right = width - 56
  let y = 740

  // Encabezado
  let x = left
  if (logo) {
    const img = await doc.embedPng(logo.buffer).catch(() => null)
    if (img) {
      const s = Math.min(56 / img.height, 140 / img.width)
      page.drawImage(img, { x, y: y - img.height * s + 10, width: img.width * s, height: img.height * s })
      x += img.width * s + 14
    }
  }
  page.drawText(church, { x, y: y - 6, size: 17, font: bold, color: ink })
  const legal = safe([profile?.legalName, profile?.taxId ? `RFC ${profile.taxId}` : null].filter(Boolean).join(" · "))
  if (legal) page.drawText(legal, { x, y: y - 22, size: 9, font: regular, color: muted })
  const place = safe([profile?.address, profile?.city, profile?.state, profile?.postalCode].filter(Boolean).join(", "))
  if (place) page.drawText(place.slice(0, 95), { x, y: y - 35, size: 8.5, font: regular, color: muted })

  const title = "RECIBO DE DONATIVO"
  page.drawText(title, { x: right - bold.widthOfTextAtSize(title, 13), y: y - 4, size: 13, font: bold, color: accent })
  page.drawText(`Folio ${folio}`, { x: right - bold.widthOfTextAtSize(`Folio ${folio}`, 12), y: y - 22, size: 12, font: bold, color: ink })

  y -= 70
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: accent })

  const row = (label: string, value: string, yy: number) => {
    page.drawText(label.toUpperCase(), { x: left, y: yy, size: 8, font: bold, color: muted })
    page.drawText(safe(value), { x: left + 140, y: yy, size: 11, font: regular, color: ink })
  }
  y -= 34
  row("Fecha", paidAt.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), y)
  y -= 24
  row("Recibimos de", d.member?.fullName ?? d.donorName ?? "Persona anónima", y)
  y -= 24
  row("Concepto", d.campaign?.name ? `${KIND_LABEL[d.kind] ?? "Donativo"} · ${d.campaign.name}` : (KIND_LABEL[d.kind] ?? "Donativo"), y)
  y -= 24
  row("Medio", d.provider ? `En línea (${d.provider})` : "Transferencia bancaria", y)
  if (d.reference) {
    y -= 24
    row("Referencia", d.reference, y)
  }

  // Importe
  y -= 56
  page.drawRectangle({ x: left, y: y - 12, width: right - left, height: 64, color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.8, 0.86, 0.92), borderWidth: 1 })
  page.drawText("IMPORTE", { x: left + 14, y: y + 32, size: 8, font: bold, color: muted })
  const money = amount.toLocaleString("es-MX", { style: "currency", currency: d.currency || "MXN" })
  page.drawText(money, { x: left + 14, y: y + 6, size: 24, font: bold, color: ink })
  const words = wrap(amountInWords(amount), regular, 9.5, 250)
  words.slice(0, 2).forEach((l, i) => page.drawText(l, { x: right - 14 - 250, y: y + 30 - i * 13, size: 9.5, font: regular, color: muted }))

  y -= 62
  const msg = "Gracias por tu generosidad. Tu aportación sostiene la obra y la misión de la iglesia; \"cada uno dé como propuso en su corazón, no con tristeza ni por necesidad, porque Dios ama al dador alegre\" (2 Co 9:7)."
  for (const l of wrap(msg, regular, 10, right - left)) {
    page.drawText(l, { x: left, y, size: 10, font: regular, color: ink })
    y -= 14
  }

  // Pie
  const foot = "Comprobante interno de la iglesia. No es un comprobante fiscal digital (CFDI)."
  page.drawLine({ start: { x: left, y: 90 }, end: { x: right, y: 90 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.85) })
  page.drawText(foot, { x: left, y: 72, size: 8.5, font: regular, color: muted })
  const contact = safe([profile?.phone, profile?.email].filter(Boolean).join("  ·  "))
  if (contact) page.drawText(contact, { x: left, y: 58, size: 8.5, font: regular, color: muted })

  const pdf = Buffer.from(await doc.save())
  return { pdf, filename: `recibo-${folio}.pdf` }
}
