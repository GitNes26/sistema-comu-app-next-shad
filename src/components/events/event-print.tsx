"use client"

import { useEffect, useMemo, useState } from "react"
import { Lock, Printer, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SwitchField } from "@/components/base/switch-field"
import type { EventDetailDto } from "@/lib/events/server"
import { SeatLegend, SeatMap } from "./seat-map"
import { cn } from "@/lib/utils"

// Hoja para imprimir o guardar como PDF (desde el diálogo de impresión del navegador):
// flyer, información general, resumen, itinerario y plano de lugares. Hay dos versiones:
// «Público» (solo lo que puede ver cualquiera) y «Organizadores y servidores» (incluye lo interno).

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const dateLong = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const hm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
const KIND = { activity: "Actividad", clinic: "Clínica", break: "Pausa", meal: "Comida" } as const
const AUDIENCE = { open: "Abierto a toda la iglesia", leaders: "Solo líderes", ministries: "Ministerios seleccionados" } as const

type Audience = "public" | "internal"

export function EventPrintSheet({ event, onClose }: { event: EventDetailDto; onClose: () => void }) {
  const internalAllowed = event.access.internalView
  const [audience, setAudience] = useState<Audience>("public")
  const [flyer, setFlyer] = useState(true)
  const [info, setInfo] = useState(true)
  const [summary, setSummary] = useState(true)
  const [itinerary, setItinerary] = useState(true)
  const [plan, setPlan] = useState(true)
  const [occupied, setOccupied] = useState(false)
  const internal = internalAllowed && audience === "internal"

  // La hoja siempre sale en claro (aunque la app esté en modo oscuro) y solo ella se imprime.
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.remove("dark")
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      if (wasDark) root.classList.add("dark")
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const items = useMemo(() => event.itinerary.filter((i) => internal || i.isPublic), [event.itinerary, internal])
  const hasPlan = event.seating === "seats" && event.plan
  const canMoney = event.access.canManage && internal
  const taken = useMemo(() => new Set(event.plan?.takenSeats ?? []), [event.plan])
  const sectionsOn = [flyer, info, summary && internal, itinerary && items.length > 0, plan && hasPlan]

  return (
    <div className="print-root fixed inset-0 z-[200] overflow-auto bg-neutral-100 text-neutral-900">
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root { position: absolute !important; inset: 0 !important; overflow: visible !important; background: #fff !important; }
          .print-hide { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; border: 0 !important; width: auto !important; min-height: 0 !important; }
          .print-sheet { padding: 0 !important; gap: 0 !important; }
          .print-break { break-before: page; }
          .print-avoid { break-inside: avoid; }
          @page { size: A4; margin: 14mm; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Controles (no se imprimen) */}
      <div className="print-hide sticky top-0 z-10 border-b bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold">Imprimir o exportar</p>
            <p className="text-xs text-neutral-500">Elige qué incluir y usa «Imprimir» → «Guardar como PDF».</p>
          </div>
          {internalAllowed && (
            <div role="radiogroup" aria-label="Para quién es" className="flex rounded-xl bg-neutral-200 p-1 text-sm font-medium">
              {(
                [
                  ["public", "Público"],
                  ["internal", "Organizadores y servidores"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={audience === k} onClick={() => setAudience(k)} className={cn("press rounded-lg px-3 py-1.5", audience === k ? "bg-white shadow-sm" : "text-neutral-600")}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <Button onClick={() => window.print()} disabled={!sectionsOn.some(Boolean)}>
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        <div className="mx-auto mt-3 grid max-w-5xl gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <SwitchField label="Flyer" checked={flyer} onCheckedChange={setFlyer} border={false} />
          <SwitchField label="Información general" checked={info} onCheckedChange={setInfo} border={false} />
          {internal && <SwitchField label="Resumen del evento" checked={summary} onCheckedChange={setSummary} border={false} />}
          <SwitchField label="Itinerario" checked={itinerary} onCheckedChange={setItinerary} border={false} />
          {hasPlan && <SwitchField label="Plano de lugares" checked={plan} onCheckedChange={setPlan} border={false} />}
          {hasPlan && internal && plan && <SwitchField label="Marcar lugares ocupados" checked={occupied} onCheckedChange={setOccupied} border={false} />}
        </div>
      </div>

      <div className="print-sheet mx-auto flex max-w-[210mm] flex-col gap-6 p-4 sm:p-8">
        {flyer && <Flyer event={event} />}

        {info && (
          <Page breakBefore={flyer} title="Información general">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Evento" value={event.name} />
              {event.topic && <Row label="Tema" value={event.topic} />}
              <Row label="Tipo" value={[event.kind, event.groupName].filter(Boolean).join(" · ")} />
              <Row label="Fecha" value={dateLong(event.startsAt)} />
              <Row label="Horario" value={`${hm(event.startsAt)}${event.endsAt ? ` – ${hm(event.endsAt)}` : ""}`} />
              <Row label="Lugar" value={[event.venueName, event.location].filter(Boolean).join(" · ") || "Por confirmar"} />
              <Row label="Costo" value={event.price > 0 ? `${money(event.price)} por boleto` : "Sin costo"} />
              {event.effectiveCapacity ? <Row label="Cupo" value={`${event.effectiveCapacity} lugares`} /> : null}
              {internal && <Row label="Público" value={AUDIENCE[event.audience]} />}
              {event.seating !== "free" && <Row label="Acomodo" value={event.seating === "seats" ? "Asientos o mesas numerados" : "Por secciones"} />}
            </dl>
            {event.description && <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-neutral-700">{event.description}</p>}
          </Page>
        )}

        {summary && internal && (
          <Page title="Resumen del evento">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Boletos" value={event.stats.taken} />
              <Stat label="Pagados" value={event.stats.paid} />
              <Stat label="Apartados" value={event.stats.reserved} />
              <Stat label="Han entrado" value={event.stats.checkedIn} />
              {canMoney && <Stat label="Cobrado" value={money(event.stats.collected)} />}
              {canMoney && <Stat label="Por cobrar" value={money(event.stats.pending)} />}
              {canMoney && <Stat label="Gastos" value={money(event.stats.expenses)} />}
              {canMoney && <Stat label="Resultado" value={money(event.stats.net)} />}
            </ul>
            {event.sections.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-neutral-500 uppercase">
                    <th className="py-1.5">Sección</th>
                    <th className="py-1.5 text-right">Ocupados</th>
                    <th className="py-1.5 text-right">Cupo</th>
                  </tr>
                </thead>
                <tbody>
                  {event.sections.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="py-1.5">{s.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.taken}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Page>
        )}

        {itinerary && items.length > 0 && (
          <Page title="Itinerario">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-neutral-500 uppercase">
                  <th className="w-24 py-1.5">Hora</th>
                  <th className="py-1.5">Actividad</th>
                  <th className="py-1.5">Quién</th>
                  <th className="py-1.5">Lugar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const end = new Date(new Date(i.startsAt).getTime() + i.durationMin * 60000).toISOString()
                  return (
                    <tr key={i.id} className="print-avoid border-b align-top">
                      <td className="py-2 font-medium tabular-nums">
                        {hm(i.startsAt)} – {hm(end)}
                      </td>
                      <td className="py-2">
                        <span className="font-medium">{i.title}</span>
                        <span className="ml-1.5 text-xs text-neutral-500">{KIND[i.kind]}</span>
                        {internal && !i.isPublic && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Lock className="size-2.5" /> Interno
                          </span>
                        )}
                        {internal && i.notes && <span className="mt-0.5 block text-xs text-neutral-600">{i.notes}</span>}
                      </td>
                      <td className="py-2">{i.speakerName ?? "—"}</td>
                      <td className="py-2">{i.location ?? "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Page>
        )}

        {plan && hasPlan && event.plan && (
          <Page breakBefore title="Plano de lugares" subtitle={event.venueName ?? undefined}>
            <SeatMap width={event.plan.width} height={event.plan.height} layout={event.plan.layout} taken={internal && occupied ? taken : undefined} zoomable={false} showAxes className="border-neutral-300" />
            <div className="mt-3">
              <SeatLegend sections={event.plan.layout.sections} />
            </div>
            <p className="mt-2 text-xs text-neutral-500">Las letras son las filas y los números son los asientos de cada fila.</p>
          </Page>
        )}
      </div>
    </div>
  )
}

function Page({ title, subtitle, breakBefore, children }: { title: string; subtitle?: string; breakBefore?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("print-page print-avoid rounded-2xl border bg-white p-6 shadow-sm", breakBefore && "print-break")}>
      <header className="mb-4 border-b pb-2">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{label}</dt>
      <dd className="font-medium first-letter:uppercase">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <li className="rounded-xl border bg-neutral-50 p-3">
      <p className="font-heading text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </li>
  )
}

/** Cartel del evento: imagen o fondo de color con nombre, fecha, hora y lugar. */
function Flyer({ event }: { event: EventDetailDto }) {
  return (
    <section className="print-page print-avoid overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="relative flex min-h-[250mm] flex-col justify-end overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a] p-8 text-white">
        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="relative space-y-3">
          <p className="text-sm font-semibold tracking-[0.25em] uppercase opacity-90">{[event.kind, event.groupName].filter(Boolean).join(" · ")}</p>
          <h1 className="font-heading text-5xl leading-[1.05] font-bold text-balance">{event.name}</h1>
          {event.topic && <p className="text-xl opacity-90">{event.topic}</p>}
          <div className="mt-4 grid gap-2 border-t border-white/30 pt-4 text-lg">
            <p className="font-semibold first-letter:uppercase">{dateLong(event.startsAt)}</p>
            <p>
              {hm(event.startsAt)}
              {event.endsAt ? ` – ${hm(event.endsAt)}` : ""}
              {" · "}
              {[event.venueName, event.location].filter(Boolean).join(" · ") || "Lugar por confirmar"}
            </p>
            <p className="text-base opacity-90">{event.price > 0 ? `Boleto ${money(event.price)}` : "Entrada sin costo"}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
