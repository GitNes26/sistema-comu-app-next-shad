"use client"

import { useEffect, useState } from "react"
import { Cake, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson } from "@/lib/ministries/client"
import type { FamilyDto } from "@/lib/families/server"
import { FAMILY_RELATIONS } from "@/lib/families/rules"
import { MyKids } from "@/components/kids/my-kids"

// «Mi familia»: quiénes la integran según el padrón de la iglesia. Lo administra la
// secretaría; aquí solo se consulta (sin teléfonos).

export function MyFamily() {
  const [family, setFamily] = useState<FamilyDto | null | undefined>(undefined)
  useEffect(() => {
    apiJson<{ family: FamilyDto | null }>("/api/families/mine")
      .then((d) => setFamily(d.family))
      .catch(() => setFamily(null))
  }, [])

  return (
    <div className="w-full space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-accent to-warning/10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-3xl bg-card text-primary shadow-sm">
            <Users className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{family ? family.name : "Mi familia"}</h1>
            <p className="text-sm text-muted-foreground">Familia es lo que somos, comunidad es lo que hacemos.</p>
          </div>
        </div>
      </header>

      {family === undefined ? (
        <Skeleton className="h-40 w-full" />
      ) : family === null ? (
        <EmptyState icon={Users} title="Aún no tienes una familia registrada" description="Pide en la secretaría que agregue a tu familia al padrón para verla aquí." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {family.members.map((m) => (
            <li key={m.memberId} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 font-heading text-lg font-semibold text-primary">{m.fullName.charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.fullName}</span>
                <span className="block text-xs text-muted-foreground">{FAMILY_RELATIONS[m.relation]}</span>
                {m.birthday && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Cake className="size-3" /> {m.birthday}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section id="hijos" className="scroll-mt-20">
        <MyKids embedded />
      </section>
    </div>
  )
}
