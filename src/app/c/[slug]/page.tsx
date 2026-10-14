import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, Clock, ExternalLink, HandHeart, HeartHandshake, MapPin, Phone, Radio, Sparkles, Wifi } from "lucide-react"
import { Logo } from "@/components/layout/logo"
import { PublicTheme } from "@/components/public/public-theme"
import { getPublicChurch } from "@/lib/connect/server"
import { MODALITY, slotRange, type Modality } from "@/lib/connect/rules"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const church = await getPublicChurch((await params).slug)
  if (!church) return { title: "Iglesia no encontrada" }
  return { title: `${church.name} · ¡Bienvenido a casa!`, description: church.tagline ?? church.description ?? undefined }
}

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const isModality = (v: string): v is Modality => v in MODALITY

export default async function PublicChurchPage({ params }: Props) {
  const { slug } = await params
  const church = await getPublicChurch(slug)
  if (!church) notFound()
  const base = `/c/${church.slug}`
  const phoneDigits = (church.phone ?? "").replace(/\D/g, "")
  const byDay = DAYS.map((label, d) => ({ label, d, slots: church.schedule.filter((s) => s.dayOfWeek === d) })).filter((x) => x.slots.length)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicTheme primary={church.hue?.primary} accent={church.hue?.accent} />

      {/* ── Bienvenida ─────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden bg-[oklch(0.24_0.03_250)] text-white">
        {church.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={church.heroImageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-transparent to-[oklch(0.2_0.03_250)]" />
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-14 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 font-heading text-lg font-semibold tracking-tight">
              <Logo size={26} logoUrl={church.logoUrl} className="rounded-lg" />
              {church.name}
            </span>
            <Link href="/auth/login" className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10">
              Entrar a mi espacio
            </Link>
          </div>
          <div className="max-w-2xl animate-rise-in">
            <p className="text-sm font-semibold tracking-[0.18em] text-white/70 uppercase">Iglesia cristiana</p>
            <h1 className="mt-3 font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">¡Bienvenido a casa!</h1>
            {church.tagline && <p className="mt-4 text-lg text-balance text-white/85">{church.tagline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`${base}/conectar?tipo=visitor`} className="press inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-slate-900">
                <Sparkles className="size-5" /> Soy nuevo
              </Link>
              <Link href={`${base}/conectar?tipo=group`} className="press inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-base font-medium hover:bg-white/10">
                <HeartHandshake className="size-5" /> Quiero integrarme
              </Link>
              <Link href={`${base}/conectar?tipo=prayer`} className="press inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-base font-medium hover:bg-white/10">
                <HandHeart className="size-5" /> Necesito oración
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-5 py-12 sm:px-8">
        {/* ── Horarios ─────────────────────────────────────────────── */}
        {byDay.length > 0 && (
          <section aria-labelledby="horarios">
            <h2 id="horarios" className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
              <Clock className="size-6 text-primary" /> Cuándo nos reunimos
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byDay.map((day) => (
                <li key={day.d} className="rounded-2xl border bg-card p-4">
                  <p className="text-sm font-semibold text-primary">{day.label}</p>
                  <ul className="mt-2 space-y-2">
                    {day.slots.map((s) => (
                      <li key={s.id} className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block font-medium">{s.name}</span>
                          {s.description && <span className="block text-xs text-muted-foreground">{s.description}</span>}
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-sm tabular-nums">{slotRange(s.startTime, s.endTime)}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {s.modality !== "in_person" && <Wifi className="size-3" />}
                            {MODALITY[isModality(s.modality) ? s.modality : "in_person"]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Transmisión ──────────────────────────────────────────── */}
        {church.stream && (
          <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-primary/8 p-6 ring-1 ring-primary/20">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Radio className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">{church.stream.status === "live" ? "Estamos en vivo" : "Próxima transmisión"}</p>
              <p className="font-heading text-lg font-semibold">{church.stream.title}</p>
            </div>
            <a href={church.stream.url} target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground">
              Ver ahora <ExternalLink className="size-4" />
            </a>
          </section>
        )}

        {/* ── Pastor ───────────────────────────────────────────────── */}
        {church.pastor.message && (
          <section className="rounded-3xl bg-muted/50 p-7 sm:p-10">
            <blockquote className="font-heading text-xl leading-relaxed font-medium text-balance sm:text-2xl">“{church.pastor.message}”</blockquote>
            {church.pastor.name && <p className="mt-4 text-sm font-medium text-muted-foreground">— {church.pastor.name}</p>}
          </section>
        )}

        {/* ── Eventos ──────────────────────────────────────────────── */}
        {church.events.length > 0 && (
          <section aria-labelledby="eventos">
            <h2 id="eventos" className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
              <CalendarDays className="size-6 text-primary" /> Próximos eventos
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {church.events.map((e) => (
                <li key={e.id} className="rounded-2xl border bg-card p-4">
                  <p className="font-heading font-semibold">{e.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(e.startsAt).toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-medium text-primary">{e.price > 0 ? `$${e.price.toLocaleString("es-MX")}` : "Entrada gratuita"}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Dónde estamos ────────────────────────────────────────── */}
        <section aria-labelledby="donde" className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <h2 id="donde" className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
              <MapPin className="size-6 text-primary" /> Dónde estamos
            </h2>
            {church.address && (
              <p className="mt-3">
                {church.address}
                {church.city ? `, ${church.city}` : ""}
              </p>
            )}
            {church.phone && (
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" /> {church.phone}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {church.mapUrl && (
              <a href={church.mapUrl} target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground">
                <MapPin className="size-4" /> Cómo llegar
              </a>
            )}
            {phoneDigits && (
              <a href={`tel:${phoneDigits}`} className="press inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-medium">
                <Phone className="size-4" /> Llamar
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm sm:px-8">
          <p className="text-muted-foreground">{church.tagline ?? `${church.name} · Familia es lo que somos, comunidad es lo que hacemos.`}</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(church.social).map(([k, v]) => (
              <a key={k} href={v.startsWith("http") ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" className="font-medium capitalize hover:text-primary">
                {k}
              </a>
            ))}
            <Link href="/legal" className="text-muted-foreground hover:text-foreground">
              Aviso de privacidad
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
