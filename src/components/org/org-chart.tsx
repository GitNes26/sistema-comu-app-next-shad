"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, HandHeart, Network, Users, Wrench } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { OrgChartDto, OrgNode } from "@/lib/org/server"

// Organigrama: pastores → ministerios (misión) y áreas de servicio (organización).

function Person({ name, title, role }: { name: string; title: string | null; role: "leader" | "assistant" }) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{name.charAt(0)}</span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{title ?? (role === "leader" ? "Líder" : "Asistente")}</span>
      </span>
    </li>
  )
}

function NodeCard({ node, link }: { node: OrgNode; link: boolean }) {
  const title = (
    <span className="flex items-center gap-2">
      <span className="font-heading text-base font-semibold">{node.name}</span>
      {node.shortName && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-primary">{node.shortName}</span>}
    </span>
  )
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        {link ? (
          <Link href={`/mi/ministerios/${node.id}`} className="hover:text-primary">
            {title}
          </Link>
        ) : (
          title
        )}
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3.5" /> {node.servers}
        </span>
      </div>
      {node.leaders.length > 0 ? (
        <ul className="space-y-2">
          {node.leaders.slice(0, 4).map((l, i) => (
            <Person key={i} {...l} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin líder asignado</p>
      )}
      {node.children.length > 0 && (
        <div className="mt-1 border-t pt-3">
          <p className="mb-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">Áreas</p>
          <ul className="flex flex-wrap gap-1.5">
            {node.children.map((c) => (
              <li key={c.id} className="rounded-full bg-muted px-2.5 py-1 text-xs" title={c.leaders.map((l) => l.name).join(", ") || undefined}>
                {c.name}
                {c.leaders[0] ? <span className="text-muted-foreground"> · {c.leaders[0].name.split(" ")[0]}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function OrgChart() {
  const [chart, setChart] = useState<OrgChartDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    apiJson<{ chart: OrgChartDto }>("/api/org-chart")
      .then((d) => setChart(d.chart))
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <EmptyState icon={Network} title="No se pudo cargar" description={error} />
  if (!chart) return <Skeleton className="h-96 w-full" />

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
          <Network className="size-6 text-primary" /> Organigrama
        </h1>
        <p className="text-sm text-muted-foreground">Quién sirve en cada ministerio y área de nuestra familia.</p>
      </div>

      {chart.pastors.length > 0 && (
        <section className="relative">
          <ul className="flex flex-wrap justify-center gap-3">
            {chart.pastors.map((p) => (
              <li key={p.name} className="flex items-center gap-3 rounded-2xl bg-primary px-5 py-3 text-primary-foreground">
                <Crown className="size-5" />
                <span className="leading-tight">
                  <span className="block font-heading font-semibold">{p.name}</span>
                  <span className="block text-xs opacity-80">{p.senior ? "Pastor principal" : "Pastor"}</span>
                </span>
              </li>
            ))}
          </ul>
          <span aria-hidden className="mx-auto mt-3 block h-6 w-px bg-border" />
        </section>
      )}

      <section aria-labelledby="org-ministerios" className="space-y-3">
        <h2 id="org-ministerios" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <HandHeart className="size-5 text-primary" /> Ministerios
          <span className="text-xs font-normal text-muted-foreground">Fundamentales para cumplir la misión</span>
        </h2>
        {chart.ministries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay ministerios registrados.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {chart.ministries.map((n) => (
              <NodeCard key={n.id} node={n} link />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="org-servicio" className="space-y-3">
        <h2 id="org-servicio" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Wrench className="size-5 text-primary" /> Áreas de servicio
          <span className="text-xs font-normal text-muted-foreground">Sostienen la organización de la iglesia</span>
        </h2>
        {chart.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay áreas de servicio registradas.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {chart.services.map((n) => (
              <NodeCard key={n.id} node={n} link />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
