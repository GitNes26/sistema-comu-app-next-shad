"use client"

import Link from "next/link"
import { Check, ChevronRight, Droplets, Flame, Globe, Mail, MapPin, Phone, HandHeart, HeartHandshake, Link2, UserRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusPill } from "@/components/base"
import { cn } from "@/lib/utils"
import { MINISTRY_ROLE_LABEL } from "@/lib/ministries/rules"
import { HIERARCHY_OPTIONS, VISION_STAGE_OPTIONS } from "@/components/admin/crud/crud-config"
import type { MySpace } from "@/lib/mi/server"
import { PortalHighlights } from "@/components/portal/portal-highlights"

// Vista de «Mi espacio». Móvil primero: una sola columna, tarjetas planas.

const STAGE_HINT: Record<string, string> = {
  win: "Conoces a Jesús y das tus primeros pasos con nosotros.",
  consolidate: "Afirmas tu fe y te integras a la congregación.",
  encounter: "Un retiro espiritual para encontrarte con Dios.",
  school: "Cuatro libros de conocimiento y crecimiento espiritual.",
  launch: "Segundo encuentro y graduación de la escuela.",
  leadership: "Ya puedes compartir en las células como líder calificado.",
  discipleship: "Reuniones directas con el pastor; ahora te toca discipular a otros.",
}

const HIERARCHY_LABEL = Object.fromEntries(HIERARCHY_OPTIONS.map((o) => [o.value, o.label]))

const SOCIAL_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  spotify: "Spotify",
  x: "X",
}

function fmtDate(value: string | null) {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

export function MySpaceView({ space, firstName }: { space: MySpace; firstName: string | null }) {
  const { member, church, stages, ministries } = space
  const currentIndex = member ? VISION_STAGE_OPTIONS.findIndex((s) => s.value === member.visionStage) : -1
  const reachedAt = new Map(stages.map((s) => [s.stage, s.changedAt]))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {firstName ? `Hola, ${firstName}` : "Bienvenido"}
        </h1>
        <p className="text-sm text-muted-foreground">Tu espacio en {church.name}.</p>
      </div>

      <PortalHighlights />

      {!member ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <UserRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Aún no estás en el padrón de la iglesia</p>
              <p className="text-muted-foreground">
                Pide en la secretaría que ligue tu cuenta a tu registro para ver tu camino en la visión.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 font-heading text-lg font-semibold text-primary">
                {member.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-base font-semibold">{member.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {HIERARCHY_LABEL[member.hierarchy] ?? member.hierarchy}
                  {member.locationName ? ` · ${member.locationName}` : ""}
                </p>
                {member.discipleOfName && (
                  <p className="text-xs text-muted-foreground">Te discipula {member.discipleOfName}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mi camino</CardTitle>
              <CardDescription>Las etapas de la visión de la iglesia.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {VISION_STAGE_OPTIONS.map((stage, index) => {
                  const done = index < currentIndex
                  const current = index === currentIndex
                  const at = reachedAt.get(stage.value as never)
                  return (
                    <li
                      key={stage.value}
                      aria-current={current ? "step" : undefined}
                      className={cn("flex items-start gap-3 rounded-xl p-2.5", current && "bg-primary/8 ring-1 ring-primary/30")}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          done && "bg-primary text-primary-foreground",
                          current && "bg-primary text-primary-foreground",
                          !done && !current && "bg-muted text-muted-foreground"
                        )}
                      >
                        {done ? <Check className="size-3.5" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-medium", !done && !current && "text-muted-foreground")}>
                          {stage.label}
                          {current && <span className="ml-2 text-xs font-normal text-primary">Estás aquí</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{STAGE_HINT[stage.value]}</span>
                        {at && (done || current) && (
                          <span className="mt-0.5 block text-[0.7rem] tabular-nums text-muted-foreground/80">
                            {fmtDate(at)}
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone={member.baptizedWater ? "success" : "neutral"} dot={false}>
                  <Droplets className="mr-1 size-3.5" />
                  Bautismo en aguas{member.baptizedWater && member.baptizedWaterAt ? ` · ${fmtDate(member.baptizedWaterAt)}` : ""}
                </StatusPill>
                <StatusPill tone={member.encounterAt ? "success" : "neutral"} dot={false}>
                  Encuentro con Jesús{member.encounterAt ? ` · ${fmtDate(member.encounterAt)}` : ""}
                </StatusPill>
                <StatusPill tone={member.launchAt ? "success" : "neutral"} dot={false}>
                  Lanzamiento{member.launchAt ? ` · ${fmtDate(member.launchAt)}` : ""}
                </StatusPill>
                <StatusPill tone={member.baptizedFire ? "success" : "neutral"} dot={false}>
                  <Flame className="mr-1 size-3.5" />
                  Bautismo en fuego{member.baptizedFire && member.baptizedFireAt ? ` · ${fmtDate(member.baptizedFireAt)}` : ""}
                </StatusPill>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="size-4 text-primary" />
            Mis ministerios
          </CardTitle>
          <CardDescription>
            {ministries.length === 0
              ? "Aún no sirves en un ministerio."
              : "Donde sirves; puedes estar en varios con un papel distinto en cada uno."}
          </CardDescription>
        </CardHeader>
        {ministries.length > 0 && (
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {ministries.map((m) => (
                <li key={m.id}>
                  <Link href={`/mi/ministerios/${m.id}`} className="flex min-h-12 items-center gap-3 px-3 text-sm hover:bg-muted">
                    <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                    <StatusPill tone={m.role === "leader" ? "primary" : m.role === "assistant" ? "info" : "neutral"} dot={false}>
                      {MINISTRY_ROLE_LABEL[m.role]}
                    </StatusPill>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {church.donations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HandHeart className="size-4 text-primary" />
              Diezmos y ofrendas
            </CardTitle>
            {church.donations.note && <CardDescription>{church.donations.note}</CardDescription>}
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
                    <dt className="text-xs text-muted-foreground">{label}</dt>
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
          <CardTitle className="text-base">{church.name}</CardTitle>
          {church.description && <CardDescription>{church.description}</CardDescription>}
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
              <a href={`tel:${church.phone}`} className="hover:underline">
                {church.phone}
              </a>
            </p>
          )}
          {church.email && (
            <p className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <a href={`mailto:${church.email}`} className="hover:underline">
                {church.email}
              </a>
            </p>
          )}
          {church.website && (
            <p className="flex items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <a href={church.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
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
  )
}
