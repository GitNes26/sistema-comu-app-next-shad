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

// Boleto vertical (como los de Ticketmaster o Boletia): cabecera, datos, lugar y, abajo, el talón con el QR.
const W = 820
const H = 1500
const PAD = 44
// Altura donde está la perforación (de ahí hacia abajo es el talón).
const STUB_Y = 1090
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
  const inner = W - PAD * 2
  const used = Boolean(t.checkedInAt)
  const paid = t.status === "paid"

  // Fondo de la hoja y sombra suave del boleto
  ctx.fillStyle = "#e2e8f0"
  ctx.fillRect(0, 0, W + PAD * 2, H + PAD * 2)
  ctx.save()
  ctx.shadowColor = "rgba(15,23,42,0.25)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  rr(ctx, x0, y0, W, H, 36)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.restore()

  ctx.save()
  rr(ctx, x0, y0, W, H, 36)
  ctx.clip()

  // Cabecera con degradado (y flyer si hay)
  const headH = 380
  const grad = ctx.createLinearGradient(x0, y0, x0 + W, y0 + headH)
  grad.addColorStop(0, "#0f172a")
  grad.addColorStop(1, accent)
  ctx.fillStyle = grad
  ctx.fillRect(x0, y0, W, headH)
  if (t.imageUrl) {
    try {
      const img = await loadImage(t.imageUrl, true)
      const r = Math.max(W / img.width, headH / img.height)
      ctx.globalAlpha = 0.35
      ctx.drawImage(img, x0 + (W - img.width * r) / 2, y0 + (headH - img.height * r) / 2, img.width * r, img.height * r)
      ctx.globalAlpha = 1
    } catch {
      /* sin flyer: queda el degradado */
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.07)"
  ctx.beginPath()
  ctx.arc(x0 + W - 60, y0 - 40, 230, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x0 + 80, y0 + headH + 20, 140, 0, Math.PI * 2)
  ctx.fill()

  // Tipo / grupo
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = `700 22px ${FONT}`
  ctx.letterSpacing = "4px"
  ctx.fillText(wrap(ctx, [t.kind, t.groupName].filter(Boolean).join("  ·  ").toUpperCase(), inner, 1)[0], x0 + PAD, y0 + 76)
  ctx.letterSpacing = "0px"

  // Nombre del evento (hasta 3 líneas) y tema
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 62px ${FONT}`
  const nameLines = wrap(ctx, t.eventName, inner, 3)
  nameLines.forEach((l, i) => ctx.fillText(l, x0 + PAD, y0 + 170 + i * 70))
  if (t.topic) {
    ctx.fillStyle = "rgba(255,255,255,0.82)"
    ctx.font = `500 28px ${FONT}`
    ctx.fillText(wrap(ctx, t.topic, inner, 1)[0], x0 + PAD, y0 + 170 + nameLines.length * 70 + 8)
  }

  // Fecha, hora y lugar (en filas)
  const start = new Date(t.startsAt)
  const day = start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const hm = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const time = `${hm(start)}${t.endsAt ? ` – ${hm(new Date(t.endsAt))}` : ""}`
  let y = y0 + headH + 62
  const info = (k: string, v: string, x: number, w: number, lines = 2) => {
    label(ctx, k, x, y)
    ctx.fillStyle = "#0f172a"
    ctx.font = `700 29px ${FONT}`
    wrap(ctx, v, w, lines).forEach((l, i) => ctx.fillText(l, x, y + 40 + i * 36))
  }
  info("Fecha", day.charAt(0).toUpperCase() + day.slice(1), x0 + PAD, inner)
  y += 104
  info("Hora", time, x0 + PAD, 330, 2)
  info("Lugar", t.venue ?? "Por confirmar", x0 + PAD + 360, inner - 360)

  // Lugar asignado: zona, fila y asiento en cajas
  const spot = parseSeatLabel(t.seat)
  const boxY = y + 112
  const boxes: [string, string][] = spot
    ? [...(spot.area ? ([["Zona", spot.area]] as [string, string][]) : []), [spot.kind === "mesa" ? "Mesa" : "Fila", spot.row], [spot.kind === "mesa" ? "Lugar" : "Asiento", spot.seatNo]]
    : [["Lugar", t.seat ?? "Por asignar"]]
  const gap = 16
  const boxW = (inner - gap * (boxes.length - 1)) / boxes.length
  boxes.forEach(([k, v], i) => {
    const bx = x0 + PAD + i * (boxW + gap)
    rr(ctx, bx, boxY, boxW, 128, 22)
    ctx.fillStyle = "#f1f5f9"
    ctx.fill()
    ctx.fillStyle = accent
    rr(ctx, bx, boxY, 9, 128, [22, 0, 0, 22])
    ctx.fill()
    label(ctx, k, bx + 30, boxY + 40)
    ctx.fillStyle = "#0f172a"
    ctx.font = `800 ${v.length > 6 ? 32 : 54}px ${FONT}`
    ctx.fillText(wrap(ctx, v, boxW - 50, 1)[0], bx + 30, boxY + 100)
  })

  // Titular, importe y estado
  const holderY = boxY + 128 + 60
  label(ctx, "Titular", x0 + PAD, holderY)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 32px ${FONT}`
  ctx.fillText(wrap(ctx, t.holder, inner, 1)[0], x0 + PAD, holderY + 42)
  label(ctx, "Importe", x0 + PAD, holderY + 102)
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 32px ${FONT}`
  const priceTxt = t.price > 0 ? money(t.price) : "Sin costo"
  ctx.fillText(priceTxt, x0 + PAD, holderY + 144)
  const statusText = used ? "Entrada registrada" : paid ? (t.price > 0 ? "Pagado" : "Confirmado") : `Saldo ${money(t.balance)}`
  ctx.font = `700 24px ${FONT}`
  const sw = ctx.measureText(statusText).width + 44
  rr(ctx, x0 + W - PAD - sw, holderY + 104, sw, 52, 26)
  ctx.fillStyle = used ? "#e2e8f0" : paid ? "#dcfce7" : "#fef3c7"
  ctx.fill()
  ctx.fillStyle = used ? "#64748b" : paid ? "#15803d" : "#b45309"
  ctx.fillText(statusText, x0 + W - PAD - sw + 22, holderY + 140)

  // Talón: fondo y QR
  const stubY = y0 + STUB_Y
  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(x0, stubY, W, H - STUB_Y)
  const qrData = await QRCode.toDataURL(`comuapp-event:${t.code}`, { width: 560, margin: 1, errorCorrectionLevel: "M" })
  const qr = await loadImage(qrData)
  const qrSize = 250
  const cx = x0 + W / 2
  rr(ctx, cx - qrSize / 2 - 20, stubY + 40, qrSize + 40, qrSize + 40, 24)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.drawImage(qr, cx - qrSize / 2, stubY + 60, qrSize, qrSize)
  ctx.textAlign = "center"
  ctx.fillStyle = "#64748b"
  ctx.font = `600 18px ${FONT}`
  ctx.letterSpacing = "2px"
  ctx.fillText("CÓDIGO DEL BOLETO", cx, stubY + 376)
  ctx.letterSpacing = "6px"
  ctx.fillStyle = "#0f172a"
  ctx.font = `700 44px ${MONO}`
  ctx.fillText(t.folio, cx, stubY + 428)
  ctx.letterSpacing = "0px"
  ctx.fillStyle = "#64748b"
  ctx.font = `500 20px ${FONT}`
  ctx.fillText("Escanea el QR en la entrada o escribe el código", cx, stubY + 466)
  ctx.textAlign = "left"
  ctx.restore()

  // Perforación horizontal: línea punteada y muescas a los lados
  ctx.save()
  ctx.strokeStyle = "#cbd5e1"
  ctx.lineWidth = 3
  ctx.setLineDash([12, 10])
  ctx.beginPath()
  ctx.moveTo(x0 + 34, y0 + STUB_Y)
  ctx.lineTo(x0 + W - 34, y0 + STUB_Y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "#e2e8f0"
  for (const cxn of [x0, x0 + W]) {
    ctx.beginPath()
    ctx.arc(cxn, y0 + STUB_Y, 28, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Sello si ya se usó
  if (used) {
    ctx.save()
    ctx.translate(x0 + W / 2, y0 + STUB_Y - 90)
    ctx.rotate(-0.16)
    ctx.strokeStyle = "rgba(100,116,139,0.6)"
    ctx.lineWidth = 6
    rr(ctx, -160, -44, 320, 88, 14)
    ctx.stroke()
    ctx.fillStyle = "rgba(100,116,139,0.6)"
    ctx.font = `800 40px ${FONT}`
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
