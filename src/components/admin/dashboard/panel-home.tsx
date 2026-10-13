"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useSession } from "next-auth/react"
import { ArrowRight } from "lucide-react"
import { NAV_SECTIONS, filterNavSectionsByUserAndFeature } from "@/lib/nav"

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

/** Sin permiso para ver las métricas: accesos directos a lo que su rol sí puede usar. */
export function QuickAccess({ roleName }: { roleName: string | null }) {
  const { data: session } = useSession()
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
  const name = session?.user?.name?.split(" ")[0]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{name ? `Hola, ${name}` : "Bienvenido"}</h2>
        <p className="text-sm text-muted-foreground">
          {roleName ? `Estos son los accesos de tu rol (${roleName}).` : "Estos son tus accesos."} Las cifras de la iglesia requieren el permiso de estadísticos.
        </p>
      </div>
      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Tu rol aún no tiene módulos asignados. Pide a un administrador que revise tus permisos.</p>
      ) : (
        sections.map((s) => (
          <section key={s.title ?? "x"} className="space-y-2">
            {s.title && <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.title}</h3>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href!}
                  className="press group flex min-h-14 items-center gap-3 rounded-2xl border bg-card/90 p-3 backdrop-blur-sm transition-colors hover:border-primary/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <i.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
