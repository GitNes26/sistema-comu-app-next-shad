"use client"

import { useEffect, useState } from "react"
import { Loader2, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Attachment } from "@/components/base/attachment"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { uploadFile } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { ProfileDto } from "@/lib/portal/server"

// «Mi perfil»: el creyente mantiene sus datos de contacto. Nombre, jerarquía, etapa,
// bautismos y discipulado los administra la iglesia (se muestran, no se editan).

const MARITAL = [
  { value: "single", label: "Soltero(a)" },
  { value: "married", label: "Casado(a)" },
  { value: "free_union", label: "Unión libre" },
  { value: "separated", label: "Separado(a)" },
  { value: "divorced", label: "Divorciado(a)" },
  { value: "widowed", label: "Viudo(a)" },
]
const GENDER = [
  { value: "female", label: "Mujer" },
  { value: "male", label: "Hombre" },
]

const toDate = (ymd: string | null) =>
  ymd ? new Date(`${ymd}T12:00:00`) : null
const toYmd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : null

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileDto | null | undefined>(
    undefined
  )
  const [form, setForm] = useState<Record<string, string>>({})
  const [birth, setBirth] = useState<Date | null>(null)
  const [photo, setPhoto] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiJson<{ profile: ProfileDto | null }>("/api/portal/profile")
      .then((r) => {
        setProfile(r.profile)
        if (!r.profile) return
        const p = r.profile
        setForm({
          phone: p.phone ?? "",
          email: p.email ?? "",
          gender: p.gender ?? "",
          maritalStatus: p.maritalStatus ?? "",
          occupation: p.occupation ?? "",
          street: p.street ?? "",
          streetNumber: p.streetNumber ?? "",
          neighborhood: p.neighborhood ?? "",
          city: p.city ?? "",
          postalCode: p.postalCode ?? "",
          contactSchedule: p.contactSchedule ?? "",
        })
        setBirth(toDate(p.birthDate))
        setPhoto(p.imageUrl ?? "")
      })
      .catch((e) => {
        setProfile(null)
        swalError("No se pudo cargar", errorMessage(e))
      })
  }, [])

  if (profile === undefined) return <Skeleton className="h-96 w-full" />
  if (!profile) {
    return (
      <EmptyState
        icon={UserRound}
        title="Tu cuenta aún no está ligada a un registro"
        description="Pide en la secretaría que ligue tu cuenta a tu registro para poder editar tus datos."
      />
    )
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      await apiJson("/api/portal/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          birthDate: toYmd(birth),
          imageUrl: photo || null,
        }),
      })
      notify.success("Perfil actualizado")
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 font-heading text-xl font-semibold text-primary">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            profile.fullName.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-semibold">
            {profile.fullName}
          </p>
          <p className="text-xs text-muted-foreground">
            {profile.memberCode
              ? `Número de creyente ${profile.memberCode} · `
              : ""}
            Tu nombre lo administra la secretaría.
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-heading text-base font-semibold">Contacto</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputGroupField
            label="Teléfono"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone ?? ""}
            maxLength={30}
            onChange={set("phone")}
          />
          <InputGroupField
            label="Correo"
            inputMode="email"
            autoComplete="email"
            value={form.email ?? ""}
            maxLength={120}
            onChange={set("email")}
          />
          <InputGroupField
            label="Mejor horario para contactarte"
            value={form.contactSchedule ?? ""}
            maxLength={150}
            onChange={set("contactSchedule")}
          />
          <div className="sm:col-span-2">
            <Attachment
              label="Mi foto"
              value={photo || null}
              onChange={(u) => setPhoto(u ?? "")}
              upload={uploadFile}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-heading text-base font-semibold">
          Datos personales
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker
            label="Fecha de nacimiento"
            value={birth}
            onChange={setBirth}
          />
          <FormCombobox
            label="Género"
            options={GENDER}
            value={form.gender ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
          />
          <FormCombobox
            label="Estado civil"
            options={MARITAL}
            value={form.maritalStatus ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, maritalStatus: v }))}
          />
          <InputGroupField
            label="Ocupación"
            value={form.occupation ?? ""}
            maxLength={100}
            onChange={set("occupation")}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-heading text-base font-semibold">Domicilio</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <InputGroupField
              label="Calle"
              autoComplete="address-line1"
              value={form.street ?? ""}
              maxLength={150}
              onChange={set("street")}
            />
          </div>
          <InputGroupField
            label="Número"
            value={form.streetNumber ?? ""}
            maxLength={20}
            onChange={set("streetNumber")}
          />
          <InputGroupField
            label="Colonia"
            value={form.neighborhood ?? ""}
            maxLength={100}
            onChange={set("neighborhood")}
          />
          <InputGroupField
            label="Ciudad"
            autoComplete="address-level2"
            value={form.city ?? ""}
            maxLength={100}
            onChange={set("city")}
          />
          <InputGroupField
            label="Código postal"
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.postalCode ?? ""}
            maxLength={10}
            onChange={set("postalCode")}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
