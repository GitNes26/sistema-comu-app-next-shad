"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CalendarDays, CheckCircle2, Clock, Crosshair, HeartHandshake, Home, Loader2, MapPin, Search, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField, SegmentedFilter, TextareaField } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { ApiError, apiJson, errorMessage } from "@/lib/ministries/client"
import { DAY_LABEL } from "@/lib/cells/rules"
import type { CellSearchResult, FoundCellDto } from "@/lib/cells/finder"

// Buscador de hogares de amor (grupos en casa = células). Mismo componente para la
// página pública (pide nombre y contacto) y para el portal (usa los datos de la persona).

type Mode = { kind: "public"; slug: string } | { kind: "portal" }

export function CellFinder({ mode, churchName }: { mode: Mode; churchName?: string }) {
  const [data, setData] = useState<CellSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState("")
  const [q, setQ] = useState("")
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [pick, setPick] = useState<FoundCellDto | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const base = mode.kind === "public" ? `/api/public/${encodeURIComponent(mode.slug)}/cells` : "/api/cells/find"

  const load = useCallback(async () => {
    const p = new URLSearchParams()
    if (type) p.set("type", type)
    if (q.trim()) p.set("q", q.trim())
    if (geo) {
      p.set("lat", String(geo.lat))
      p.set("lng", String(geo.lng))
    }
    try {
      setData(await apiJson<CellSearchResult>(`${base}?${p.toString()}`))
      setError(null)
    } catch (e) {
      setError(errorMessage(e, "No se pudo buscar"))
    }
  }, [base, type, q, geo])

  // Búsqueda con pausa al escribir.
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(), q ? 300 : 0)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [load, q])

  const locate = () => {
    if (!navigator.geolocation) {
      swalError("Tu navegador no permite ubicarte", "Escribe tu colonia para buscar.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocating(false)
        swalError("No pudimos obtener tu ubicación", "Puedes buscar escribiendo tu colonia.")
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  return (
    <div className="w-full space-y-5">
      <div className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <InputGroupField
            containerClassName="min-w-56 flex-1"
            label="Tu colonia o zona"
            type="search"
            placeholder="Ej. Residencial Las Etnias"
            leftIcon={<Search className="size-4" />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="button" variant={geo ? "default" : "outline"} onClick={locate} disabled={locating} className="h-11 desk:h-8">
            {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
            {geo ? "Ubicación activa" : "Usar mi ubicación"}
          </Button>
        </div>
        {data && data.types.length > 0 && (
          <SegmentedFilter
            ariaLabel="Tipo de hogar de amor"
            value={type}
            onChange={setType}
            options={[{ value: "", label: "Todos" }, ...data.types.map((t) => ({ value: t.id, label: t.name }))]}
          />
        )}
      </div>

      {error ? (
        <EmptyState icon={Home} title="No se pudo cargar" description={error} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : data.cells.length === 0 ? (
        <EmptyState icon={Home} title="No encontramos hogares con esa búsqueda" description="Prueba con otra colonia, quita el tipo o déjanos tus datos y te ayudamos a encontrar uno." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.cells.map((c) => (
            <li key={c.id} className="group flex flex-col gap-3 rounded-3xl border bg-card p-4 transition duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md motion-reduce:transition-none">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Home className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-base leading-tight font-semibold">{c.name}</p>
                  {c.typeName && <p className="text-xs text-muted-foreground">{c.typeName}</p>}
                </div>
                {c.distanceKm !== null && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">~{c.distanceKm} km</span>}
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0" /> {DAY_LABEL[c.dayOfWeek]}
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0" /> {c.startTime}
                </li>
                {(c.neighborhood || c.city) && (
                  <li className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" /> {[c.neighborhood, c.city].filter(Boolean).join(", ")}
                  </li>
                )}
              </ul>
              {sent === c.id ? (
                <p className="flex items-center gap-2 rounded-xl bg-success/10 p-2.5 text-sm font-medium text-success-ink">
                  <CheckCircle2 className="size-4" /> Solicitud enviada. Su líder te escribirá.
                </p>
              ) : (
                <Button onClick={() => setPick(c)} className="mt-auto">
                  <HeartHandshake className="size-4" /> Quiero unirme
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <JoinDialog
        mode={mode}
        churchName={churchName}
        cell={pick}
        onClose={() => setPick(null)}
        onDone={(id) => {
          setSent(id)
          setPick(null)
        }}
      />
    </div>
  )
}

function JoinDialog({ mode, churchName, cell, onClose, onDone }: { mode: Mode; churchName?: string; cell: FoundCellDto | null; onClose: () => void; onDone: (id: string) => void }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [trap, setTrap] = useState("")
  const [sending, setSending] = useState(false)
  const [fieldError, setFieldError] = useState<{ field: string | null; text: string } | null>(null)
  const isPublic = mode.kind === "public"

  useEffect(() => {
    if (cell) setFieldError(null)
  }, [cell])

  const send = async () => {
    if (!cell) return
    setSending(true)
    setFieldError(null)
    try {
      if (mode.kind === "public") {
        await apiJson(`/api/public/${encodeURIComponent(mode.slug)}/connect`, {
          method: "POST",
          body: JSON.stringify({ kind: "group", cellId: cell.id, name, phone, email, message, website: trap }),
        })
      } else {
        await apiJson("/api/cells/join-request", { method: "POST", body: JSON.stringify({ cellId: cell.id, message }) })
      }
      notify.success("¡Listo! Su líder te contactará pronto.")
      onDone(cell.id)
    } catch (e) {
      if (e instanceof ApiError && e.field) setFieldError({ field: e.field, text: e.message })
      else swalError("No se pudo enviar", errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  const err = (f: string) => (fieldError?.field === f ? fieldError.text : undefined)

  return (
    <DialogComponent
      open={cell !== null}
      onOpenChange={(o) => !o && onClose()}
      icon={<Home />}
      title={cell ? `Unirme a ${cell.name}` : "Unirme"}
      description={cell ? `${DAY_LABEL[cell.dayOfWeek]} · ${cell.startTime}${cell.neighborhood ? ` · ${cell.neighborhood}` : ""}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={() => void send()} disabled={sending || (isPublic && !name.trim())}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar solicitud
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isPublic ? (
          <>
            <p className="text-sm text-muted-foreground">Déjanos cómo contactarte y el líder de este hogar te dará la bienvenida{churchName ? ` en ${churchName}` : ""}.</p>
            <InputGroupField label="Tu nombre" required autoComplete="name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} error={err("name")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <InputGroupField label="Celular o WhatsApp" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={err("phone")} />
              <InputGroupField label="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err("email")} />
            </div>
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Sitio web
                <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
              </label>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Usaremos tus datos de contacto registrados para que el líder de este hogar te escriba.</p>
        )}
        <TextareaField label="¿Algo que quieras decirle? (opcional)" rows={3} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
      </div>
    </DialogComponent>
  )
}
