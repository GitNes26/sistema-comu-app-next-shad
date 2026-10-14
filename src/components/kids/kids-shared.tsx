"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useEffect, useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Loader2, Search, X } from "lucide-react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { RELATIONS, qrPayload } from "@/lib/kids/rules"
import type { ChildDto } from "@/lib/kids/server"

// Piezas compartidas por el espacio del personal y «Mis hijos».

export const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const dateFromYmd = (s: string) => new Date(`${s}T12:00:00`)
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })

export const RELATION_OPTIONS = RELATIONS.map((r) => ({ value: r, label: r }))
const GENDER_OPTIONS = [
  { value: "female", label: "Niña" },
  { value: "male", label: "Niño" },
]

/** QR del niño (se genera en el navegador; el token nunca sale a un servicio externo). */
export function QrImage({ token, size = 240, className }: { token: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(qrPayload(token), { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [token, size])
  if (!src) return <div className={className} style={{ width: size, height: size }} aria-busy />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Código QR del niño" width={size} height={size} className={className} />
}

/** Busca creyentes (por nombre o teléfono) para vincularlos como tutores. */
export function GuardianPicker({ ministryId, onPick }: { ministryId: string; onPick: (m: { id: string; fullName: string; phone: string | null }) => void }) {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<{ id: string; fullName: string; phone: string | null }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) {
      setRows([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const d = await apiJson<{ members: { id: string; fullName: string; phone: string | null }[] }>(
          `/api/kids/${ministryId}/guardian-search?q=${encodeURIComponent(q)}`
        )
        setRows(d.members)
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, ministryId])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar papá, mamá o tutor por nombre o teléfono…"
          aria-label="Buscar tutor"
          className="pl-9 md:pl-9 desk:pl-9"
        />
      </div>
      {(loading || rows.length > 0) && (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-xl border">
          {loading && (
            <li className="flex justify-center p-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onPick(m)
                  setQ("")
                  setRows([])
                }}
              >
                <span className="text-sm font-medium">{m.fullName}</span>
                {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Alta y edición de un niño ────────────────────────────────────────────────

const childSchema = yup.object({
  fullName: yup.string().trim().required("Escribe el nombre del niño").max(150),
  birthDate: yup.date().typeError("Elige la fecha de nacimiento").required("Elige la fecha de nacimiento"),
  gender: yup.string().default(""),
  indications: yup.string().trim().max(2000).default(""),
  imageUrl: yup.string().default(""),
  relation: yup.string().default("Padre/Madre"),
})
type ChildValues = yup.InferType<typeof childSchema>

export function ChildFormDialog({
  mode,
  ministryId,
  child,
  open,
  rooms,
  onClose,
  onSaved,
}: {
  mode: "staff" | "guardian"
  ministryId?: string
  /** null = alta; con valor = edición. */
  child: ChildDto | null
  open: boolean
  rooms?: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const [guardians, setGuardians] = useState<{ memberId: string; fullName: string; relation: string }[]>([])
  const [roomId, setRoomId] = useState("")
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChildValues>({ resolver: yupResolver(childSchema) as never })
  const relation = watch("relation")

  useEffect(() => {
    if (!open) return
    setGuardians([])
    setRoomId(child?.roomId ?? "")
    reset({
      fullName: child?.fullName ?? "",
      birthDate: child ? dateFromYmd(child.birthDate) : (undefined as unknown as Date),
      gender: child?.gender ?? "",
      indications: child?.indications ?? "",
      imageUrl: child?.imageUrl ?? "",
      relation: "Padre/Madre",
    })
  }, [open, child, reset])

  const submit = async (v: ChildValues) => {
    try {
      const base = {
        fullName: v.fullName,
        birthDate: ymdOfLocal(v.birthDate),
        gender: v.gender || null,
        indications: v.indications,
        imageUrl: v.imageUrl || null,
        ...(mode === "staff" ? { roomId: roomId || null } : {}),
      }
      if (child) {
        await apiJson(`/api/kids/children/${child.id}`, { method: "PUT", body: JSON.stringify(base) })
      } else if (mode === "guardian") {
        await apiJson("/api/kids/mine", { method: "POST", body: JSON.stringify({ ...base, relation: v.relation }) })
      } else {
        if (guardians.length === 0) {
          swalError("Falta un tutor", "Vincula al menos a un papá, mamá o tutor para que reciba el QR y los avisos.")
          return
        }
        await apiJson(`/api/kids/${ministryId}/children`, {
          method: "POST",
          body: JSON.stringify({ ...base, guardians: guardians.map((g) => ({ memberId: g.memberId, relation: g.relation })) }),
        })
      }
      notify.success(child ? "Datos guardados" : "Niño registrado")
      onClose()
      await onSaved()
    } catch (err) {
      swalError("No se pudo guardar", errorMessage(err))
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={child ? "Editar niño" : "Registrar niño"}
      description="Estos datos los ven los maestros durante el servicio."
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
        <div className="sm:col-span-2" data-form-field="fullName">
          <InputGroupField id="fullName" label="Nombre completo" required autoComplete="off" error={errors.fullName?.message} {...register("fullName")} />
        </div>
        <div data-form-field="birthDate">
          <Controller
            control={control}
            name="birthDate"
            render={({ field }) => (
              <DatePicker
                label="Fecha de nacimiento"
                required
                value={field.value ?? null}
                onChange={(d) => field.onChange(d ?? undefined)}
                disabledAfter={new Date()}
                fromYear={new Date().getFullYear() - 18}
                toYear={new Date().getFullYear()}
                error={errors.birthDate?.message}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <FormCombobox label="Sexo" options={GENDER_OPTIONS} value={field.value} onChange={field.onChange} onClear={() => field.onChange("")} placeholder="—" />
          )}
        />
        <TextareaField id="indications" label="Indicaciones para los maestros" containerClassName="sm:col-span-2" rows={3} placeholder="Alergias, cuidados, a quién no entregarlo…" {...register("indications")} />
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <Attachment label="Foto (opcional)" value={field.value || null} onChange={(u) => field.onChange(u ?? "")} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} />
            )}
          />
        </div>

        {mode === "guardian" && !child && (
          <Controller
            control={control}
            name="relation"
            render={({ field }) => (
              <FormCombobox label="Tu parentesco" options={RELATION_OPTIONS} value={relation} onChange={field.onChange} clearable={false} />
            )}
          />
        )}

        {mode === "staff" && rooms && (
          <FormCombobox
            label="Salón (si no es el de su edad)"
            options={rooms.map((r) => ({ value: r.id, label: r.name }))}
            value={roomId}
            onChange={setRoomId}
            onClear={() => setRoomId("")}
            placeholder="Según su edad"
          />
        )}

        {mode === "staff" && !child && ministryId && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Papás o tutores</Label>
            {guardians.length > 0 && (
              <ul className="space-y-1.5">
                {guardians.map((g) => (
                  <li key={g.memberId} className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{g.fullName}</span>
                    <span className="w-36 shrink-0">
                      <FormCombobox
                        ariaLabel={`Parentesco de ${g.fullName}`}
                        options={RELATION_OPTIONS}
                        value={g.relation}
                        clearable={false}
                        onChange={(v) => setGuardians((cur) => cur.map((x) => (x.memberId === g.memberId ? { ...x, relation: v } : x)))}
                      />
                    </span>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar a ${g.fullName}`} onClick={() => setGuardians((cur) => cur.filter((x) => x.memberId !== g.memberId))}>
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <GuardianPicker
              ministryId={ministryId}
              onPick={(m) =>
                setGuardians((cur) => (cur.some((x) => x.memberId === m.id) ? cur : [...cur, { memberId: m.id, fullName: m.fullName, relation: "Padre/Madre" }]))
              }
            />
            <p className="text-xs text-muted-foreground">Si el papá o la mamá no están en el padrón, regístralos primero en Creyentes.</p>
          </div>
        )}
      </form>
    </DialogComponent>
  )
}
