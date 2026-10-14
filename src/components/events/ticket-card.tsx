"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { CalendarDays, Clock, MapPin, Armchair, Ticket, User2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Boleto con diseño de boleto: cuerpo con los datos del evento y talón con el QR,
// separados por una perforación. Todo lo que trae un boleto: evento, fecha, hora,
// lugar, asiento, titular, folio, importe y estado.

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

function Qr({ code, size }: { code: string; size: number }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(`comuapp-event:${code}`, { width: size * 3, margin: 1, errorCorrectionLevel: "M" })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [code, size])
  if (!src) return <div style={{ width: size, height: size }} aria-busy />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Código QR de tu boleto" width={size} height={size} />
}

export function TicketCard(t: TicketCardProps) {
  const start = new Date(t.startsAt)
  const date = start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const time = start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const used = Boolean(t.checkedInAt)
  const paid = t.status === "paid"
  const folio = t.code.slice(0, 8).toUpperCase()

  return (
    <article
      aria-label={`Boleto para ${t.eventName}`}
      className={cn("relative mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border bg-card shadow-sm sm:flex-row", used && "opacity-80 grayscale-[0.4]")}
    >
      {/* Cuerpo */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-4 p-5 sm:p-6">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
        <header className="space-y-1 pl-2">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.18em] text-primary uppercase">
            <Ticket className="size-3.5" /> {t.kind}
            {t.groupName ? ` · ${t.groupName}` : ""}
          </p>
          <h3 className="font-heading text-2xl leading-tight font-semibold text-balance">{t.eventName}</h3>
          {t.topic && <p className="text-sm text-muted-foreground">{t.topic}</p>}
        </header>

        <dl className="grid gap-x-6 gap-y-3 pl-2 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Fecha</dt>
              <dd className="font-medium first-letter:uppercase">{date}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Hora</dt>
              <dd className="font-medium tabular-nums">
                {time}
                {t.endsAt ? ` – ${new Date(t.endsAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </dd>
            </div>
          </div>
          {t.venue && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Lugar</dt>
                <dd className="font-medium">{t.venue}</dd>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Armchair className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Asiento</dt>
              <dd className="font-medium">{t.seat ?? "Por asignar"}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Titular</dt>
              <dd className="font-medium">{t.holder}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center text-xs font-bold text-muted-foreground">$</span>
            <div>
              <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Importe</dt>
              <dd className="font-medium tabular-nums">{t.price > 0 ? money(t.price) : "Entrada libre"}</dd>
            </div>
          </div>
        </dl>

        <footer className="flex flex-wrap items-center gap-2 pl-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              used ? "bg-muted text-muted-foreground" : paid ? "bg-success/15 text-success-ink" : "bg-warning/20 text-warning-ink"
            )}
          >
            {used ? "Entrada registrada" : paid ? (t.price > 0 ? "Pagado" : "Confirmado") : `Saldo ${money(t.balance)}`}
          </span>
          <span className="font-mono text-xs text-muted-foreground">Folio {folio}</span>
        </footer>
      </div>

      {/* Perforación */}
      <div aria-hidden className="relative sm:w-0">
        <div className="mx-5 border-t-2 border-dashed border-border sm:mx-0 sm:h-full sm:border-t-0 sm:border-l-2" />
        <span className="absolute -top-3 -left-3 hidden size-6 rounded-full bg-background ring-1 ring-border sm:block sm:-top-3 sm:left-[-0.75rem]" />
        <span className="absolute -bottom-3 -left-3 hidden size-6 rounded-full bg-background ring-1 ring-border sm:block" />
        <span className="absolute -top-3 left-[-0.75rem] size-6 rounded-full bg-background ring-1 ring-border sm:hidden" />
        <span className="absolute -top-3 right-[-0.75rem] size-6 rounded-full bg-background ring-1 ring-border sm:hidden" />
      </div>

      {/* Talón con QR */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-2 bg-muted/40 p-5 sm:w-52">
        <div className="rounded-2xl bg-white p-2">
          <Qr code={t.code} size={148} />
        </div>
        <p className="text-center text-[0.7rem] text-muted-foreground">Muéstralo en la entrada</p>
      </div>
    </article>
  )
}
