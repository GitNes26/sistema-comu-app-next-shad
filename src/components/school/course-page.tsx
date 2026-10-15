"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Award, BookOpen, CalendarDays, ClipboardCheck, Clock, GraduationCap, PenLine, PlayCircle, UserRound, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { CourseDto, GroupLiteDto, SchoolDto, SchoolOverviewDto } from "@/lib/school/server"
import { RequestDialog } from "@/components/school/school-portal"

// Un libro del catálogo: su portada, qué incluye y los grupos para cursarlo. Desde aquí
// se solicita la inscripción o, si ya lo cursas, se entra a la clase.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : null)

export function CoursePage({ courseId }: { courseId: string }) {
  const [data, setData] = useState<SchoolOverviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<{ course: CourseDto; group: GroupLiteDto; school: SchoolDto } | null>(null)

  const load = useCallback(async () => {
    try {
      setData((await apiJson<{ overview: SchoolOverviewDto }>("/api/school")).overview)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el libro"))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const found = useMemo(() => {
    for (const s of data?.schools ?? []) {
      const c = s.courses.find((x) => x.id === courseId)
      if (c) return { school: s, course: c, index: s.courses.indexOf(c) }
    }
    return null
  }, [data, courseId])

  if (error) return <EmptyState icon={BookOpen} title="No se pudo abrir el libro" description={error} />
  if (!data) return <Skeleton className="h-96 w-full" />
  if (!found) return <EmptyState icon={BookOpen} title="Libro no encontrado" description="Puede que ya no esté disponible." />

  const { school, course: c, index } = found
  // Si la persona ya lo cursa (o lo cursó), entra a su clase.
  const mine = data.mine.find((e) => e.courseName === c.name && (e.status === "enrolled" || e.status === "completed" || e.status === "failed"))
  const pending = data.mine.find((e) => e.courseName === c.name && e.status === "requested")

  const facts = [
    { icon: Clock, label: "Duración", value: `${c.weeks} semanas` },
    { icon: ClipboardCheck, label: "Tareas", value: String(c.tasksCount) },
    { icon: PenLine, label: "Ejercicios", value: String(c.exercisesCount) },
    { icon: GraduationCap, label: "Para aprobar", value: school.kind === "university" ? `${school.points.toPass} puntos` : `${school.passScore.toFixed(1)} de 10` },
  ]

  return (
    <div className="w-full space-y-6">
      <Link href="/mi/escuela" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Mi escuela
      </Link>

      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_45%,black)] text-primary-foreground">
        {c.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-50" />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="flex min-h-56 flex-col justify-end gap-2 p-6 sm:min-h-64 sm:p-8">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-85">
            {school.name}
            {school.kind === "ministry" ? ` · Libro ${index + 1}` : c.year ? ` · Año ${c.year}` : ""}
          </p>
          <h1 className="font-heading text-3xl leading-tight font-semibold text-balance sm:text-4xl">{c.name}</h1>
          {c.credential && (
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm backdrop-blur">
              <Award className="size-4" /> Otorga: {c.credential}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {mine ? (
          <Button asChild size="lg">
            <Link href={`/mi/escuela/${mine.id}`}>
              <PlayCircle className="size-5" /> Entrar a mi clase
            </Link>
          </Button>
        ) : pending ? (
          <p className="rounded-full bg-warning/15 px-4 py-2 text-sm font-medium text-warning-ink">Tu solicitud está en revisión.</p>
        ) : null}
        {c.passed && <p className="rounded-full bg-success/15 px-4 py-2 text-sm font-medium text-success-ink">Ya aprobaste este libro</p>}
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {facts.map((f) => (
          <li key={f.label} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="size-5" />
            </span>
            <span>
              <span className="block font-heading text-lg leading-none font-semibold tabular-nums">{f.value}</span>
              <span className="text-xs text-muted-foreground">{f.label}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">De qué trata</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{c.description ?? "Pronto compartiremos más información sobre este libro."}</p>
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <p>
              Inscripción: <b>{money(c.enrollmentFee)}</b>
              {c.bookPrice > 0 && (
                <>
                  {" · "}Libro de texto: <b>{money(c.bookPrice)}</b> <span className="text-muted-foreground">(opcional)</span>
                </>
              )}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Grupos disponibles</h2>
          {c.groups.length === 0 ? (
            <p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">Sin grupos abiertos por ahora. Te avisaremos cuando se abra uno.</p>
          ) : (
            <ul className="space-y-2">
              {c.groups.map((g) => {
                const full = g.capacity !== null && g.enrolled >= g.capacity
                return (
                  <li key={g.id} className="space-y-2 rounded-2xl border bg-card p-4">
                    <p className="font-medium">{g.name}</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {g.teacherName && (
                        <li className="flex items-center gap-1.5">
                          <UserRound className="size-3.5" /> Maestro: {g.teacherName}
                        </li>
                      )}
                      {g.startDate && (
                        <li className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" /> Inicia el {fmtDate(g.startDate)}
                        </li>
                      )}
                      {g.capacity && (
                        <li className="flex items-center gap-1.5">
                          <Users className="size-3.5" /> {g.enrolled} de {g.capacity} lugares
                        </li>
                      )}
                    </ul>
                    <Button className="w-full" variant={full ? "outline" : "default"} disabled={full || Boolean(school.blockedReason) || Boolean(mine) || Boolean(pending)} onClick={() => setRequest({ course: c, group: g, school })}>
                      {full ? "Grupo lleno" : "Solicitar inscripción"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {school.blockedReason && <p className="text-xs text-muted-foreground">{school.blockedReason}.</p>}
        </section>
      </div>

      <RequestDialog target={request} onClose={() => setRequest(null)} onDone={load} />
    </div>
  )
}
