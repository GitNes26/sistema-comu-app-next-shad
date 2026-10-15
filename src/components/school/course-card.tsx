"use client"

import Link from "next/link"
import { ArrowRight, BookOpen, Check, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CourseDto } from "@/lib/school/server"

// Tarjeta compacta de un libro: portada de libro (3:4) a la izquierda y el resumen a la
// derecha. Al pasar el puntero se eleva y la portada se acerca: se nota que se abre.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
const fmtDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : null)

export function CourseCard({ course: c, index, href, ministry }: { course: CourseDto; index: number; href: string; ministry: boolean }) {
  const open = c.groups.filter((g) => g.status !== "closed")
  const next = open.map((g) => g.startDate).filter((d): d is string => Boolean(d)).sort()[0]
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-2.5 outline-none",
        "transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        c.passed && "border-success/40"
      )}
    >
      {/* Portada */}
      <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/80 to-[color-mix(in_oklab,var(--primary)_45%,black)] sm:w-24">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none" />
        ) : (
          <BookOpen className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-white/30" />
        )}
        <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-white/90 font-heading text-[0.7rem] font-semibold text-slate-900 tabular-nums">
          {ministry ? index + 1 : <BookOpen className="size-3" />}
        </span>
      </div>

      {/* Resumen */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-heading text-sm leading-snug font-semibold text-balance sm:text-base">{c.name}</h3>
          {c.passed && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.7rem] font-semibold text-success-ink">
              <Check className="size-3" /> Aprobado
            </span>
          )}
        </div>
        {c.description && <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
        <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[0.7rem] text-muted-foreground">
          <li className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {c.weeks} sem.
          </li>
          <li className="inline-flex items-center gap-1">
            <Users className="size-3" /> {open.length === 0 ? "Sin grupos" : `${open.length} grupo${open.length === 1 ? "" : "s"}${next ? ` · ${fmtDate(next)}` : ""}`}
          </li>
          <li>{money(c.enrollmentFee)}</li>
        </ul>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          Entrar
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
        </span>
      </div>
    </Link>
  )
}
