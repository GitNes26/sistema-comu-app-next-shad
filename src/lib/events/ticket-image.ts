// Boleto como imagen (PNG): diseño de boleto con evento, fecha, lugar, titular, importe y QR.
// Se dibuja en un <canvas> del navegador, así que no necesita servidor.

import QRCode from "qrcode"
import { parseSeatLabel } from "@/lib/events/rules"

export interface TicketImageData {
  eventName: string
  kind: string
  groupName?: string | null
  topic?: string | null
  startsAt: string
  endsAt?: string | null
  venue?: string | null
  /** Etiqueta legible del lugar («Platea · Fila B · asiento 4»). */
  seat?: string | null
  holder: string
  /** Valor del QR (secreto del boleto). */
  code: string
  /** Código corto que también se puede escribir en la puerta. */
  folio: string
  price: number
  status: "reserved" | "paid" | "cancelled"
  balance: number
  checkedInAt?: string | null
  /** Color de acento (por defecto, azul). */
  accent?: string
  /** Flyer opcional: se usa de fondo de la cabecera. */
  imageUrl?: string | null
}

const W = 1600
const H = 660
const PAD = 44
const STUB_X = 1100
const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif'
const MONO = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace'

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })

function loadImage(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cors) img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  ctx.lineTo(x, y + tl)
  ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

/** Parte un texto en líneas que caben en `maxW`; recorta con «…» si pasa de `maxLines`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width <= maxW || !cur) cur = test
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#64748b") {
  ctx.fillStyle = color
  ctx.font = `600 18px ${FONT}`
  ctx.textBaseline = "alphabetic"
  // espaciado entre letras para las etiquetas pequeñas
  ctx.letterSpacing = "2px"
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.letterSpacing = "0px"
}

export async function renderTicketPng(t: TicketImageData): Promise<Blob> {
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = (W + PAD * 2) * scale
  canvas.height = (H + PAD * 2) * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo preparar la imagen")
  ctx.scale(scale, scale)
  const accent = t.accent ?? "#1d4ed8"
  const x0 = PAD
  const y0 = PAD
  const used = Boolean(t.checkedInAt)
  const paid = t.status === "paid"

  // Fondo de la hoja y sombra suave del boleto
  ctx.fillStyle = "#e2e8f0"
  ctx.fillRect(0, 0, W + PAD * 2, H + PAD * 2)
  ctx.save()
  ctx.shadowColor = "rgba(15,23,42,0.25)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  rr(ctx, x0, y0, W, H, 32)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.restore()

  // Cuerpo recortado con esquinas redondeadas
  ctx.save()
  rr(ctx, x0, y0, W, H, 32)
  ctx.clip()

  // Cabecera con degradado (y flyer si hay)
  const headH = 250
  const grad = ctx.createLinearGradient(x0, y0, x0 + STUB_X, y0 + headH)
  grad.addColorStop(0, "#0f172a")
  grad.addColorStop(1, accent)
  ctx.fillStyle = grad
  ctx.fillRect(x0, y0, STUB_X, headH)
  if (t.imageUrl) {
    try {
      const img = await loadImage(t.imageUrl, true)
      const r = Math.max(STUB_X / img.width, headH / img.height)
      ctx.globalAlpha = 0.35
      ctx.drawImage(img, x0 + (STUB_X - img.width * r) / 2, y0 + (headH - img.height * r) / 2, img.width * r, img.height * r)
      ctx.globalAlpha = 1
    } catch {
      /* sin flyer: queda el degradado */
    }
  }
  // Círculos decorativos
  ctx.fillStyle = "rgba(255,255,255,0.07)"
  ctx.beginPath()
  ctx.arc(x0 + STUB_X - 40, y0 - 30, 190, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x0 + STUB_X - 260, y0 + headH + 30, 120, 0, Math.PI * 2)
  ctx.fill()

  // Tipo / grupo
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = `700 20px ${FONT}`
  ctx.letterSpacing = "4px"
  ctx.fillText([t.kind, t.groupName].filter(Boolean).join("  ·  ").toUpperCase(), x0 + PAD, y0 + 58)
  ctx.letterSpacing = "0px"

  // Nombre del evento
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 54px ${FONT}`
  const nameLines = wrap(ctx, t.eventName, STUB_X - PAD * 2, 2)
  nameLines.forEach((l, i) => ctx.fillText(l, x0 + PAD, y0 + 128 + i * 60))
  if (t.topic) {
    ctx.fillStyle = "rgba(255,255,255,0.8)"
    ctx.font = `500 26px ${FONT}`
    ctx.fillText(wrap(ctx, t.topic, STUB_X - PAD * 2, 1)[0], x0 + PAD, y0 + (nameLines.length > 1 ? 128 + 60 + 40 : 128 + 44))
  }

  // Fecha, hora y lugar
  const start = new Date(t.startsAt)
  const day = start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const hm = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const time = `${hm(start)}${t.endsAt ? ` – ${hm(new Date(t.endsAt))}` : ""}`
  const infoY = y0 + headH + 50
  label(ctx, "Fecha", x0 + PAD, infoY)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 28px ${FONT}`
  wrap(ctx, day.charAt(0).toUpperCase() + day.slice(1), 380, 2).forEach((l, i) => ctx.fillText(l, x0 + PAD, infoY + 38 + i * 34))
  label(ctx, "Hora", x0 + 470, infoY)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 26px ${FONT}`
  wrap(ctx, time, 280, 2).forEach((l, i) => ctx.fillText(l, x0 + 470, infoY + 38 + i * 32))
  label(ctx, "Lugar", x0 + 790, infoY)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 26px ${FONT}`
  wrap(ctx, t.venue ?? "Por confirmar", STUB_X - 790 - PAD + 10, 2).forEach((l, i) => ctx.fillText(l, x0 + 790, infoY + 38 + i * 32))

  // Lugar asignado: zona, fila y asiento en cajas
  const spot = parseSeatLabel(t.seat)
  const boxY = infoY + 120
  const boxes: [string, string][] = spot
    ? [...(spot.area ? ([["Zona", spot.area]] as [string, string][]) : []), [spot.kind === "mesa" ? "Mesa" : "Fila", spot.row], [spot.kind === "mesa" ? "Lugar" : "Asiento", spot.seatNo]]
    : [["Lugar", t.seat ?? "Por asignar"]]
  let bx = x0 + PAD
  const boxW = spot ? (spot.area ? 230 : 190) : 420
  for (const [k, v] of boxes) {
    rr(ctx, bx, boxY, boxW, 108, 20)
    ctx.fillStyle = "#f1f5f9"
    ctx.fill()
    ctx.fillStyle = accent
    rr(ctx, bx, boxY, 8, 108, [20, 0, 0, 20])
    ctx.fill()
    label(ctx, k, bx + 28, boxY + 34)
    ctx.fillStyle = "#0f172a"
    ctx.font = `800 ${v.length > 6 ? 30 : 44}px ${FONT}`
    ctx.fillText(wrap(ctx, v, boxW - 48, 1)[0], bx + 28, boxY + 82)
    bx += boxW + 18
  }

  // Titular, importe y estado
  const footY = y0 + H - 50
  label(ctx, "Titular", x0 + PAD, footY - 40)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 30px ${FONT}`
  ctx.fillText(wrap(ctx, t.holder, 520, 1)[0], x0 + PAD, footY)
  label(ctx, "Importe", x0 + 620, footY - 40)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 30px ${FONT}`
  ctx.fillText(t.price > 0 ? money(t.price) : "Sin costo", x0 + 620, footY)
  const statusText = used ? "Entrada registrada" : paid ? (t.price > 0 ? "Pagado" : "Confirmado") : `Saldo ${money(t.balance)}`
  const statusColor = used ? "#64748b" : paid ? "#15803d" : "#b45309"
  ctx.font = `700 22px ${FONT}`
  const sw = ctx.measureText(statusText).width + 40
  rr(ctx, x0 + STUB_X - PAD - sw, footY - 34, sw, 48, 24)
  ctx.fillStyle = used ? "#e2e8f0" : paid ? "#dcfce7" : "#fef3c7"
  ctx.fill()
  ctx.fillStyle = statusColor
  ctx.fillText(statusText, x0 + STUB_X - PAD - sw + 20, footY)

  // Talón: fondo, perforación y QR
  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(x0 + STUB_X, y0, W - STUB_X, H)
  const qrData = await QRCode.toDataURL(`comuapp-event:${t.code}`, { width: 560, margin: 1, errorCorrectionLevel: "M" })
  const qr = await loadImage(qrData)
  const qrSize = 330
  const cx = x0 + STUB_X + (W - STUB_X) / 2
  rr(ctx, cx - qrSize / 2 - 22, y0 + 64, qrSize + 44, qrSize + 44, 24)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.drawImage(qr, cx - qrSize / 2, y0 + 86, qrSize, qrSize)
  ctx.textAlign = "center"
  ctx.fillStyle = "#64748b"
  ctx.font = `600 18px ${FONT}`
  ctx.letterSpacing = "2px"
  ctx.fillText("CÓDIGO DEL BOLETO", cx, y0 + 482)
  ctx.letterSpacing = "6px"
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 46px ${MONO}`
  ctx.fillText(t.folio, cx, y0 + 538)
  ctx.letterSpacing = "0px"
  ctx.fillStyle = "#64748b"
  ctx.font = `500 20px ${FONT}`
  ctx.fillText("Escanea el QR en la entrada", cx, y0 + 584)
  ctx.fillText("o escribe el código", cx, y0 + 610)
  ctx.textAlign = "left"
  ctx.restore()

  // Perforación: línea punteada y muescas
  ctx.save()
  ctx.strokeStyle = "#cbd5e1"
  ctx.lineWidth = 3
  ctx.setLineDash([12, 10])
  ctx.beginPath()
  ctx.moveTo(x0 + STUB_X, y0 + 30)
  ctx.lineTo(x0 + STUB_X, y0 + H - 30)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "#e2e8f0"
  for (const cy of [y0, y0 + H]) {
    ctx.beginPath()
    ctx.arc(x0 + STUB_X, cy, 26, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Sello si ya se usó
  if (used) {
    ctx.save()
    ctx.translate(x0 + 800, y0 + 480)
    ctx.rotate(-0.18)
    ctx.strokeStyle = "rgba(100,116,139,0.6)"
    ctx.lineWidth = 6
    rr(ctx, -150, -42, 300, 84, 14)
    ctx.stroke()
    ctx.fillStyle = "rgba(100,116,139,0.6)"
    ctx.font = `800 38px ${FONT}`
    ctx.textAlign = "center"
    ctx.fillText("UTILIZADO", 0, 14)
    ctx.restore()
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), "image/png"))
}

/** Descarga el boleto como imagen. */
export async function downloadTicketPng(t: TicketImageData) {
  const blob = await renderTicketPng(t)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `boleto-${t.folio}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
