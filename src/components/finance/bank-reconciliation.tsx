"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Check, FileUp, Link2, Link2Off, Loader2, Plus, Trash2, Wand2, EyeOff, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { BankLineDto, BankPreviewDto, StatementDto } from "@/lib/finance/bank"
import { cn } from "@/lib/utils"

// Conciliación bancaria: se importa el CSV del banco y cada movimiento se cota con un
// ingreso o gasto registrado (o se registra desde aquí si faltaba).

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const day = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

export function BankReconciliation({ canManage }: { canManage: boolean }) {
  const [statements, setStatements] = useState<StatementDto[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatements((await apiJson<{ statements: StatementDto[] }>("/api/finance/bank")).statements)
    } catch (e) {
      setStatements([])
      swalError("No se pudieron cargar los estados de cuenta", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (openId) return <StatementView id={openId} canManage={canManage} onBack={() => { setOpenId(null); void load() }} />
  if (!statements) return <Skeleton className="mt-3 h-40 w-full" />

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Importa el estado de cuenta (CSV) y coteja cada depósito y retiro con tus ingresos y gastos.</p>
        {canManage && (
          <Button size="sm" onClick={() => setImporting(true)}>
            <FileUp className="size-4" />
            Importar estado de cuenta
          </Button>
        )}
      </div>
      {statements.length === 0 ? (
        <EmptyState icon={Link2} title="Aún no hay estados de cuenta" description="Descarga el CSV de tu banca en línea e impórtalo para empezar a conciliar." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {statements.map((s) => {
            const done = s.counts.total === 0 ? 0 : Math.round(((s.counts.matched + s.counts.ignored) / s.counts.total) * 100)
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setOpenId(s.id)} className="press block w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40">
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.periodFrom && s.periodTo ? `${day(s.periodFrom)} – ${day(s.periodTo)}` : "Sin periodo"} · {s.counts.total} movimientos
                      </span>
                    </span>
                    <StatusPill tone={s.counts.pending === 0 ? "success" : "warning"} dot={false}>
                      {s.counts.pending === 0 ? "Conciliado" : `${s.counts.pending} por conciliar`}
                    </StatusPill>
                  </span>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de conciliación">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${done}%` }} />
                  </span>
                  <span className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
                    <span>Depósitos {money(s.deposits)}</span>
                    <span>Retiros {money(s.withdrawals)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={async (id) => { setImporting(false); await load(); setOpenId(id) }} />
    </div>
  )
}

// ── Importación ───────────────────────────────────────────────────────────────

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => Promise<void> }) {
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [label, setLabel] = useState("")
  const [preview, setPreview] = useState<BankPreviewDto | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setCsv("")
      setFileName("")
      setLabel("")
      setPreview(null)
    }
  }, [open])

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      setCsv(text)
      setFileName(file.name)
      if (!label) setLabel(file.name.replace(/\.[^.]+$/, ""))
      const r = await apiJson<{ preview: BankPreviewDto }>("/api/finance/bank", { method: "POST", body: JSON.stringify({ csv: text, preview: true }) })
      setPreview(r.preview)
    } catch (e) {
      setPreview(null)
      swalError("No se pudo leer el archivo", errorMessage(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const confirm = async () => {
    setBusy(true)
    try {
      const r = await apiJson<{ id: string; imported: number; duplicates: number }>("/api/finance/bank", { method: "POST", body: JSON.stringify({ csv, label, fileName }) })
      notify.success(`${r.imported} movimientos importados${r.duplicates ? ` (${r.duplicates} ya existían)` : ""}`)
      await onDone(r.id)
    } catch (e) {
      swalError("No se pudo importar", errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title="Importar estado de cuenta"
      description="Archivo CSV de tu banco. Debe traer fecha, descripción e importe (o cargos y abonos)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || !preview}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Importar {preview ? `${preview.lines} movimientos` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && void pick(e.target.files[0])} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <FileUp className="size-4" />
          {fileName ? `Cambiar archivo (${fileName})` : "Elegir archivo CSV"}
        </Button>
        {preview && (
          <>
            <InputGroupField label="Nombre del estado de cuenta" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Movimientos", String(preview.lines)],
                ["Depósitos", money(preview.deposits)],
                ["Retiros", money(preview.withdrawals)],
                ["Periodo", preview.periodFrom && preview.periodTo ? `${day(preview.periodFrom)} – ${day(preview.periodTo)}` : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border bg-card p-2.5">
                  <dd className="text-sm font-semibold tabular-nums">{v}</dd>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                </div>
              ))}
            </dl>
            <ul className="divide-y rounded-xl border text-sm">
              {preview.sample.map((s, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{day(s.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{s.description}</span>
                  <span className={cn("tabular-nums", s.amount < 0 && "text-rose-700 dark:text-rose-400")}>{money(s.amount)}</span>
                </li>
              ))}
            </ul>
            {preview.errors.length > 0 && (
              <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                {preview.errors.length} renglón(es) no se pudieron leer y se omitirán. Ej.: fila {preview.errors[0].row}: {preview.errors[0].reason}.
              </p>
            )}
          </>
        )}
      </div>
    </DialogComponent>
  )
}

// ── Estado de cuenta ──────────────────────────────────────────────────────────

type Filter = "pending" | "matched" | "ignored" | "all"

function StatementView({ id, canManage, onBack }: { id: string; canManage: boolean; onBack: () => void }) {
  const [data, setData] = useState<{
    statement: { id: string; label: string; periodFrom: string | null; periodTo: string | null }
    lines: BankLineDto[]
    summary: { pending: number; matched: number; ignored: number; pendingAmount: number; matchedAmount: number }
  } | null>(null)
  const [filter, setFilter] = useState<Filter>("pending")
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState<BankLineDto | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiJson(`/api/finance/bank/${id}`))
    } catch (e) {
      swalError("No se pudo abrir el estado de cuenta", errorMessage(e))
      onBack()
    }
  }, [id, onBack])
  useEffect(() => {
    void load()
  }, [load])

  const act = async (lineId: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(lineId)
    try {
      await apiJson(`/api/finance/bank/lines/${lineId}`, { method: "POST", body: JSON.stringify(body) })
      if (ok) notify.success(ok)
      await load()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const auto = async () => {
    setBusy("auto")
    try {
      const r = await apiJson<{ matched: number }>(`/api/finance/bank/${id}`, { method: "POST" })
      notify.success(r.matched > 0 ? `${r.matched} movimientos conciliados` : "No hubo coincidencias claras; revisa las sugerencias")
      await load()
    } catch (e) {
      swalError("No se pudo conciliar", errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!(await swalConfirm("¿Eliminar este estado de cuenta?", "Se quitan sus renglones y conciliaciones; tus ingresos y gastos no cambian.", { confirmText: "Eliminar", danger: true }))) return
    try {
      await apiJson(`/api/finance/bank/${id}`, { method: "DELETE" })
      onBack()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  if (!data) return <Skeleton className="mt-3 h-64 w-full" />
  const shown = data.lines.filter((l) => filter === "all" || l.status === filter)

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" className="-ml-2" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Estados de cuenta
        </Button>
        <h3 className="min-w-0 flex-1 truncate font-heading text-base font-semibold">{data.statement.label}</h3>
        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => void auto()} disabled={busy !== null || data.summary.pending === 0}>
              {busy === "auto" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Conciliar lo claro
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Eliminar estado de cuenta" onClick={() => void remove()}>
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border bg-card p-3">
          <dd className="font-heading text-xl font-semibold tabular-nums">{data.summary.pending}</dd>
          <dt className="text-xs text-muted-foreground">Por conciliar · {money(data.summary.pendingAmount)}</dt>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <dd className="font-heading text-xl font-semibold tabular-nums">{data.summary.matched}</dd>
          <dt className="text-xs text-muted-foreground">Conciliados · {money(data.summary.matchedAmount)}</dt>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <dd className="font-heading text-xl font-semibold tabular-nums">{data.summary.ignored}</dd>
          <dt className="text-xs text-muted-foreground">Ignorados</dt>
        </div>
      </dl>

      <SegmentedFilter
        value={filter}
        onChange={setFilter}
        ariaLabel="Filtrar movimientos"
        options={[
          { value: "pending", label: `Por conciliar (${data.summary.pending})` },
          { value: "matched", label: `Conciliados (${data.summary.matched})` },
          { value: "ignored", label: `Ignorados (${data.summary.ignored})` },
          { value: "all", label: "Todos" },
        ]}
      />

      {shown.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === "pending" ? "¡Todo conciliado! No quedan movimientos por revisar." : "No hay movimientos en esta vista."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((l) => (
            <li key={l.id} className="space-y-2 rounded-2xl border bg-card p-3">
              <div className="flex flex-wrap items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{l.description}</span>
                  <span className="block text-xs text-muted-foreground">
                    {day(l.date)}
                    {l.reference ? ` · ref. ${l.reference}` : ""}
                  </span>
                </span>
                <span className={cn("font-heading text-base font-semibold tabular-nums", l.amount < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>{money(l.amount)}</span>
              </div>

              {l.status === "matched" && l.match && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill tone="success" dot={false}>
                    <Check className="mr-1 size-3.5" />
                    {l.match.kind === "income" ? "Ingreso" : "Gasto"}: {l.match.label}
                  </StatusPill>
                  {canManage && (
                    <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => void act(l.id, { action: "unmatch" })}>
                      <Link2Off className="size-4" />
                      Quitar
                    </Button>
                  )}
                </div>
              )}

              {l.status === "ignored" && canManage && (
                <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => void act(l.id, { action: "restore" })}>
                  <Undo2 className="size-4" />
                  Volver a considerar
                </Button>
              )}

              {l.status === "pending" && (
                <div className="space-y-2">
                  {l.candidates.length > 0 ? (
                    <ul className="space-y-1">
                      {l.candidates.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-1.5 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{c.text}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.kind === "income" ? "Ingreso" : "Gasto"} · {day(c.date)}
                              {c.daysApart > 0 ? ` (${c.daysApart} día${c.daysApart === 1 ? "" : "s"} de diferencia)` : " (misma fecha)"}
                            </span>
                          </span>
                          {canManage && (
                            <Button size="sm" disabled={busy === l.id} onClick={() => void act(l.id, { action: "match", kind: c.kind, id: c.id }, "Conciliado")}>
                              <Link2 className="size-4" />
                              Es este
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No hay un {l.amount > 0 ? "ingreso" : "gasto"} registrado con ese importe cerca de esa fecha.</p>
                  )}
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setCreating(l)}>
                        <Plus className="size-4" />
                        Registrar {l.amount > 0 ? "ingreso" : "gasto"}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => void act(l.id, { action: "ignore" })}>
                        <EyeOff className="size-4" />
                        Ignorar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <CreateDialog line={creating} onClose={() => setCreating(null)} onCreate={async (body) => { if (creating) await act(creating.id, { action: "create", ...body }, "Movimiento registrado y conciliado"); setCreating(null) }} />
    </div>
  )
}

function CreateDialog({ line, onClose, onCreate }: { line: BankLineDto | null; onClose: () => void; onCreate: (body: Record<string, unknown>) => Promise<void> }) {
  const [concept, setConcept] = useState("")
  useEffect(() => {
    if (line) setConcept(line.description)
  }, [line])
  const income = (line?.amount ?? 0) > 0
  return (
    <DialogComponent
      open={line !== null}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={income ? "Registrar ingreso" : "Registrar gasto"}
      description={line ? `${money(Math.abs(line.amount))} · ${day(line.date)}. Quedará conciliado con este movimiento del banco.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void onCreate({ concept })} disabled={!concept.trim()}>
            Registrar y conciliar
          </Button>
        </>
      }
    >
      <InputGroupField label="Concepto" value={concept} maxLength={200} onChange={(e) => setConcept(e.target.value)} />
      <p className="mt-2 text-xs text-muted-foreground">
        {income ? "Se registra como ingreso por transferencia (tipo «Otros»)." : "Se registra como gasto de la categoría «Otros»."} Puedes cambiarle el tipo después desde {income ? "Ingresos" : "Gastos"}.
      </p>
    </DialogComponent>
  )
}
