import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, Users } from "lucide-react"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { listMyMinistries } from "@/lib/ministries/server"
import { MINISTRY_ROLE_LABEL } from "@/lib/ministries/rules"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NoMinistries } from "@/components/mi/no-ministries"
import { StatusPill } from "@/components/base"
import { JoinMinistries } from "@/components/portal/join-ministries"

export const metadata: Metadata = { title: "Mis ministerios" }

export default async function MyMinistriesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const organizationId = effectiveOrgId(session)
  if (!organizationId) redirect("/mi")
  const ministries = await listMyMinistries(organizationId, session.user.id)

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mis ministerios</h1>
        <p className="text-sm text-muted-foreground">Donde sirves. Puedes estar en varios, con un papel distinto en cada uno.</p>
      </div>
      {ministries.length === 0 ? (
        <Card>
          <CardContent>
            <NoMinistries />
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ministries.map((m) => (
            <li key={m.id}>
              <Link href={`/mi/ministerios/${m.id}`} className="press block h-full">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-heading font-semibold">{m.name}</p>
                        {m.parentName && <p className="truncate text-xs text-muted-foreground">{m.parentName}</p>}
                      </div>
                      <StatusPill tone={m.role === "leader" ? "primary" : m.role === "assistant" ? "info" : "neutral"} dot={false}>
                        {MINISTRY_ROLE_LABEL[m.role]}
                      </StatusPill>
                    </div>
                    {m.positionTitle && <p className="text-sm text-muted-foreground">{m.positionTitle}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {m.memberCount} servidor(es)
                      </span>
                      {m.nextMeeting && (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" />
                          {m.nextMeeting.title} ·{" "}
                          {new Date(m.nextMeeting.startsAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <JoinMinistries />
    </div>
  )
}
