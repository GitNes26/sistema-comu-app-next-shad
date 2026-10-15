import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { CalendarDays, ChevronRight, Crown, HandHeart, HeartHandshake, Users } from "lucide-react"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { listMyMinistries } from "@/lib/ministries/server"
import { MINISTRY_ROLE_LABEL } from "@/lib/ministries/rules"
import { Card, CardContent } from "@/components/ui/card"
import { NoMinistries } from "@/components/mi/no-ministries"
import { StatusPill } from "@/components/base"
import { JoinMinistries } from "@/components/portal/join-ministries"

export const metadata: Metadata = { title: "Mis ministerios" }

const COVERS = [
  "from-primary/25 to-primary/5",
  "from-info/25 to-info/5",
  "from-warning/25 to-warning/5",
  "from-success/25 to-success/5",
]

export default async function MyMinistriesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const organizationId = effectiveOrgId(session)
  if (!organizationId) redirect("/mi")
  const ministries = await listMyMinistries(organizationId, session.user.id)
  const leading = ministries.filter((m) => m.role === "leader").length
  const upcoming = ministries.filter((m) => m.nextMeeting).length

  return (
    <div className="w-full space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-accent to-info/10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-3xl bg-card text-primary shadow-sm">
            <HandHeart className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Mis ministerios</h1>
            <p className="text-sm text-muted-foreground">Donde sirves. Puedes estar en varios, con un papel distinto en cada uno.</p>
          </div>
          {ministries.length > 0 && (
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
              {(
                [
                  [ministries.length, "Sirvo en", HeartHandshake],
                  [leading, "Lidero", Crown],
                  [upcoming, "Con reunión", CalendarDays],
                ] as const
              ).map(([n, label, Icon]) => (
                <div key={label} className="rounded-2xl bg-card/80 px-3 py-2 ring-1 ring-border">
                  <Icon className="mx-auto size-4 text-primary" />
                  <span className="block font-heading text-lg font-semibold tabular-nums">{n}</span>
                  <span className="block text-[0.7rem] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {ministries.length === 0 ? (
        <Card>
          <CardContent>
            <NoMinistries />
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ministries.map((m, i) => (
            <li key={m.id}>
              <Link href={`/mi/ministerios/${m.id}`} className="press group block h-full overflow-hidden rounded-3xl border bg-card transition-colors hover:border-primary/40">
                <div className={`flex items-center justify-between gap-2 bg-gradient-to-br ${COVERS[i % COVERS.length]} px-4 py-4`}>
                  <span className="grid size-12 place-items-center rounded-2xl bg-card text-primary shadow-sm">
                    <HeartHandshake className="size-6" />
                  </span>
                  <StatusPill tone={m.role === "leader" ? "primary" : m.role === "assistant" ? "info" : "neutral"} dot={false}>
                    {MINISTRY_ROLE_LABEL[m.role]}
                  </StatusPill>
                </div>
                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-semibold">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.positionTitle ?? m.parentName ?? "Ministerio"}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {m.memberCount} servidor(es)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {m.nextMeeting
                        ? `${m.nextMeeting.title} · ${new Date(m.nextMeeting.startsAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`
                        : "Sin reunión próxima"}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Abrir mi equipo
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <JoinMinistries />
    </div>
  )
}
