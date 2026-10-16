"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { CalendarDays, Clock, Download, Link2, MapPin, QrCode, Share2, Ticket, User2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseSeatLabel } from "@/lib/events/rules"

// Boleto: cabecera con el evento, perforación con muescas y, abajo, lugar (fila y asiento),
// estado, importe y acciones (compartir, ver el QR, descargarlo). Pensado para el teléfono.

export interface TicketCardProps {
  eventName: string
  kind: string
  topic?: string | null
  startsAt: string
  endsAt?: string | null
  venue?: string | null
  seat?: string | null
  holder: string
  code: string
  price: number
  balance: number
  status: "reserved" | "paid" | "cancelled"
  checkedInAt?: string | null
  groupName?: string | null
  imageUrl?: string | null
}

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const hm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })

function useQr(code: string, width: number) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(`comuapp-event:${code}`, { width, margin: 1, errorCorrectionLevel: "M" })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [code, width])
  return src
}

function Spot({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-background/70 px-3 py-2 text-center ring-1 ring-border">
      <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate font-heading text-2xl leading-tight font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

export function TicketCard(t: TicketCardProps) {
  const [showQr, setShowQr] = useState(false)
  const qr = useQr(t.code, 640)
  const start = new Date(t.startsAt)
  const day = start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
  const used = Boolean(t.checkedInAt)
  const paid = t.status === "paid"
  const folio = t.code.slice(0, 8).toUpperCase()
  const spot = parseSeatLabel(t.seat)
  const status = used ? "Entrada registrada" : paid ? (t.price > 0 ? "Pagado" : "Confirmado") : `Saldo ${money(t.balance)}`
  const mapsHref = t.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.venue)}` : null

  const share = async () => {
    const text = `${t.eventName} · ${day}, ${hm(t.startsAt)}${t.venue ? ` · ${t.venue}` : ""}`
    try {
      if (navigator.share) await navigator.share({ title: t.eventName, text })
      else await navigator.clipboard.writeText(text)
    } catch {
      /* cancelado por la persona */
    }
  }
  const download = () => {
    if (!qr) return
    const a = document.createElement("a")
    a.href = qr
    a.download = `boleto-${folio}.png`
    a.click()
  }

  return (
    <article aria-label={`Boleto para ${t.eventName}`} className={cn("mx-auto w-full max-w-md", used && "opacity-80 grayscale-[0.4]")}>
      {/* Cabecera */}
      <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,black)] p-5 text-primary-foreground">
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full bg-white/10" />
        <p className="relative flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase opacity-90">
          <Ticket className="size-3.5" /> {t.kind}
          {t.groupName ? ` · ${t.groupName}` : ""}
        </p>
        <h3 className="relative mt-1 font-heading text-xl leading-tight font-semibold text-balance sm:text-2xl">{t.eventName}</h3>
        {t.topic && <p className="relative mt-0.5 text-sm opacity-85">{t.topic}</p>}
        <ul className="relative mt-3 space-y-1 text-sm">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 opacity-80" />
            <span className="first-letter:uppercase">{day}</span>
          </li>
          <li className="flex items-center gap-2 tabular-nums">
            <Clock className="size-4 shrink-0 opacity-80" />
            {hm(t.startsAt)}
            {t.endsAt ? ` – ${hm(t.endsAt)}` : ""}
          </li>
          {t.venue && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 opacity-80" />
              <span className="min-w-0 flex-1 truncate">{t.venue}</span>
              {mapsHref && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="press inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                  <Link2 className="size-3" /> Ver mapa
                </a>
              )}
            </li>
          )}
        </ul>
      </div>

      {/* Perforación */}
      <div aria-hidden className="relative h-0 border-t-2 border-dashed border-border">
        <span className="absolute -top-3 -left-3 size-6 rounded-full bg-background ring-1 ring-border" />
        <span className="absolute -top-3 -right-3 size-6 rounded-full bg-background ring-1 ring-border" />
      </div>

      {/* Talón */}
      <div className="space-y-4 rounded-b-3xl border border-t-0 bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Titular</p>
            <p className="flex items-center gap-1.5 font-medium">
              <User2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t.holder}</span>
            </p>
          </div>
          <p className="shrink-0 font-heading text-2xl font-semibold tabular-nums">{t.price > 0 ? money(t.price) : "Gratis"}</p>
        </div>

        {spot ? (
          <dl className={cn("grid gap-2", spot.area ? "grid-cols-3" : "grid-cols-2")}>
            {spot.area && <Spot label="Zona" value={spot.area} />}
            <Spot label={spot.kind === "mesa" ? "Mesa" : "Fila"} value={spot.row} />
            <Spot label={spot.kind === "mesa" ? "Lugar" : "Asiento"} value={spot.seatNo} />
          </dl>
        ) : (
          <p className="rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{t.seat ?? "Lugar por asignar"}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              used ? "bg-muted text-muted-foreground" : paid ? "bg-success/15 text-success-ink" : "bg-warning/20 text-warning-ink"
            )}
          >
            {status}
          </span>
          <span className="font-mono text-xs text-muted-foreground">Folio {folio}</span>
          <span className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => void share()} aria-label="Compartir" className="press grid size-10 place-items-center rounded-full hover:bg-muted">
              <Share2 className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              aria-label="Ver código QR"
              aria-pressed={showQr}
              className={cn("press grid size-10 place-items-center rounded-full hover:bg-muted", showQr && "bg-primary/10 text-primary")}
            >
              <QrCode className="size-5" />
            </button>
            <button type="button" onClick={download} disabled={!qr} aria-label="Descargar código QR" className="press grid size-10 place-items-center rounded-full hover:bg-muted disabled:opacity-40">
              <Download className="size-5" />
            </button>
          </span>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 p-4">
            <div className="rounded-2xl bg-white p-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Código QR de tu boleto" className="size-52 max-w-full" />
              ) : (
                <div className="size-52" aria-busy />
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">Muéstralo en la entrada. No lo compartas.</p>
          </div>
        )}
      </div>
    </article>
  )
}
