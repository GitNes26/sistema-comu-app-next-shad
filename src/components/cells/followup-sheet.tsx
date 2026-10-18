"use client"

import { useEffect, useState } from "react"
import { Check, ChevronLeft, ChevronRight, FileDown, Minus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ClipboardCheck } from "lucide-react"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { GROWTH_COLUMNS, SHEET_WEEKS, type FollowUpSheet, type SheetRow } from "@/lib/cells/followup-rules"
import { cn } from "@/lib/utils"

// «Hoja de seguimiento mensual» en pantalla: la misma que se llena en papel. Asistencia por
// semana (toca la fecha para pasar lista), crecimiento (BA, BES, EJ, EM, EL, UT) y nuevos
// creyentes; se descarga en PDF con el formato impreso.

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number)
  return ym(new Date(y, m - 1 + delta, 1))
}

function Mark({ value }: { value: boolean | null }) {
  if (value === true) return <Check className="mx-auto size-4 text-success" aria-label="Asistió" />
  if (value === false) return <X className="mx-auto size-3.5 text-muted-foreground/60" aria-label="Faltó" />
  return <Minus className="mx-auto size-3 text-muted-foreground/25" aria-hidden />
}

function Table({ rows, sheet, onTakeAttendance, canTake }: { rows: SheetRow[]; sheet: FollowUpSheet; onTakeAttendance: (date: string) => void; canTake: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60 text-xs">
            <th className="w-8 px-2 py-2 text-center font-semibold">No</th>
            <th className="px-2 py-2 text-left font-semibold">Nombre</th>
            {Array.from({ length: SHEET_WEEKS }, (_, i) => {
              const d = sheet.weekDates[i]
              return (
                <th key={i} className="w-12 px-1 py-1 text-center font-semibold">
                  {d && canTake ? (
                    <button type="button" onClick={() => onTakeAttendance(d)} className="press rounded-lg px-1.5 py-1 hover:bg-primary/10 hover:text-primary" aria-label={`Pasar lista del ${d}`}>
                      <span className="block leading-none">{i + 1}</span>
                      <span className="block text-[0.6rem] font-normal text-muted-foreground">{`${d.slice(8, 10)}/${d.slice(5, 7)}`}</span>
                    </button>
                  ) : (
                    <>
                      <span className="block leading-none">{i + 1}</span>
                      <span className="block text-[0.6rem] font-normal text-muted-foreground">{d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "–"}</span>
                    </>
                  )}
                </th>
              )
            })}
            {GROWTH_COLUMNS.map((g) => (
              <th key={g.key} title={g.label} className="w-10 border-l px-1 py-2 text-center font-semibold first:border-l-0 [&:nth-child(8)]:border-l-2">
                {g.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.memberId} className="border-t">
              <td className="px-2 py-1.5 text-center text-xs text-muted-foreground tabular-nums">{r.n}</td>
              <td className="px-2 py-1.5">
                <span className="block truncate font-medium">{r.name}</span>
                {r.phone && <span className="block text-xs text-muted-foreground">{r.phone}</span>}
              </td>
              {r.weeks.map((v, i) => (
                <td key={i} className="px-1 py-1.5">
                  <Mark value={v} />
                </td>
              ))}
              {GROWTH_COLUMNS.map((g, gi) => {
                const m = r.growth[g.key]
                return (
                  <td key={g.key} className={cn("px-1 py-1.5 text-center", gi === 0 && "border-l-2")}>
                    {m.done ? <Check className="mx-auto size-4 text-primary" aria-label={g.label} /> : m.partial ? <span className="text-xs font-semibold text-muted-foreground tabular-nums">{m.partial}</span> : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FollowUpSheetView({
  cellId,
  reloadKey,
  canTakeAttendance,
  onTakeAttendance,
}: {
  cellId: string
  reloadKey: number
  canTakeAttendance: boolean
  onTakeAttendance: (date: string) => void
}) {
  const [month, setMonth] = useState(() => ym(new Date()))
  const [sheet, setSheet] = useState<FollowUpSheet | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setSheet(null)
    setError(null)
    apiJson<{ sheets: FollowUpSheet[] }>(`/api/cells/followup?cellId=${cellId}&month=${month}`)
      .then((d) => alive && setSheet(d.sheets[0] ?? null))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [cellId, month, reloadKey])

  const pdfHref = `/api/cells/followup?cellId=${cellId}&month=${month}&format=pdf`
  const total = sheet ? sheet.sheepCount + sheet.newBelievers.length : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-36 text-center font-heading text-base font-semibold first-letter:uppercase">{sheet?.monthLabel ?? month}</p>
        <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a href={pdfHref} download>
            <FileDown className="size-4" />
            Descargar hoja (PDF)
          </a>
        </Button>
      </div>

      {error ? (
        <EmptyState icon={ClipboardCheck} title="No se pudo cargar la hoja" description={error} />
      ) : !sheet ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <li className="rounded-2xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">Ovejas actuales</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">{total}</p>
            </li>
            <li className="rounded-2xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">Nuevos creyentes</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">{sheet.newBelievers.length}</p>
            </li>
            {sheet.presentPerWeek.map((n, i) => (sheet.weekDates[i] ? { n, i } : null)).filter((x): x is { n: number; i: number } => x !== null).slice(0, 2).map(({ n, i }) => (
              <li key={i} className="rounded-2xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Semana {i + 1}</p>
                <p className="font-heading text-2xl font-semibold tabular-nums">
                  {n}
                  <span className="text-sm font-normal text-muted-foreground"> / {total}</span>
                </p>
              </li>
            ))}
          </ul>

          <Table rows={sheet.sheep} sheet={sheet} onTakeAttendance={onTakeAttendance} canTake={canTakeAttendance} />

          <section className="space-y-2">
            <h3 className="font-heading text-base font-semibold">Nuevos creyentes</h3>
            {sheet.newBelievers.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Nadie llegó nuevo este mes.</p>
            ) : (
              <Table rows={sheet.newBelievers} sheet={sheet} onTakeAttendance={onTakeAttendance} canTake={canTakeAttendance} />
            )}
          </section>

          {sheet.observations.length > 0 && (
            <section className="space-y-1 rounded-2xl border bg-card p-3">
              <h3 className="text-sm font-semibold">Observaciones</h3>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {sheet.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            {sheet.legend.map((l) => `${l.short}: ${l.label}`).join(" · ")}. Un número en lugar de la palomita indica el avance (libros aprobados).
          </p>
        </>
      )}
    </div>
  )
}
