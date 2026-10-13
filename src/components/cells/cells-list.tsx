"use client"

import { useCallback, useEffect, useId, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { CalendarClock, Loader2, MapPin, Network, Plus, Search, Tag, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { AddressField } from "@/components/base/address-field"
import { SwitchField } from "@/components/base/switch-field"
import { TimePicker } from "@/components/base/time-picker"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { CELL_ROLE_LABEL, DAY_LABEL, timeLabel } from "@/lib/cells/rules"
import type { CellRowDto, NetworkDto } from "@/lib/cells/server"
import { cn } from "@/lib/utils"

// Listado de células. «Mi espacio» muestra las propias (por relación); el panel,
// todas (con permiso) más la gestión de redes y tipos.

const DAY_OPTIONS = DAY_LABEL.map((d, i) => ({ value: String(i), label: d }))

export function CellsList({ scope, basePath }: { scope: "mine" | "all"; basePath: string }) {
  const [cells, setCells] = useState<CellRowDto[] | null>(null)
  const [networks, setNetworks] = useState<NetworkDto[]>([])
  const [types, setTypes] = useState<{ id: string; name: string; isActive: boolean; cellCount: number }[]>([])
  const [q, setQ] = useState("")
  const [networkId, setNetworkId] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ cells: CellRowDto[] }>(
        `/api/cells?scope=${scope}&q=${encodeURIComponent(q)}${networkId ? `&networkId=${networkId}` : ""}`
      )
      setCells(d.cells)
    } catch (e) {
      setCells([])
      swalError("No se pudieron cargar las células", errorMessage(e))
    }
  }, [scope, q, networkId])

  const loadCatalogs = useCallback(async () => {
    try {
      const [n, t] = await Promise.all([
        apiJson<{ networks: NetworkDto[] }>("/api/cells/networks"),
        apiJson<{ types: typeof types; canManage: boolean }>("/api/cells/types"),
      ])
      setNetworks(n.networks)
      setTypes(t.types)
      setCanManage(t.canManage)
    } catch {
      /* sin permiso: se oculta la gestión */
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  useEffect(() => {
    if (scope !== "all") return
    void loadCatalogs()
  }, [scope, loadCatalogs])

  const list = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar célula…" aria-label="Buscar célula" className="pl-9 md:pl-9 desk:pl-9" />
        </div>
        {scope === "all" && networks.length > 0 && (
          <div className="w-48">
            <FormCombobox
              ariaLabel="Filtrar por red"
              options={networks.map((n) => ({ value: n.id, label: n.name }))}
              value={networkId}
              onChange={setNetworkId}
              onClear={() => setNetworkId("")}
              placeholder="Todas las redes"
            />
          </div>
        )}
        {scope === "all" && canManage && (
          <Button className="ml-auto" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Nueva célula
          </Button>
        )}
      </div>

      {cells === null ? (
        <Skeleton className="h-40 w-full" />
      ) : cells.length === 0 ? (
        <EmptyState
          icon={Users}
          title={scope === "mine" ? "Aún no perteneces a una célula" : "Sin células"}
          description={scope === "mine" ? "Cuando te integren a una célula la verás aquí." : "Crea la primera célula con su día, hora y líderes."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cells.map((c) => (
            <li key={c.id}>
              <Link
                href={`${basePath}/${c.id}`}
                className={cn("press flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 hover:border-primary/40", !c.isActive && "opacity-60")}
              >
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 font-heading text-base font-semibold">{c.name}</span>
                  {c.myRole && <StatusPill tone={c.myRole === "leader" ? "success" : "info"}>{CELL_ROLE_LABEL[c.myRole]}</StatusPill>}
                  {!c.isActive && <StatusPill tone="neutral">Inactiva</StatusPill>}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {c.typeName && (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="size-3" /> {c.typeName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" /> {DAY_LABEL[c.dayOfWeek]} {timeLabel(c.startTime)}
                  </span>
                  {c.place && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {c.place}
                    </span>
                  )}
                  {c.networkName && (
                    <span className="inline-flex items-center gap-1">
                      <Network className="size-3" /> {c.networkName}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.leaders.length > 0 ? `Lidera: ${c.leaders.join(" y ")}` : "Sin líder asignado"} · {c.memberCount} persona{c.memberCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CellFormDialog open={formOpen} networks={networks} types={types} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  )

  if (scope === "mine") return list
  return (
    <Tabs defaultValue="cells">
      <TabsList>
        <TabsTrigger value="cells">
          <Users className="size-4" /> Células
        </TabsTrigger>
        {canManage && (
          <>
            <TabsTrigger value="networks">
              <Network className="size-4" /> Redes
            </TabsTrigger>
            <TabsTrigger value="types">
              <Tag className="size-4" /> Tipos
            </TabsTrigger>
          </>
        )}
      </TabsList>
      <TabsContent value="cells">{list}</TabsContent>
      {canManage && (
        <>
          <TabsContent value="networks">
            <NetworksTab networks={networks} onChanged={loadCatalogs} />
          </TabsContent>
          <TabsContent value="types">
            <TypesTab types={types} onChanged={loadCatalogs} />
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}

// ── Alta / edición de una célula ──────────────────────────────────────────────

const cellSchema = yup.object({
  name: yup.string().trim().required("Escribe el nombre de la célula").max(120),
  typeId: yup.string().default(""),
  networkId: yup.string().default(""),
  dayOfWeek: yup.string().required("Elige el día"),
  startTime: yup.string().matches(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige la hora").required("Elige la hora"),
  hostName: yup.string().trim().max(150).default(""),
  street: yup.string().trim().max(150).default(""),
  neighborhood: yup.string().trim().max(150).default(""),
  city: yup.string().trim().max(150).default(""),
  reference: yup.string().trim().max(255).default(""),
  notes: yup.string().trim().max(2000).default(""),
  isActive: yup.boolean().default(true),
})
type CellValues = yup.InferType<typeof cellSchema>

export interface CellFormInitial {
  id: string
  name: string
  typeId: string | null
  networkId: string | null
  dayOfWeek: number
  startTime: string
  hostName: string | null
  street: string | null
  neighborhood: string | null
  city: string | null
  latitude?: number | null
  longitude?: number | null
  reference: string | null
  notes: string | null
  isActive: boolean
}

export function CellFormDialog({
  open,
  cell,
  networks,
  types,
  canChangeNetwork = true,
  onClose,
  onSaved,
}: {
  open: boolean
  /** null = alta. */
  cell?: CellFormInitial | null
  networks: { id: string; name: string }[]
  types: { id: string; name: string; isActive: boolean }[]
  canChangeNetwork?: boolean
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const [leaders, setLeaders] = useState<{ id: string; fullName: string }[]>([])
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null)
  const [q, setQ] = useState("")
  const [found, setFound] = useState<{ id: string; fullName: string }[]>([])
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CellValues>({ resolver: yupResolver(cellSchema) as never })

  useEffect(() => {
    if (!open) return
    setLeaders([])
    setQ("")
    setFound([])
    setGps(cell?.latitude != null && cell?.longitude != null ? { lat: cell.latitude, lon: cell.longitude } : null)
    reset({
      name: cell?.name ?? "",
      typeId: cell?.typeId ?? "",
      networkId: cell?.networkId ?? "",
      dayOfWeek: cell ? String(cell.dayOfWeek) : "",
      startTime: cell?.startTime ?? "",
      hostName: cell?.hostName ?? "",
      street: cell?.street ?? "",
      neighborhood: cell?.neighborhood ?? "",
      city: cell?.city ?? "",
      reference: cell?.reference ?? "",
      notes: cell?.notes ?? "",
      isActive: cell?.isActive ?? true,
    })
  }, [open, cell, reset])

  // Líderes al crear: búsqueda en el padrón (el resto se gestiona en la célula).
  useEffect(() => {
    if (!open || cell || q.trim().length < 2) {
      setFound([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const d = await apiJson<{ rows: { id: string; fullName: string }[] }>(`/api/crud/members?q=${encodeURIComponent(q)}&pageSize=10`)
        setFound(d.rows)
      } catch {
        setFound([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, cell])

  const submit = async (v: CellValues) => {
    try {
      const body = {
        ...v,
        dayOfWeek: Number(v.dayOfWeek),
        typeId: v.typeId || null,
        networkId: v.networkId || null,
        latitude: gps?.lat ?? null,
        longitude: gps?.lon ?? null,
        ...(cell ? {} : { leaderMemberIds: leaders.map((l) => l.id) }),
      }
      if (cell) await apiJson(`/api/cells/${cell.id}`, { method: "PUT", body: JSON.stringify(body) })
      else await apiJson("/api/cells", { method: "POST", body: JSON.stringify(body) })
      notify.success(cell ? "Célula guardada" : "Célula creada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={cell ? "Configurar célula" : "Nueva célula"}
      description="Cada célula se configura por separado: tipo, día, hora y lugar."
      className="max-w-[90vw]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2" data-form-field="name">
          <InputGroupField id="name" label="Nombre" required placeholder="Ej. Hogar de Amor Norte" error={errors.name?.message} {...register("name")} />
        </div>
        <Controller
          control={control}
          name="typeId"
          render={({ field }) => (
            <FormCombobox
              label="Tipo"
              options={types.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))}
              value={field.value}
              onChange={field.onChange}
              onClear={() => field.onChange("")}
              placeholder="Sin tipo"
            />
          )}
        />
        <Controller
          control={control}
          name="networkId"
          render={({ field }) => (
            <FormCombobox
              label="Red"
              options={networks.map((n) => ({ value: n.id, label: n.name }))}
              value={field.value}
              onChange={field.onChange}
              onClear={() => field.onChange("")}
              placeholder="Sin red"
              disabled={!canChangeNetwork}
            />
          )}
        />
        <div data-form-field="dayOfWeek">
          <Controller
            control={control}
            name="dayOfWeek"
            render={({ field }) => (
              <FormCombobox label="Día de reunión" required options={DAY_OPTIONS} value={field.value} onChange={field.onChange} clearable={false} error={errors.dayOfWeek?.message} />
            )}
          />
        </div>
        <div data-form-field="startTime">
          <Controller
            control={control}
            name="startTime"
            render={({ field }) => <TimePicker label="Hora" required value={field.value || null} onChange={(t) => field.onChange(t ?? "")} error={errors.startTime?.message} />}
          />
        </div>
        <div className="sm:col-span-2">
          <InputGroupField id="hostName" label="Anfitrión (quien presta su casa)" {...register("hostName")} />
        </div>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="street"
            render={({ field }) => (
              <AddressField
                label="Dirección donde se reúne"
                address={field.value ?? ""}
                onAddressChange={field.onChange}
                latitude={gps?.lat ?? null}
                longitude={gps?.lon ?? null}
                onGpsChange={setGps}
                helper="Con la ubicación, a quien llega a Consolidación se le sugiere la célula más cercana."
              />
            )}
          />
        </div>
        <InputGroupField id="reference" label="Referencias" placeholder="Ej. Portón negro, frente al parque" {...register("reference")} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" rows={2} {...register("notes")} />
        </div>

        {!cell && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Líderes (1 o 2)</Label>
            {leaders.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {leaders.map((l) => (
                  <li key={l.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                    {l.fullName}
                    <button type="button" aria-label={`Quitar a ${l.fullName}`} onClick={() => setLeaders((cur) => cur.filter((x) => x.id !== l.id))}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {leaders.length < 2 && (
              <>
                <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar líder en el padrón…" aria-label="Buscar líder" />
                {found.length > 0 && (
                  <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border">
                    {found.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setLeaders((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
                            setQ("")
                            setFound([])
                          }}
                        >
                          {m.fullName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">Un líder puede llevar varias células; cada una con su día y hora.</p>
          </div>
        )}
        {cell && (
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <SwitchField label="Activa" description="Una célula inactiva conserva su historial." checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
        )}
      </form>
    </DialogComponent>
  )
}

// ── Redes y tipos ─────────────────────────────────────────────────────────────

function NetworksTab({ networks, onChanged }: { networks: NetworkDto[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<NetworkDto | "new" | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Nueva red
        </Button>
      </div>
      {networks.length === 0 ? (
        <EmptyState icon={Network} title="Sin redes" description="Una red agrupa células a cargo de un discípulo." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {networks.map((n) => (
            <li key={n.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", !n.isActive && "opacity-60")}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{n.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {n.leaderName ? `A cargo de ${n.leaderName}` : "Sin encargado"} · {n.cellCount} célula{n.cellCount === 1 ? "" : "s"} · {n.memberCount} persona
                  {n.memberCount === 1 ? "" : "s"}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEditing(n)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <NetworkDialog network={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function NetworkDialog({ network, onClose, onSaved }: { network: NetworkDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const current = network && network !== "new" ? network : null
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [leader, setLeader] = useState<{ id: string; fullName: string } | null>(null)
  const [q, setQ] = useState("")
  const [found, setFound] = useState<{ id: string; fullName: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (network === null) return
    setName(current?.name ?? "")
    setDescription(current?.description ?? "")
    setLeader(current?.leaderMemberId ? { id: current.leaderMemberId, fullName: current.leaderName ?? "Encargado" } : null)
    setQ("")
    setFound([])
  }, [network, current])

  useEffect(() => {
    if (network === null || q.trim().length < 2) {
      setFound([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const d = await apiJson<{ rows: { id: string; fullName: string }[] }>(`/api/crud/members?q=${encodeURIComponent(q)}&pageSize=10`)
        setFound(d.rows)
      } catch {
        setFound([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, network])

  const save = async () => {
    setSaving(true)
    try {
      const body = JSON.stringify({ name, description, leaderMemberId: leader?.id ?? null })
      if (current) await apiJson(`/api/cells/networks/${current.id}`, { method: "PUT", body })
      else await apiJson("/api/cells/networks", { method: "POST", body })
      notify.success("Red guardada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={network !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar red" : "Nueva red"}
      description="Una red agrupa células a cargo, normalmente, de un discípulo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Nombre" required value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <InputGroupField label="Descripción" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
        <div className="space-y-2">
          <Label>Encargado de la red</Label>
          {leader ? (
            <p className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{leader.fullName}</span>
              <button type="button" aria-label="Quitar encargado" onClick={() => setLeader(null)}>
                <X className="size-4" />
              </button>
            </p>
          ) : (
            <>
              <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el padrón…" aria-label="Buscar encargado" />
              {found.length > 0 && (
                <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border">
                  {found.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setLeader(m)
                          setQ("")
                          setFound([])
                        }}
                      >
                        {m.fullName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </DialogComponent>
  )
}

function TypesTab({ types, onChanged }: { types: { id: string; name: string; isActive: boolean; cellCount: number }[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    try {
      await apiJson("/api/cells/types", { method: "POST", body: JSON.stringify({ name }) })
      setName("")
      await onChanged()
    } catch (e) {
      swalError("No se pudo agregar", errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const toggle = async (t: { id: string; name: string; isActive: boolean }) => {
    try {
      await apiJson(`/api/cells/types/${t.id}`, { method: "PUT", body: JSON.stringify({ name: t.name, isActive: !t.isActive }) })
      await onChanged()
    } catch (e) {
      swalError("No se pudo actualizar", errorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) void add()
        }}
      >
        <div className="flex-1">
          <InputGroupField label="Nuevo tipo" placeholder="Ej. De varones" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          <Plus className="size-4" />
          Agregar
        </Button>
      </form>
      <ul className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => (
          <li key={t.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", !t.isActive && "opacity-60")}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t.name}</span>
              <span className="block text-xs text-muted-foreground">
                {t.cellCount} célula{t.cellCount === 1 ? "" : "s"}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => void toggle(t)}>
              {t.isActive ? "Desactivar" : "Activar"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
