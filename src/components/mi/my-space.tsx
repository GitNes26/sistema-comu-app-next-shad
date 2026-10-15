"use client"

import Link from "next/link"
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Church,
  Droplets,
  Flame,
  Globe,
  HandHeart,
  HeartHandshake,
  Home,
  Link2,
  Mail,
  MapPin,
  Network,
  Phone,
  Rocket,
  Sparkles,
  Ticket,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusPill } from "@/components/base"
import { cn } from "@/lib/utils"
import { MINISTRY_ROLE_LABEL } from "@/lib/ministries/rules"
import {
  HIERARCHY_OPTIONS,
  VISION_STAGE_OPTIONS,
} from "@/components/admin/crud/crud-config"
import type { MySpace } from "@/lib/mi/server"
import { PortalHighlights } from "@/components/portal/portal-highlights"
import { WeekRhythm } from "@/components/portal/week-rhythm"
import { GrowthRing } from "@/components/mi/growth-ring"

// Vista de «Mi espacio»: un tablero tipo bento. Arriba quién eres y dónde vas; en medio lo
// que sucede esta semana; abajo dónde sirves, accesos rápidos y tu iglesia.

const STAGE_HINT: Record<string, string> = {
  win: "Conoces a Jesús y das tus primeros pasos con nosotros.",
  consolidate: "Afirmas tu fe y te integras a la congregación.",
  encounter: "Un retiro espiritual para encontrarte con Dios.",
  school: "Cuatro libros de conocimiento y crecimiento espiritual.",
  launch: "Segundo encuentro y graduación de la escuela.",
  leadership: "Ya puedes compartir en las células como líder calificado.",
  discipleship:
    "Reuniones directas con el pastor; ahora te toca discipular a otros.",
}

const HIERARCHY_LABEL = Object.fromEntries(
  HIERARCHY_OPTIONS.map((o) => [o.value, o.label])
)

const SOCIAL_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  spotify: "Spotify",
  x: "X",
}

const SHORTCUTS_LIMIT = 6
const SHORTCUTS: Array<{
  href: string
  label: string
  hint: string
  icon: LucideIcon
  tint: string
}> = [
  {
    href: "/mi/celulas",
    label: "Mi hogar de amor",
    hint: "Tu reunión en casa",
    icon: Home,
    tint: "bg-primary/10 text-primary",
  },
  {
    href: "/mi/familia",
    label: "Mi familia",
    hint: "Y tus hijos en Kids",
    icon: Users,
    tint: "bg-warning/15 text-warning",
  },
  {
    href: "/mi/escuela",
    label: "Escuela",
    hint: "Cursos y trayecto",
    icon: BookOpen,
    tint: "bg-info/15 text-info",
  },
  {
    href: "/mi/eventos",
    label: "Eventos",
    hint: "Aparta tu boleto",
    icon: Ticket,
    tint: "bg-success/15 text-success",
  },
  {
    href: "/mi/calendario",
    label: "Calendario",
    hint: "Todo el año",
    icon: CalendarDays,
    tint: "bg-primary/10 text-primary",
  },
  {
    href: "/mi/donativos",
    label: "Donativos",
    hint: "Diezmos y campañas",
    icon: HandHeart,
    tint: "bg-warning/15 text-warning",
  },
  {
    href: "/mi/oracion",
    label: "Oración",
    hint: "Pide o intercede",
    icon: Sparkles,
    tint: "bg-info/15 text-info",
  },
  {
    href: "/mi/organigrama",
    label: "Organigrama",
    hint: "Quién es quién",
    icon: Network,
    tint: "bg-success/15 text-success",
  },
]

function fmtDate(value: string | null) {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 19) return "Buenas tardes"
  return "Buenas noches"
}

function Milestone({
  icon: Icon,
  label,
  at,
  done,
}: {
  icon: LucideIcon
  label: string
  at: string | null
  done: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        done ? "border-success/30 bg-success/8" : "bg-muted/40"
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          done
            ? "bg-success text-success-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {done ? <Check className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            !done && "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">
          {done ? (fmtDate(at) ?? "Realizado") : "Pendiente"}
        </span>
      </span>
    </div>
  )
}

export function MySpaceView({
  space,
  firstName,
}: {
  space: MySpace
  firstName: string | null
}) {
  const { member, church, stages, ministries } = space
  const currentIndex = member
    ? VISION_STAGE_OPTIONS.findIndex((s) => s.value === member.visionStage)
    : -1
  const reachedAt = new Map(stages.map((s) => [s.stage, s.changedAt]))
  const current = currentIndex >= 0 ? VISION_STAGE_OPTIONS[currentIndex] : null
  const next =
    currentIndex >= 0 && currentIndex < VISION_STAGE_OPTIONS.length - 1
      ? VISION_STAGE_OPTIONS[currentIndex + 1]
      : null
  const progress =
    currentIndex >= 0
      ? Math.round(((currentIndex + 1) / VISION_STAGE_OPTIONS.length) * 100)
      : 0

  return (
    <div className="w-full space-y-5">
      {/* Portada: saludo + quién eres */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-accent to-info/10 p-5 sm:p-7">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-card font-heading text-2xl font-semibold text-primary shadow-sm sm:size-20">
            {member?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.imageUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              (member?.fullName ?? firstName ?? "·").charAt(0).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{greeting()}</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {firstName
                ? `Bienvenido a casa, ${firstName}`
                : "Bienvenido a casa"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Church className="size-4" />
                {church.name}
              </span>
              {member && (
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="size-4" />
                  {HIERARCHY_LABEL[member.hierarchy] ?? member.hierarchy}
                </span>
              )}
              {member?.locationName && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {member.locationName}
                </span>
              )}
            </p>
            {member?.discipleOfName && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Te discipula {member.discipleOfName}
              </p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
            <Link
              href="/mi/ministerios"
              className="press rounded-2xl bg-card/80 px-4 py-2 ring-1 ring-border"
            >
              <span className="block font-heading text-xl font-semibold tabular-nums">
                {ministries.length}
              </span>
              <span className="block text-[0.7rem] text-muted-foreground">
                Ministerios
              </span>
            </Link>
            <div className="rounded-2xl bg-card/80 px-4 py-2 ring-1 ring-border">
              <span className="block font-heading text-xl font-semibold tabular-nums">
                {progress}%
              </span>
              <span className="block text-[0.7rem] text-muted-foreground">
                De tu camino
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {!member ? (
            <Card>
              <CardContent className="flex items-start gap-3 p-5 text-sm">
                <UserRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    Aún no estás en el padrón de la iglesia
                  </p>
                  <p className="text-muted-foreground">
                    Pide en la secretaría que ligue tu cuenta a tu registro para
                    ver tu camino en la visión.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Rocket className="size-4 text-primary" />
                  Mi camino
                </CardTitle>
                <CardDescription>
                  Las etapas de la visión de la iglesia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid items-center gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
                  <GrowthRing
                    stages={VISION_STAGE_OPTIONS.map((s) => ({
                      value: s.value,
                      label: s.label,
                    }))}
                    currentIndex={currentIndex}
                  />
                  <div className="space-y-3">
                    {current && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-primary">
                          Estás aquí
                        </p>
                        <p className="font-heading text-xl font-semibold">
                          {current.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {STAGE_HINT[current.value]}
                        </p>
                      </div>
                    )}
                    {next && (
                      <p className="rounded-2xl bg-primary/8 p-3 text-sm ring-1 ring-primary/15">
                        <span className="font-medium text-primary">
                          Lo que sigue:{" "}
                        </span>
                        {next.label}. {STAGE_HINT[next.value]}
                      </p>
                    )}
                  </div>
                </div>

                <details className="group rounded-2xl border p-3 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                    <span>
                      Mis hitos{" "}
                      <span className="text-muted-foreground">
                        ·{" "}
                        {
                          [
                            member.baptizedWater,
                            !!member.encounterAt,
                            !!member.launchAt,
                            member.baptizedFire,
                          ].filter(Boolean).length
                        }{" "}
                        de 4
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Milestone
                      icon={Droplets}
                      label="Bautismo en aguas"
                      done={member.baptizedWater}
                      at={member.baptizedWaterAt}
                    />
                    <Milestone
                      icon={Sparkles}
                      label="Encuentro con Jesús"
                      done={!!member.encounterAt}
                      at={member.encounterAt}
                    />
                    <Milestone
                      icon={Rocket}
                      label="Lanzamiento"
                      done={!!member.launchAt}
                      at={member.launchAt}
                    />
                    <Milestone
                      icon={Flame}
                      label="Bautismo en fuego"
                      done={member.baptizedFire}
                      at={member.baptizedFireAt}
                    />
                  </div>
                </details>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Ver todas las etapas
                  </summary>
                  <ol className="mt-3 grid gap-1 md:grid-cols-2">
                    {VISION_STAGE_OPTIONS.map((stage, index) => {
                      const done = index < currentIndex
                      const isCurrent = index === currentIndex
                      const at = reachedAt.get(stage.value as never)
                      return (
                        <li
                          key={stage.value}
                          aria-current={isCurrent ? "step" : undefined}
                          className={cn(
                            "flex items-start gap-3 rounded-xl p-2.5",
                            isCurrent && "bg-primary/8 ring-1 ring-primary/30"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                              done || isCurrent
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {done ? <Check className="size-3.5" /> : index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-sm font-medium",
                                !done && !isCurrent && "text-muted-foreground"
                              )}
                            >
                              {stage.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {STAGE_HINT[stage.value]}
                            </span>
                            {at && (done || isCurrent) && (
                              <span className="mt-0.5 block text-[0.7rem] tabular-nums text-muted-foreground/80">
                                {fmtDate(at)}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </details>
              </CardContent>
            </Card>
          )}

          {/* Dónde sirvo */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <HeartHandshake className="size-5 text-primary" />
                  Mis ministerios
                </h2>
                <p className="text-sm text-muted-foreground">
                  {ministries.length === 0
                    ? "Aún no sirves en un ministerio."
                    : "Donde sirves; en cada uno puedes tener un papel distinto."}
                </p>
              </div>
              <Link
                href="/mi/ministerios"
                className="press inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                {ministries.length === 0 ? "Quiero servir" : "Ver todos"}
                <ChevronRight className="size-4" />
              </Link>
            </div>
            {ministries.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ministries.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/mi/ministerios/${m.id}`}
                      className="press flex h-full items-center gap-3 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/40"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <HeartHandshake className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {m.name}
                        </span>
                        <StatusPill
                          tone={
                            m.role === "leader"
                              ? "primary"
                              : m.role === "assistant"
                                ? "info"
                                : "neutral"
                          }
                          dot={false}
                        >
                          {MINISTRY_ROLE_LABEL[m.role]}
                        </StatusPill>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Accesos rápidos */}
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">
              Accesos rápidos
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SHORTCUTS.slice(0, SHORTCUTS_LIMIT).map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="press flex h-full flex-col gap-2 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/40"
                  >
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl",
                        s.tint
                      )}
                    >
                      <s.icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {s.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {s.hint}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <PortalHighlights compact />
          <WeekRhythm compact />
          <details className="group rounded-2xl border bg-card [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-heading text-base font-semibold">
              <Church className="size-4 text-primary" />
              <span className="min-w-0 flex-1 truncate">Mi iglesia</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="space-y-4 p-3 pt-0">
              {church.donations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HandHeart className="size-4 text-primary" />
                      Diezmos y ofrendas
                    </CardTitle>
                    {church.donations.note && (
                      <CardDescription>{church.donations.note}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {(
                        [
                          ["Banco", church.donations.bank],
                          ["Titular", church.donations.holder],
                          ["CLABE", church.donations.clabe],
                          ["Cuenta", church.donations.account],
                          ["Tarjeta", church.donations.card],
                        ] as const
                      )
                        .filter(([, v]) => v)
                        .map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="font-mono tabular-nums">{value}</dd>
                          </div>
                        ))}
                    </dl>
                    {church.donations.link && (
                      <a
                        href={church.donations.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        <Link2 className="size-4" />
                        Dar en línea
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Church className="size-4 text-primary" />
                    {church.name}
                  </CardTitle>
                  {church.description && (
                    <CardDescription>{church.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {church.address && (
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {church.address}
                    </p>
                  )}
                  {church.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-4 shrink-0 text-muted-foreground" />
                      <a
                        href={`tel:${church.phone}`}
                        className="hover:underline"
                      >
                        {church.phone}
                      </a>
                    </p>
                  )}
                  {church.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="size-4 shrink-0 text-muted-foreground" />
                      <a
                        href={`mailto:${church.email}`}
                        className="hover:underline"
                      >
                        {church.email}
                      </a>
                    </p>
                  )}
                  {church.website && (
                    <p className="flex items-center gap-2">
                      <Globe className="size-4 shrink-0 text-muted-foreground" />
                      <a
                        href={church.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {church.website}
                      </a>
                    </p>
                  )}
                  {Object.keys(church.socialLinks).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(church.socialLinks).map(([key, url]) => (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40"
                        >
                          {SOCIAL_LABEL[key] ?? key}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
