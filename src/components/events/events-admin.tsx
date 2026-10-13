"use client"

import { useCallback, useEffect, useId, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { CalendarDays, Loader2, MapPin, Plus, Ticket, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { SwitchField } from "@/components/base/switch-field"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { EVENT_KINDS } from "@/lib/events/rules"
import { GROWTH_EVENT_TEMPLATES, growthCheckForEventKind } from "@/lib/school/growth-rules"
import type { EventDetailDto, EventRowDto, VenueDto } from "@/lib/events/server"
import { VenuesPanel } from "./venue-editor"
import { cn } from "@/lib/utils"

// Eventos: listado y alta (internos y externos), y las áreas con su plano.

export const STATUS_LABEL = { draft: "Borrador", published: "Publicado", closed: "Cerrado", cancelled: "Cancelado" } as const
export const STATUS_TONE: Record<keyof typeof STATUS_LABEL, StatusTone> = { draft: "neutral", published: "success", closed: "info", cancelled: "danger" }
export const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

type Filter = "all" | "internal" | "external"

export function EventsAdmin({ canManageAll }: { canManageAll: boolean }) {
  const [events, setEvents] = useState<EventRowDto[] | null>(null)
  const [venues, setVenues] = useState<VenueDto[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ events: EventRowDto[] }>("/api/events?scope=all")
      setEvents(d.events)
    } catch (e) {
      setEvents([])
      swalError("No se pudieron cargar los eventos", errorMessage(e))
    }
  }, [])
  const loadVenues = useCallback(async () => {
    try {
      const d = await apiJson<{ venues: VenueDto[] }>("/api/events/venues")
      setVenues(d.venues)
    } catch {
      setVenues([])
    }
  }, [])

  useEffect(() => {
    void load()
    void loadVenues()
  }, [load, loadVenues])

  const rows = (events ?? []).filter((e) => filter === "all" || e.scope === filter)

  return (
    <Tabs defaultValue="events">
      <TabsList>
        <TabsTrigger value="events">
          <CalendarDays className="size-4" /> Eventos
        </TabsTrigger>
        <TabsTrigger value="venues">
          <MapPin className="size-4" /> Áreas y planos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="events">
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedFilter<Filter>
              ariaLabel="Tipo de evento"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Todos", count: events?.length },
                { value: "internal", label: "Internos" },
                { value: "external", label: "Externos" },
              ]}
            />
            <Button className="ml-auto" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Nuevo evento
            </Button>
          </div>
          {events === null ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState icon={Ticket} title="Sin eventos" description="Crea un evento con su itinerario, boletos y, si hace falta, el acomodo." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rows.map((e) => (
                <li key={e.id}>
                  <Link href={`/admin/events/${e.id}`} className={cn("press flex h-full gap-3 rounded-2xl border bg-card p-3 hover:border-primary/40", e.status === "cancelled" && "opacity-60")}>
                    {e.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.imageUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Ticket className="size-6" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{e.name}</span>
                        <StatusPill tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</StatusPill>
                      </span>
                      <span className="block text-xs text-muted-foreground first-letter:uppercase">{fmtWhen(e.startsAt)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[e.kind, e.groupName, e.venueName ?? e.location, e.scope === "external" ? "Externo" : null].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-1 flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {e.taken}
                          {e.capacity ? ` / ${e.capacity}` : ""}
                        </span>
                        <span>{e.price > 0 ? money(e.price) : "Sin costo"}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TabsContent>

      <TabsContent value="venues">
        <div className="pt-2">
          <VenuesPanel venues={venues} canManage={canManageAll} onChanged={loadVenues} />
        </div>
      </TabsContent>

      <EventFormDialog open={formOpen} event={null} venues={venues} onClose={() => setFormOpen(false)} onSaved={load} />
    </Tabs>
  )
}

// ── Alta / edición ────────────────────────────────────────────────────────────

const eventSchema = yup.object({
  name: yup.string().trim().required("Escribe el nombre del evento").max(150),
  kind: yup.string().default("Taller"),
  scope: yup.string().oneOf(["internal", "external"]).default("internal"),
  ministryId: yup.string().default(""),
  startsAt: yup.date().typeError("Elige fecha y hora").required("Elige fecha y hora"),
  endsAt: yup.date().nullable().default(null),
  location: yup.string().trim().max(200).default(""),
  venueId: yup.string().default(""),
  topic: yup.string().trim().max(200).default(""),
  description: yup.string().trim().max(4000).default(""),
  imageUrl: yup.string().default(""),
  price: yup.number().transform((v, o) => (o === "" || o === null ? 0 : v)).typeError("Monto inválido").min(0, "0 o más").default(0),
  capacity: yup.number().transform((v, o) => (o === "" || o === null ? undefined : v)).typeError("Número").integer("Entero").min(1, "Mínimo 1").optional(),
  audience: yup.string().oneOf(["open", "leaders", "ministries"]).default("open"),
  seating: yup.string().oneOf(["free", "sections", "seats"]).default("free"),
  seatSelection: yup.string().oneOf(["self", "assigned", "both"]).default("both"),
  selfRegistration: yup.boolean().default(true),
  sections: yup
    .array(
      yup.object({
        name: yup.string().trim().required("Nombre").max(60),
        capacity: yup.number().typeError("Cupo").integer().min(1, "Mínimo 1").required("Cupo"),
      })
    )
    .default([]),
})
type EventValues = yup.InferType<typeof eventSchema>

export function EventFormDialog({
  open,
  event,
  venues,
  onClose,
  onSaved,
}: {
  open: boolean
  event: EventDetailDto | null
  venues: VenueDto[]
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const router = useRouter()
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const [ministries, setMinistries] = useState<{ id: string; name: string; kind: string }[]>([])
  const [audienceIds, setAudienceIds] = useState<Set<string>>(new Set())
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventValues>({ resolver: yupResolver(eventSchema) as never })
  const sections = useFieldArray({ control, name: "sections" })
  const scope = watch("scope")
  const seating = watch("seating")
  const audience = watch("audience")
  const venueId = watch("venueId")

  useEffect(() => {
    if (!open) return
    apiJson<{ ministries: { id: string; name: string; kind: string }[] }>("/api/events/ministries")
      .then((d) => setMinistries(d.ministries))
      .catch(() => setMinistries([]))
    setAudienceIds(new Set(event?.audienceMinistryIds ?? []))
    reset({
      name: event?.name ?? "",
      kind: event?.kind ?? "Taller",
      scope: event?.scope ?? "internal",
      ministryId: event?.ministryId ?? "",
      startsAt: event ? new Date(event.startsAt) : (undefined as unknown as Date),
      endsAt: event?.endsAt ? new Date(event.endsAt) : null,
      location: event?.location ?? "",
      venueId: event?.venueId ?? "",
      topic: event?.topic ?? "",
      description: event?.description ?? "",
      imageUrl: event?.imageUrl ?? "",
      price: event?.price ?? 0,
      capacity: event?.capacity ?? undefined,
      audience: event?.audience ?? "open",
      seating: event?.seating ?? "free",
      seatSelection: event?.seatSelection ?? "both",
      selfRegistration: event?.selfRegistration ?? true,
      sections: event?.sections.map((s) => ({ name: s.name, capacity: s.capacity })) ?? [],
    })
  }, [open, event, reset])

  const submit = async (v: EventValues) => {
    try {
      const body = {
        ...v,
        ministryId: v.ministryId || null,
        venueId: v.scope === "internal" ? v.venueId || null : null,
        startsAt: v.startsAt.toISOString(),
        endsAt: v.endsAt ? v.endsAt.toISOString() : null,
        capacity: v.capacity ?? null,
        audienceMinistryIds: [...audienceIds],
      }
      let id = event?.id
      if (event) await apiJson(`/api/events/${event.id}`, { method: "PUT", body: JSON.stringify(body) })
      else id = (await apiJson<{ id: string }>("/api/events", { method: "POST", body: JSON.stringify(body) })).id
      notify.success(event ? "Evento guardado" : "Evento creado como borrador")
      onClose()
      await onSaved()
      if (!event && id) router.push(`/admin/events/${id}`)
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    }
  }

  const selectedVenue = venues.find((x) => x.id === venueId)

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={event ? "Configurar evento" : "Nuevo evento"}
      description="Datos generales, público, costo y acomodo. El itinerario y los boletos se arman después."
      className="max-w-[96vw] md:max-w-3xl"
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
          <InputGroupField id="name" label="Nombre" required error={errors.name?.message} {...register("name")} />
        </div>
        <Controller
          control={control}
          name="scope"
          render={({ field }) => (
            <FormCombobox
              label="Tipo"
              options={[
                { value: "internal", label: "Interno (en la iglesia)" },
                { value: "external", label: "Externo (fuera o con terceros)" },
              ]}
              value={field.value}
              onChange={field.onChange}
              clearable={false}
            />
          )}
        />
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <FormCombobox
              label="Clase de evento"
              options={EVENT_KINDS.map((k) => ({ value: k, label: k }))}
              value={field.value}
              onChange={(v) => {
                field.onChange(v)
                // El bautismo, el encuentro y el lanzamiento siempre tienen la misma estructura.
                const check = growthCheckForEventKind(v)
                if (!check || event) return
                if (!getValues("name")?.trim()) setValue("name", v)
                if (!getValues("description")?.trim()) setValue("description", GROWTH_EVENT_TEMPLATES[check].description)
                if (check === "baptism") setValue("price", 0)
              }}
              clearable={false}
              helper="Bautismo en aguas, Encuentro con Jesús y Lanzamiento marcan el crecimiento de quien asiste al finalizar el evento."
            />
          )}
        />
        <div data-form-field="startsAt">
          <Controller
            control={control}
            name="startsAt"
            render={({ field }) => (
              <DateTimePicker label="Inicia" required value={field.value ?? null} onChange={(d) => field.onChange(d ?? undefined)} error={errors.startsAt?.message} />
            )}
          />
        </div>
        <Controller control={control} name="endsAt" render={({ field }) => <DateTimePicker label="Termina (opcional)" value={field.value ?? null} onChange={(d) => field.onChange(d ?? null)} />} />
        <Controller
          control={control}
          name="ministryId"
          render={({ field }) => (
            <FormCombobox
              label="Grupo organizador"
              options={ministries.map((m) => ({ value: m.id, label: m.name }))}
              value={field.value}
              onChange={field.onChange}
              onClear={() => field.onChange("")}
              placeholder="Toda la iglesia"
              helper="Quien lidera el grupo (Jóvenes, Varones…) gestiona el evento."
            />
          )}
        />
        {scope === "internal" ? (
          <Controller
            control={control}
            name="venueId"
            render={({ field }) => (
              <FormCombobox
                label="Área"
                options={venues.filter((v) => v.isActive).map((v) => ({ value: v.id, label: v.capacity > 0 ? `${v.name} · ${v.capacity} lugares` : v.name }))}
                value={field.value}
                onChange={field.onChange}
                onClear={() => field.onChange("")}
                placeholder="Sin área"
              />
            )}
          />
        ) : (
          <div className="sm:col-span-1">
            <InputGroupField id="location" label="Lugar" placeholder="Dirección o nombre del lugar" {...register("location")} />
          </div>
        )}
        <div className="sm:col-span-2">
          <InputGroupField id="topic" label="Tema" {...register("topic")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" rows={3} {...register("description")} />
        </div>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <Attachment label="Imagen o cartel (opcional)" value={field.value || null} onChange={(u) => field.onChange(u ?? "")} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} />
            )}
          />
        </div>

        <div data-form-field="price">
          <InputGroupField id="price" label="Costo por boleto (0 = sin costo)" inputMode="decimal" error={errors.price?.message} {...register("price")} />
        </div>
        <div data-form-field="capacity">
          <InputGroupField id="capacity" label="Cupo (vacío = sin límite)" inputMode="numeric" error={errors.capacity?.message} {...register("capacity")} />
        </div>

        <Controller
          control={control}
          name="audience"
          render={({ field }) => (
            <FormCombobox
              label="Público"
              options={[
                { value: "open", label: "Abierto a todos" },
                { value: "leaders", label: "Solo líderes" },
                { value: "ministries", label: "Miembros de ministerios elegidos" },
              ]}
              value={field.value}
              onChange={field.onChange}
              clearable={false}
            />
          )}
        />
        <Controller
          control={control}
          name="selfRegistration"
          render={({ field }) => (
            <SwitchField label="Registro en línea" description="Cada creyente puede apartar su boleto." checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        {audience === "ministries" && (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-semibold">Ministerios con acceso</legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {ministries.map((m) => (
                <label key={m.id} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm", audienceIds.has(m.id) && "border-primary bg-primary/5")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={audienceIds.has(m.id)}
                    onChange={() =>
                      setAudienceIds((cur) => {
                        const next = new Set(cur)
                        if (next.has(m.id)) next.delete(m.id)
                        else next.add(m.id)
                        return next
                      })
                    }
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {scope === "internal" && (
          <>
            <Controller
              control={control}
              name="seating"
              render={({ field }) => (
                <FormCombobox
                  label="Acomodo"
                  options={[
                    { value: "free", label: "Libre (sin lugar asignado)" },
                    { value: "sections", label: "Por secciones con cupo" },
                    { value: "seats", label: "Asientos o mesas del plano" },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                  clearable={false}
                />
              )}
            />
            {seating === "seats" && (
              <Controller
                control={control}
                name="seatSelection"
                render={({ field }) => (
                  <FormCombobox
                    label="¿Quién elige el lugar?"
                    options={[
                      { value: "both", label: "Cada persona o el personal" },
                      { value: "self", label: "Cada persona elige" },
                      { value: "assigned", label: "Lo asigna el personal" },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    clearable={false}
                  />
                )}
              />
            )}
            {seating === "seats" && !selectedVenue && <p className="text-xs text-destructive sm:col-span-2">Elige un área con plano para asignar asientos.</p>}
            {seating === "seats" && selectedVenue && selectedVenue.capacity === 0 && (
              <p className="text-xs text-destructive sm:col-span-2">Esa área aún no tiene asientos dibujados; edítala en «Áreas y planos».</p>
            )}
            {seating === "sections" && (
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-semibold">Secciones y cupo</legend>
                {sections.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_8rem_auto] items-start gap-2">
                    <InputGroupField aria-label="Nombre de la sección" placeholder="Ej. General" error={errors.sections?.[i]?.name?.message} {...register(`sections.${i}.name` as const)} />
                    <InputGroupField aria-label="Cupo" placeholder="Cupo" inputMode="numeric" error={errors.sections?.[i]?.capacity?.message} {...register(`sections.${i}.capacity` as const)} />
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar sección" onClick={() => sections.remove(i)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => sections.append({ name: "", capacity: 50 })}>
                  <Plus className="size-4" />
                  Agregar sección
                </Button>
              </fieldset>
            )}
          </>
        )}
      </form>
    </DialogComponent>
  )
}
