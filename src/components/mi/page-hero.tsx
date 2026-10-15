import type { LucideIcon } from "lucide-react"

/** Encabezado común de las páginas del portal /mi: icono, título y leyenda sobre una banda cálida. */
export function PageHero({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-accent to-info/10 p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card text-primary shadow-sm sm:size-14 sm:rounded-3xl">
          <Icon className="size-6 sm:size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </header>
  )
}
