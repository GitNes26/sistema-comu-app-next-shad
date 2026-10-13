import { useEffect, useId, useMemo, useState } from "react"
import * as yup from "yup"
import { icons, AlertCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { OptionSelect } from "./option-select"
import { MultiSelect } from "./multi-select"
import { Attachment } from "@/components/base/attachment"
import { ImageDropzoneField } from "./image-dropzone-field"
import { GpsPicker } from "@/components/base/gps-picker"
import { AddressField } from "@/components/base/address-field"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { ScheduleEditor } from "@/components/base/schedule-editor"
import { DatePicker } from "@/components/base/date-picker"
import { TimePicker } from "@/components/base/time-picker"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { parseSchedule, emptySchedule } from "@/lib/schedule"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import type { CrudField, CrudUiConfig } from "./crud-config"
import { cn } from "@/lib/utils"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { ApiError } from "@/lib/api"

interface CrudFormProps {
  config: CrudUiConfig
  initial: Record<string, unknown> | null
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onSavingChange?: (selling: boolean) => void
  formId?: string
  /** Componente renderizado después de los campos, recibe los valores actuales del formulario. */
  afterFields?: React.ComponentType<{ values: Record<string, unknown> }>
  beforeFields?: React.ComponentType<{ values: Record<string, unknown> }>
}

function defaultValue(
  field: CrudField,
  initial: Record<string, unknown> | null
) {
  if (field.type === "gps") return undefined
  if (field.type === "schedule") {
    if (initial && initial[field.key] != null) return parseSchedule(initial[field.key])
    return emptySchedule()
  }
  if (
    initial &&
    initial[field.key] !== undefined &&
    initial[field.key] !== null
  ) {
    return initial[field.key]
  }
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.type === "boolean") return field.key === "active" || field.key === "isActive"
  if (field.type === "multiselect") return [] as string[]
  return ""
}

function buildYupSchema(fields: CrudField[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape: Record<string, yup.Schema<any>> = {}
  for (const f of fields) {
    if (f.type === "gps" || f.type === "schedule") continue

    if (f.type === "number" || f.type === "money" || f.type === "percent") {
      let schema = yup
        .number()
        .transform((v, orig) => (orig === "" || orig === undefined ? undefined : v))
      if (f.min !== undefined) schema = schema.min(f.min, `Mínimo ${f.min}`)
      if (f.max !== undefined) schema = schema.max(f.max, `Máximo ${f.max}`)
      if (f.required) {
        schema = schema.required(f.requiredMessage || `${f.label} es obligatorio`)
      }
      shape[f.key] = schema
      continue
    }

    if (f.type === "multiselect") {
      shape[f.key] = f.required
        ? yup.array().of(yup.string()).min(1, `${f.label} es obligatorio`).required()
        : yup.array().of(yup.string()).optional()
      continue
    }
    if (f.type === "boolean") {
      shape[f.key] = f.required
        ? yup.boolean().isTrue(`${f.label} es obligatorio`)
        : yup.boolean().optional()
      continue
    }
    if (f.type === "image") {
      shape[f.key] = f.required
        ? yup.string().nullable().required(f.requiredMessage || `${f.label} es obligatorio`)
        : yup.string().nullable().optional()
      continue
    }

    // text / textarea / select
    let schema = yup.string()
    if (f.maxLength !== undefined) schema = schema.max(f.maxLength, `Máximo ${f.maxLength} caracteres`)
    if (f.minLength !== undefined) schema = schema.min(f.minLength, `Mínimo ${f.minLength} caracteres`)
    if (f.yup) {
      for (const [method, def] of Object.entries(f.yup)) {
        if (method === "email" && typeof def === "object" && "message" in def) {
          schema = schema.email(def.message)
        } else if (method === "url" && typeof def === "object" && "message" in def) {
          schema = schema.url(def.message)
        } else if (method === "matches" && Array.isArray(def)) {
          schema = schema.matches(def[0] as RegExp, def[1])
        } else if (method === "max" && Array.isArray(def)) {
          schema = schema.max(def[0] as number, def[1])
        } else if (method === "min" && Array.isArray(def)) {
          schema = schema.min(def[0] as number, def[1])
        } else if (method === "trim" && typeof def === "object" && "message" in def) {
          schema = schema.trim(def.message)
        } else if (typeof def === "object" && "message" in def) {
          // Generic: call method by name with message
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = schema as any
          if (typeof s[method] === "function") schema = s[method](def.message)
        }
      }
    }
    if (f.required) {
      schema = schema.required(f.requiredMessage || `${f.label} es obligatorio`)
    }
    shape[f.key] = schema
  }
  return yup.object().shape(shape)
}

function applyTransform(value: unknown, field: CrudField): unknown {
  if (typeof value !== "string") return value
  if (field.transform === "uppercase") return value.toUpperCase()
  if (field.transform === "lowercase") return value.toLowerCase()
  if (field.transform === "trim") return value.trim()
  return value
}

function registerAbbreviation(name: string): string {
  const clean = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, " ").trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts.map((part) => part[0]).join("") : clean.slice(0, 3)).slice(0, 4) || "CJ"
}

const getIcon = (name: string): LucideIcon | undefined =>
  icons[name as keyof typeof icons]

function fieldIcon(type: string, iconKey?: string): React.ReactNode {
  if (iconKey) {
    const Ico = getIcon(iconKey)
    if (Ico) return <Ico className="size-4" />
  }
  const fallback: Record<string, string> = {
    text: "Type",
    email: "Mail",
    phone: "Phone",
    code: "ScanLine",
    number: "Hash",
    money: "DollarSign",
    percent: "Percent",
    date: "CalendarDays",
    time: "Clock",
    datetime: "CalendarClock",
    textarea: "FileText",
    password: "Key",
    select: "ListFilter",
    multiselect: "ListChecks",
    image: "Image",
    gps: "MapPinned",
    schedule: "CalendarRange",
    address: "MapPin",
    boolean: "ToggleLeft",
  }
  const FallbackIcon = getIcon(fallback[type] ?? "Type")
  if (!FallbackIcon) return null
  return <FallbackIcon className="size-4" />
}

function FieldWrapper({
  field,
  id,
  error,
  showError = true,
  children,
}: {
  field: CrudField
  id?: string
  error?: string
  showError?: boolean
  children: React.ReactNode
}) {
  return (
    <div data-form-field={field.key} className={cn(field.full ? "sm:col-span-2" : "")}>
      <div className="space-y-1.5">
        {children}
        {field.note && !error && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {field.note}
          </p>
        )}
        {error && showError && (
          <p id={id ? `${id}-error` : undefined} role="alert" className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ field, id }: { field: CrudField; id?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{fieldIcon(field.type, field.icon)}</span>
      <Label htmlFor={id} className="cursor-pointer leading-none">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.help && <InfoTooltip text={field.help} />}
    </div>
  )
}

export function CrudForm({
  config,
  initial,
  onSubmit,
  onSavingChange,
  formId = "crud-form",
  afterFields: AfterFields,
  beforeFields: BeforeFields,
}: CrudFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    for (const f of config.fields) v[f.key] = defaultValue(f, initial)
    return v
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string>()
  const [locationCodes, setLocationCodes] = useState<Record<string, string>>({})
  const schema = useMemo(() => buildYupSchema(config.fields), [config.fields])
  const visibleFields = useMemo(() => config.fields, [config.fields])
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  const uid = useId().replace(/[:]/g, "")
  const fieldId = (key: string) => `${uid}-f-${key}`

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => focusFirstEnabled(formId))
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, formId])

  useEffect(() => {
    if (initial) return
    const controller = new AbortController()
    void fetch(`/api/crud/${config.module}?defaults=1`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<{ defaults?: Record<string, unknown> }>
      })
      .then((result) => {
        if (!result?.defaults) return
        const defaults = result.defaults
        setValues((current) => {
          const next = { ...current }
          for (const [key, value] of Object.entries(defaults)) {
            if (next[key] === "" || next[key] === null || next[key] === undefined) next[key] = value
          }
          return next
        })
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[crud-form] No se pudieron cargar los valores iniciales", error)
        }
      })
    return () => controller.abort()
  }, [config.module, initial])

  useEffect(() => {
    if (config.module !== "cashRegisters") return
    const controller = new AbortController()
    void fetch("/api/crud/locations?pageSize=100", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { rows?: Array<{ id: string; code?: string; name?: string }> } | null) => {
        if (!result?.rows) return
        setLocationCodes(Object.fromEntries(result.rows.map((row) => [row.id, (row.code || row.name || "SUC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)])))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [config.module])

  useEffect(() => {
    if (config.module !== "cashRegisters") return
    const locationId = String(values.locationId ?? "")
    const locationCode = locationCodes[locationId]
    if (!locationCode) return
    const prefix = `${locationCode}-${registerAbbreviation(String(values.name ?? ""))}`.slice(0, 10)
    setValues((current) => current.folioPrefix === prefix ? current : { ...current, folioPrefix: prefix })
  }, [config.module, locationCodes, values.locationId, values.name])

  const set = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setServerError(undefined)
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}
    try {
      await schema.validate(values, { abortEarly: false })
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        for (const e of err.inner) {
          if (e.path && !newErrors[e.path]) newErrors[e.path] = e.message
        }
      }
    }

    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue
      if (field.required && field.type === "gps") {
        const lat = field.latKey ? values[field.latKey] : undefined
        const lon = field.lonKey ? values[field.lonKey] : undefined
        if (lat === "" || lat == null || lon === "" || lon == null) {
          newErrors[field.key] = field.requiredMessage || `${field.label} es obligatorio`
        }
      }
      for (const validator of field.validate ?? []) {
        const message = validator(values[field.key], values)
        if (message && !newErrors[field.key]) newErrors[field.key] = message
      }
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      window.requestAnimationFrame(() => focusFirstInvalid(newErrors, formId))
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Los formularios de creación rápida viven en un portal, pero sus eventos
    // conservan la jerarquía de React. Evita que el submit alcance el formulario
    // padre y cierre también su diálogo.
    e.stopPropagation()
    const valid = await validateForm()
    if (!valid) return

    const payload: Record<string, unknown> = {}
    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue
      if (field.type === "gps") continue
      let v = values[field.key]
      v = applyTransform(v, field)
      if (
        field.type === "number" ||
        field.type === "money" ||
        field.type === "percent"
      ) {
        v = v === "" || v === undefined || v === null ? "" : Number(v)
      }
      if (field.type === "schedule") {
        v = JSON.stringify(v ?? emptySchedule())
      }
      payload[field.key] = v
    }

    onSavingChange?.(true)
    setServerError(undefined)
    try {
      await onSubmit(payload)
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        const nextErrors = { [err.field]: err.message }
        setErrors((current) => ({ ...current, ...nextErrors }))
        window.requestAnimationFrame(() =>
          focusFirstInvalid(nextErrors, formId)
        )
      } else {
        setServerError(
          err instanceof Error
            ? err.message
            : "No se pudo guardar. Revisa los datos e inténtalo de nuevo."
        )
      }
    } finally {
      onSavingChange?.(false)
    }
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-4 sm:grid-cols-2"
    >
      {serverError && (
        <div role="alert" tabIndex={-1} className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}
      {AfterFields && (
        <div className="sm:col-span-2 -mb-2">
          <AfterFields values={values} />
        </div>
      )}
      {visibleFields.map((field) => {
        if (field.showIf && !field.showIf(values)) return null
        const value = values[field.key]
        const id = fieldId(field.key)
        const error = errors[field.key]

        const errorClass = error ? "border-destructive focus-visible:ring-destructive/20" : ""

        // ── boolean → SwitchField ──
        if (field.type === "boolean") {
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <SwitchField
                id={id}
                label={field.label}
                description={field.description}
                icon={fieldIcon(field.type, field.icon)}
                checked={Boolean(value)}
                onCheckedChange={(c) => set(field.key, c)}
                required={field.required}
                error={error}
              />
            </FieldWrapper>
          )
        }

        // ── textarea → Textarea + Label ──
        if (field.type === "textarea") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <FieldLabel field={field} id={id} />
              <Textarea
                id={id}
                value={String(value ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className={cn(error && "border-destructive focus-visible:ring-destructive/20")}
              />
            </FieldWrapper>
          )
        }

        // ── select → FormCombobox (via OptionSelect) ──
        if (field.type === "select") {
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <OptionSelect
                id={id}
                field={field}
                value={String(value ?? "")}
                onChange={(v) => set(field.key, v)}
                error={error}
                icon={fieldIcon(field.type, field.icon)}
              />
            </FieldWrapper>
          )
        }

        // ── multiselect → MultiSelect + Label ──
        if (field.type === "multiselect") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <FieldLabel field={field} id={id} />
              <MultiSelect
                id={id}
                field={field}
                value={value}
                onChange={(v) => set(field.key, v)}
                error={error}
              />
            </FieldWrapper>
          )
        }

        // ── image → Attachment + Label ──
        if (field.type === "image") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <FieldLabel field={field} id={id} />
              {field.dropzone ? (
                <ImageDropzoneField
                  value={value ? String(value) : null}
                  onChange={(v) => set(field.key, v)}
                />
              ) : (
                <Attachment
                  value={value ? String(value) : null}
                  onChange={(v) => set(field.key, v)}
                  upload={uploadFile}
                  accept={UPLOAD_IMAGE_ACCEPT}
                  label=""
                  widthClass="w-24"
                  heightClass="h-24"
                />
              )}
            </FieldWrapper>
          )
        }

        // ── gps → GpsPicker (maneja su propio label) ──
        if (field.type === "gps") {
          const latRaw = field.latKey ? values[field.latKey] : undefined
          const lonRaw = field.lonKey ? values[field.lonKey] : undefined
          const lat = Number(latRaw)
          const lon = Number(lonRaw)
          const gpsValue =
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            String(latRaw) !== "" &&
            String(lonRaw) !== ""
              ? { lat, lon }
              : undefined
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <GpsPicker
                id={id}
                value={gpsValue}
                label={field.label}
                helper={field.help}
                required={field.required}
                error={error}
                onChange={(g) => {
                  if (field.latKey && g) set(field.latKey, g.lat)
                  if (field.lonKey && g) set(field.lonKey, g.lon)
                }}
              />
            </FieldWrapper>
          )
        }

        // ── schedule → ScheduleEditor + Label ──
        if (field.type === "schedule") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <FieldLabel field={field} id={id} />
              <div id={id} tabIndex={-1} className={cn("rounded-lg border bg-muted/30 p-3", error && "border-destructive ring-3 ring-destructive/20")}>
                <ScheduleEditor
                  schedule={(value as ReturnType<typeof parseSchedule>) ?? emptySchedule()}
                  onChange={(s) => set(field.key, s)}
                />
              </div>
            </FieldWrapper>
          )
        }

        // ── address → AddressField (maneja su propio label) ──
        if (field.type === "address") {
          const latRaw = field.latKey ? values[field.latKey] : undefined
          const lonRaw = field.lonKey ? values[field.lonKey] : undefined
          const lat = Number(latRaw)
          const lon = Number(lonRaw)
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <AddressField
                id={id}
                address={String(value ?? "")}
                onAddressChange={(v) => set(field.key, v)}
                latitude={Number.isFinite(lat) && String(latRaw) !== "" ? lat : null}
                longitude={Number.isFinite(lon) && String(lonRaw) !== "" ? lon : null}
                onGpsChange={(g) => {
                  if (field.latKey && g) set(field.latKey, g.lat)
                  if (field.lonKey && g) set(field.lonKey, g.lon)
                }}
                label={field.label}
                required={field.required}
                placeholder={field.placeholder}
                helper={field.help}
                error={error}
                icon={fieldIcon(field.type, field.icon)}
              />
            </FieldWrapper>
          )
        }

        // ── date → DatePicker ──
        if (field.type === "date") {
          const dateVal = value instanceof Date ? value : typeof value === "string" && value ? new Date(value + "T00:00:00") : null
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <DatePicker
                id={id}
                value={dateVal}
                onChange={(d) => set(field.key, d ? d.toISOString().slice(0, 10) : "")}
                onClear={() => set(field.key, "")}
                label={field.label}
                required={field.required}
                helper={field.help}
                error={error}
                placeholder={field.placeholder}
              />
            </FieldWrapper>
          )
        }

        // ── time → TimePicker ──
        if (field.type === "time") {
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <TimePicker
                id={id}
                value={String(value ?? "")}
                onChange={(t) => set(field.key, t ?? "")}
                label={field.label}
                required={field.required}
                helper={field.help}
                error={error}
              />
            </FieldWrapper>
          )
        }

        // ── datetime → DateTimePicker ──
        if (field.type === "datetime") {
          const dtVal = value instanceof Date ? value : typeof value === "string" && value ? new Date(value) : null
          return (
            <FieldWrapper key={field.key} field={field} error={error} showError={false}>
              <DateTimePicker
                id={id}
                value={dtVal}
                onChange={(d) => set(field.key, d ? d.toISOString() : "")}
                label={field.label}
                required={field.required}
                helper={field.help}
                error={error}
              />
            </FieldWrapper>
          )
        }

        // ── text/number/money/percent → InputGroupField ──
        return (
          <FieldWrapper key={field.key} field={field} error={error} showError={false}>
            <InputGroupField
              id={id}
              label={field.label}
              required={field.required}
              error={error}
              helper={error ? undefined : field.help}
              leftIcon={fieldIcon(field.type, field.icon)}
              type={
                field.type === "password"
                  ? "password"
                  : field.type === "phone"
                    ? "tel"
                    : field.type === "email"
                      ? "email"
                      : field.type === "number" ||
                      field.type === "money" ||
                      field.type === "percent"
                    ? "number"
                    : "text"
              }
              step={
                field.type === "percent" || field.type === "number"
                  ? "any"
                  : field.type === "money"
                    ? "0.01"
                    : undefined
              }
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              value={String(value ?? "")}
              onChange={(e) => set(field.key, e.target.value)}
              className={errorClass}
            />
          </FieldWrapper>
        )
      })}
      {BeforeFields && (
        <div className="sm:col-span-2 -mb-2">
          <BeforeFields values={values} />
        </div>
      )}
    </form>
  )
}
