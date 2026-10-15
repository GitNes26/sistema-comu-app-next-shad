"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowRight, CalendarDays, Clock, Sparkles, Ticket, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_SECTIONS, filterNavSectionsByUserAndFeature } from "@/lib/nav"
import { apiJson } from "@/lib/ministries/client"
import { slotRange } from "@/lib/connect/rules"

/** Logo de la iglesia, grande y centrado, como fondo tenue del panel. */
export function PanelBackdrop({ logoUrl }: { logoUrl: string | null }) {
  if (!logoUrl) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-contain bg-center bg-no-repeat opacity-[0.06] dark:opacity-[0.08]"
      style={{ backgroundImage: `url("${logoUrl.replace(/"/g, "%22")}")`, backgroundSize: "min(70%, 34rem)" }}
    />
  )
}

// Qué hace cada acceso, en una línea: quien entra sabe a dónde va antes de tocar.
const HINT: Record<string, string> = {
  "/mi": "Tu camino, tus ministerios y lo que sigue",
  "/mi/reuniones": "Pasa lista y consulta las reuniones",
  "/mi/donativos": "Diezmos, ofrendas y campañas",
  "/mi/calendario": "Eventos y reuniones del mes",
  "/mi/eventos": "Tus boletos y próximos eventos",
  "/mi/contenido": "Avisos, devocionales y noticias",
  "/mi/transmisiones": "Servicios en vivo y grabados",
  "/mi/oracion": "Pide oración y ve cómo van",
  "/mi/familia": "Tu familia y tus hijos en Kids",
  "/mi/perfil": "Tus datos de contacto",
  "/mi/notificaciones": "Avisos de tu iglesia",
  "/mi/ministerios": "Donde sirves y tus equipos",
  "/mi/celulas": "Tu hogar de amor o busca uno cerca",
  "/mi/organigrama": "Quién sirve en cada área",
  "/mi/escuela": "Libros, tareas y tu trayecto",
  "/admin/members": "El padrón de la iglesia",
  "/admin/connect": "Visitas, solicitudes y oración",
  "/admin/families": "Quiénes forman cada familia",
  "/admin/employees": "Personal administrativo",
  "/admin/positions": "Puestos y responsabilidades",
  "/admin/ministries": "Ministerios y áreas de servicio",
  "/admin/cells": "Hogares de amor y redes",
  "/admin/finance": "Ingresos, gastos y campañas",
  "/admin/payroll": "Periodos, pagos y recibos",
  "/admin/vehicles": "Bitácora y mantenimiento",
  "/admin/school": "Programas, libros y grupos",
  "/admin/events": "Boletos, acomodo y entrada",
  "/admin/gatherings": "Asistencia por reunión",
  "/admin/reports": "Cifras y comparativos",
  "/admin/content": "Publicaciones y transmisiones",
  "/admin/locations": "Sedes de la iglesia",
  "/admin/settings/appearance": "Colores, letra y tema",
  "/admin/settings/company": "Datos y página pública",
  "/admin/settings/my-plan": "Tu plan y sus funciones",
  "/admin/settings/users": "Personas y permisos",
}

// Cada sección con su tinte: el panel se lee por zonas, no como una lista uniforme.
const TINTS = [
  "from-primary/15 to-primary/5 text-primary",
  "from-warning/20 to-warning/5 text-warning-ink",
  "from-info/20 to-info/5 text-info-ink",
  "from-success/20 to-success/5 text-success-ink",
  "from-accent to-accent/30 text-accent-foreground",
]

const FEATURED = ["/mi", "/mi/calendario", "/mi/oracion", "/mi/familia", "/mi/escuela", "/mi/donativos"]

interface Slot {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  modality: string
}
interface EventRow {
  id: string
  name: string
  startsAt: string
  venueName: string | null
  location: string | null
}

/** Sin permiso para ver las métricas: bienvenida, lo de hoy y accesos por zonas. */
export function QuickAccess({ roleName }: { roleName: string | null }) {
  const { data: session } = useSession()
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [events, setEvents] = useState<EventRow[] | null>(null)

  useEffect(() => {
    apiJson<{ slots: Slot[] }>("/api/portal/week")
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
    apiJson<{ events: EventRow[] }>("/api/events?scope=mine&upcoming=1")
      .then((d) => setEvents(d.events.slice(0, 3)))
      .catch(() => setEvents([]))
  }, [])

  const sections = useMemo(
    () =>
      filterNavSectionsByUserAndFeature(
        { user: { role: session?.user?.role, permissions: session?.user?.permissions, planDenied: session?.user?.planDenied } },
        NAV_SECTIONS
      )
        .map((s) => ({ ...s, items: s.items.filter((i) => i.href && i.href !== "/admin") }))
        .filter((s) => s.items.length > 0),
    [session]
  )
  const all = useMemo(() => sections.flatMap((s) => s.items), [sections])
  const featured = FEATURED.map((h) => all.find((i) => i.href === h)).filter((i): i is NonNullable<typeof i> => Boolean(i)).slice(0, 4)
  const featuredHrefs = new Set(featured.map((i) => i.href))

  const name = session?.user?.name?.split(" ")[0]
  const now = new Date()
  const today = now.getDay()
  const todaySlots = (slots ?? []).filter((s) => s.dayOfWeek === today)
  const dateLabel = now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="space-y-6">
      {/* ── Bienvenida ───────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,black)] p-6 text-primary-foreground sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-14 -right-10 size-64 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/4 size-56 rounded-full bg-white/5" />
        <p className="relative text-xs font-semibold tracking-[0.18em] uppercase opacity-80 first-letter:uppercase">{dateLabel}</p>
        <h2 className="relative mt-1 font-heading text-3xl leading-tight font-semibold sm:text-4xl">{name ? `¡Bienvenido a casa, ${name}!` : "¡Bienvenido a casa!"}</h2>
        <p className="relative mt-1.5 max-w-xl text-sm opacity-90">
          {roleName ? `Entras como ${roleName}. ` : ""}
          Aquí tienes lo de hoy y los accesos de tu rol.
        </p>
      </header>

      {/* ── Lo de hoy ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="hoy" className="rounded-3xl border bg-card p-5">
          <h3 id="hoy" className="flex items-center gap-2 font-heading text-base font-semibold">
            <Clock className="size-5 text-primary" /> Hoy en la iglesia
          </h3>
          {slots === null ? (
            <div className="mt-3 h-16 animate-pulse rounded-2xl bg-muted" />
          ) : todaySlots.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Hoy no hay reuniones programadas. Un buen día para orar y visitar a alguien.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {todaySlots.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-mono text-xs font-semibold text-primary tabular-nums">{s.startTime}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {s.modality !== "in_person" && <Wifi className="size-3" />}
                      {slotRange(s.startTime, s.endTime)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="proximos" className="rounded-3xl border bg-card p-5">
          <h3 id="proximos" className="flex items-center gap-2 font-heading text-base font-semibold">
            <CalendarDays className="size-5 text-primary" /> Próximos eventos
          </h3>
          {events === null ? (
            <div className="mt-3 h-16 animate-pulse rounded-2xl bg-muted" />
          ) : events.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No hay eventos publicados por ahora.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e.id}>
                  <Link href={`/mi/eventos/${e.id}`} className="press flex items-center gap-3 rounded-2xl bg-muted/50 p-3 hover:bg-muted">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <Ticket className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.name}</span>
                      <span className="block truncate text-xs text-muted-foreground first-letter:uppercase">
                        {new Date(e.startsAt).toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {e.venueName || e.location ? ` · ${e.venueName ?? e.location}` : ""}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Accesos principales ──────────────────────────────────── */}
      {featured.length > 0 && (
        <section aria-label="Accesos principales" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {featured.map((i, n) => (
            <Link
              key={i.href}
              href={i.href!}
              className={cn(
                "press group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-4 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transition-none",
                TINTS[n % TINTS.length]
              )}
            >
              <i.icon className="size-7" />
              <span>
                <span className="block font-heading text-base font-semibold text-foreground">{i.label}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{HINT[i.href!] ?? ""}</span>
              </span>
              <ArrowRight className="absolute top-4 right-4 size-4 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          ))}
        </section>
      )}

      {/* ── Todo lo demás, por zonas ─────────────────────────────── */}
      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Tu rol aún no tiene módulos asignados. Pide a un administrador que revise tus permisos.</p>
      ) : (
        <div className="gap-4 space-y-4 md:columns-2 xl:columns-3">
          {sections.map((s, si) => {
            const items = s.items.filter((i) => !featuredHrefs.has(i.href))
            if (items.length === 0) return null
            return (
              <section key={s.title ?? si} className="break-inside-avoid overflow-hidden rounded-3xl border bg-card">
                <h3 className={cn("flex items-center gap-2 bg-gradient-to-r px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase", TINTS[si % TINTS.length])}>
                  <Sparkles className="size-3.5" /> {s.title ?? "Accesos"}
                </h3>
                <ul className="divide-y">
                  {items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href!} className="press group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground/80 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <i.icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{i.label}</span>
                          {HINT[i.href!] && <span className="block truncate text-xs text-muted-foreground">{HINT[i.href!]}</span>}
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
