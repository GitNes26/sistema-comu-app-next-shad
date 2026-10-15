"use client"

import Link from "next/link"
import { ArrowRight, BookOpen, Check, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CourseDto } from "@/lib/school/server"

// Tarjeta de un libro del catálogo: la portada como fondo y, debajo, el resumen. Al pasar
// el puntero se eleva, la portada se acerca y la flecha avanza: se nota que se puede abrir.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
const fmtDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : null)

export function CourseCard({ course: c, index, href, ministry }: { course: CourseDto; index: number; href: string; ministry: boolean }) {
  const open = c.groups.filter((g) => g.status !== "closed")
  const next = open.map((g) => g.startDate).filter((d): d is string => Boolean(d)).sort()[0]
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-card outline-none",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        c.passed && "border-success/40"
      )}
    >
      {/* Portada */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/80 to-[color-mix(in_oklab,var(--primary)_45%,black)]">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none" />
        ) : (
          <BookOpen className="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 text-white/25 transition-transform duration-500 group-hover:scale-110" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <span className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-white/90 font-heading text-sm font-semibold text-slate-900 tabular-nums shadow">
          {ministry ? index + 1 : <BookOpen className="size-4" />}
        </span>
        {c.passed && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground shadow">
            <Check className="size-3.5" /> Aprobado
          </span>
        )}
      </div>

      {/* Resumen */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-base leading-snug font-semibold text-balance">{c.name}</h3>
        {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
        <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {c.weeks} semanas
          </li>
          <li className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {open.length === 0 ? "Sin grupos abiertos" : `${open.length} grupo${open.length === 1 ? "" : "s"}${next ? ` · inicia ${fmtDate(next)}` : ""}`}
          </li>
          <li>Inscripción {money(c.enrollmentFee)}</li>
        </ul>
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Entrar al libro
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1.5 motion-reduce:transition-none" />
        </span>
      </div>
    </Link>
  )
}
