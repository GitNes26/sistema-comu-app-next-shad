"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  AlertCircle,
  AtSign,
  Building2,
  Globe,
  Hash,
  HandHeart,
  Landmark,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Store,
} from "lucide-react"
import { settingsApi, type CompanyProfileView } from "@/lib/settings/client"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { notify } from "@/lib/notify"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { Attachment } from "@/components/base/attachment"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

// Datos de la iglesia: identidad, contacto, redes sociales y donativos
// (diezmos y ofrendas). Los donativos se muestran al creyente en su espacio.

const SOCIALS = [
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/tu-iglesia" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/tu-iglesia" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@tu-iglesia" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@tu-iglesia" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/52…" },
] as const

const optionalText = (max: number) => yup.string().trim().max(max, `Máximo ${max} caracteres`).default("")
const optionalUrl = yup
  .string()
  .trim()
  .default("")
  .test("url", "Ingresa una URL completa, por ejemplo https://ejemplo.com", (v) => !v || /^https?:\/\/\S+$/i.test(v))

const schema = yup.object({
  tradeName: yup.string().trim().required("El nombre de la iglesia es obligatorio").max(150),
  legalName: optionalText(150),
  taxId: yup.string().trim().max(13, "El RFC admite hasta 13 caracteres").default(""),
  description: optionalText(1000),
  logoUrl: yup.string().default(""),
  address: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: yup
    .string()
    .default("")
    .test("cp", "El código postal debe tener 5 dígitos", (v) => !v || /^\d{5}$/.test(v)),
  country: optionalText(100),
  phone: yup
    .string()
    .default("")
    .test("phone", "El teléfono debe tener 10 dígitos", (v) => !v || /^\d{10}$/.test(v)),
  email: yup.string().trim().email("Ingresa un correo válido").default(""),
  website: optionalUrl,
  facebook: optionalUrl,
  instagram: optionalUrl,
  youtube: optionalUrl,
  tiktok: optionalUrl,
  whatsapp: optionalUrl,
  donationsEnabled: yup.boolean().default(false),
  donationBank: optionalText(100),
  donationHolder: optionalText(150),
  donationClabe: yup
    .string()
    .default("")
    .test("clabe", "La CLABE debe tener 18 dígitos", (v) => !v || /^\d{18}$/.test(v)),
  donationAccount: optionalText(40),
  donationCard: optionalText(40),
  donationLink: optionalUrl,
  donationNote: optionalText(300),
})
type Values = yup.InferType<typeof schema>

function toValues(p: CompanyProfileView | null): Values {
  const s = (p?.socialLinks ?? {}) as Record<string, string>
  return {
    tradeName: p?.tradeName ?? "",
    legalName: p?.legalName ?? "",
    taxId: p?.taxId ?? "",
    description: p?.description ?? "",
    logoUrl: p?.logoUrl ?? "",
    address: p?.address ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    postalCode: p?.postalCode ?? "",
    country: p?.country ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    website: p?.website ?? "",
    facebook: s.facebook ?? "",
    instagram: s.instagram ?? "",
    youtube: s.youtube ?? "",
    tiktok: s.tiktok ?? "",
    whatsapp: s.whatsapp ?? "",
    donationsEnabled: p?.donationsEnabled ?? false,
    donationBank: p?.donationBank ?? "",
    donationHolder: p?.donationHolder ?? "",
    donationClabe: p?.donationClabe ?? "",
    donationAccount: p?.donationAccount ?? "",
    donationCard: p?.donationCard ?? "",
    donationLink: p?.donationLink ?? "",
    donationNote: p?.donationNote ?? "",
  }
}

export function CompanyForm() {
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState<string>()
  const { focusFirstInvalid, focusFirstEnabled } = useFocusInvalid()

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: toValues(null) })

  useEffect(() => {
    settingsApi
      .company()
      .then((d) => reset(toValues(d.profile)))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [reset])

  useEffect(() => {
    if (loading) return
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("company-form"))
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, loading])

  const donationsEnabled = watch("donationsEnabled")

  const onSubmit = async (v: Values) => {
    setFormError(undefined)
    try {
      const nullable = (s: string) => (s.trim() ? s.trim() : null)
      const res = await settingsApi.updateCompany({
        legalName: nullable(v.legalName),
        tradeName: v.tradeName.trim(),
        taxId: nullable(v.taxId)?.toUpperCase() ?? null,
        description: nullable(v.description),
        logoUrl: nullable(v.logoUrl),
        address: nullable(v.address),
        city: nullable(v.city),
        state: nullable(v.state),
        postalCode: nullable(v.postalCode),
        country: nullable(v.country),
        phone: nullable(v.phone),
        email: nullable(v.email)?.toLowerCase() ?? null,
        website: nullable(v.website),
        socialLinks: Object.fromEntries(SOCIALS.map((s) => [s.key, v[s.key]])),
        donationsEnabled: v.donationsEnabled,
        donationBank: nullable(v.donationBank),
        donationHolder: nullable(v.donationHolder),
        donationClabe: nullable(v.donationClabe),
        donationAccount: nullable(v.donationAccount),
        donationCard: nullable(v.donationCard),
        donationLink: nullable(v.donationLink),
        donationNote: nullable(v.donationNote),
      })
      reset(toValues(res.profile))
      notify.success("Datos de la iglesia guardados")
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la información de la iglesia")
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <form
      id="company-form"
      noValidate
      onSubmit={handleSubmit(onSubmit, (errs) => focusFirstInvalid(errs, "company-form"))}
      className="grid gap-4 sm:grid-cols-2"
    >
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:col-span-2"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </div>
      )}

      <h3 className="font-heading text-sm font-semibold sm:col-span-2">Identidad</h3>
      <InputGroupField
        id="tradeName"
        label="Nombre de la iglesia"
        required
        helper="Nombre visible en el sistema, correos y espacio del creyente."
        leftAddon={<Store className="size-4" />}
        error={errors.tradeName?.message}
        {...register("tradeName")}
      />
      <InputGroupField
        id="legalName"
        label="Razón social"
        helper="Nombre legal de la asociación o iglesia."
        leftAddon={<Building2 className="size-4" />}
        error={errors.legalName?.message}
        {...register("legalName")}
      />
      <InputGroupField
        id="taxId"
        label="RFC"
        helper="Se guarda en mayúsculas."
        leftAddon={<Hash className="size-4" />}
        error={errors.taxId?.message}
        {...register("taxId")}
      />
      <Controller
        control={control}
        name="logoUrl"
        render={({ field }) => (
          <Attachment
            label="Logo"
            helper="Imagen del logo de la iglesia."
            value={field.value ?? ""}
            onChange={(url) => field.onChange(url ?? "")}
            upload={uploadFile}
            accept={UPLOAD_IMAGE_ACCEPT}
          />
        )}
      />
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" rows={3} aria-invalid={Boolean(errors.description)} {...register("description")} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <h3 className="mt-2 font-heading text-sm font-semibold sm:col-span-2">Contacto y ubicación</h3>
      <InputGroupField
        id="address"
        label="Dirección"
        helper="Calle y número."
        leftAddon={<MapPin className="size-4" />}
        containerClassName="sm:col-span-2"
        error={errors.address?.message}
        {...register("address")}
      />
      <InputGroupField id="city" label="Ciudad" leftAddon={<MapPin className="size-4" />} error={errors.city?.message} {...register("city")} />
      <InputGroupField id="state" label="Estado" leftAddon={<MapPin className="size-4" />} error={errors.state?.message} {...register("state")} />
      <InputGroupField
        id="postalCode"
        label="Código postal"
        inputMode="numeric"
        maxLength={5}
        leftAddon={<MapPin className="size-4" />}
        error={errors.postalCode?.message}
        {...register("postalCode")}
      />
      <InputGroupField id="country" label="País" leftAddon={<Globe className="size-4" />} error={errors.country?.message} {...register("country")} />
      <InputGroupField
        id="phone"
        label="Teléfono"
        type="tel"
        inputMode="tel"
        maxLength={10}
        helper="Solo 10 dígitos."
        leftAddon={<Phone className="size-4" />}
        error={errors.phone?.message}
        {...register("phone")}
      />
      <InputGroupField
        id="email"
        label="Correo"
        type="email"
        inputMode="email"
        leftAddon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...register("email")}
      />
      <InputGroupField
        id="website"
        label="Sitio web"
        type="url"
        inputMode="url"
        leftAddon={<Globe className="size-4" />}
        error={errors.website?.message}
        {...register("website")}
      />

      <h3 className="mt-2 font-heading text-sm font-semibold sm:col-span-2">Redes sociales</h3>
      {SOCIALS.map((s) => (
        <InputGroupField
          key={s.key}
          id={s.key}
          label={s.label}
          type="url"
          inputMode="url"
          placeholder={s.placeholder}
          leftAddon={<AtSign className="size-4" />}
          error={errors[s.key]?.message}
          {...register(s.key)}
        />
      ))}

      <h3 className="mt-2 font-heading text-sm font-semibold sm:col-span-2">Diezmos y ofrendas</h3>
      <div className="sm:col-span-2">
        <Controller
          control={control}
          name="donationsEnabled"
          render={({ field }) => (
            <SwitchField
              id="donationsEnabled"
              label="Mostrar datos de donativo"
              description="Los creyentes verán estos datos en su espacio personal."
              icon={<HandHeart className="size-4" />}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
      {donationsEnabled && (
        <>
          <InputGroupField id="donationBank" label="Banco" leftAddon={<Landmark className="size-4" />} error={errors.donationBank?.message} {...register("donationBank")} />
          <InputGroupField id="donationHolder" label="Titular" leftAddon={<Building2 className="size-4" />} error={errors.donationHolder?.message} {...register("donationHolder")} />
          <InputGroupField
            id="donationClabe"
            label="CLABE"
            inputMode="numeric"
            maxLength={18}
            helper="18 dígitos."
            leftAddon={<Hash className="size-4" />}
            error={errors.donationClabe?.message}
            {...register("donationClabe")}
          />
          <InputGroupField id="donationAccount" label="Cuenta" inputMode="numeric" leftAddon={<Hash className="size-4" />} error={errors.donationAccount?.message} {...register("donationAccount")} />
          <InputGroupField id="donationCard" label="Tarjeta" inputMode="numeric" leftAddon={<Hash className="size-4" />} error={errors.donationCard?.message} {...register("donationCard")} />
          <InputGroupField
            id="donationLink"
            label="Enlace de donación"
            type="url"
            inputMode="url"
            helper="PayPal, Mercado Pago u otro enlace de pago."
            leftAddon={<Link2 className="size-4" />}
            error={errors.donationLink?.message}
            {...register("donationLink")}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="donationNote">Nota para el creyente</Label>
            <Textarea id="donationNote" rows={2} aria-invalid={Boolean(errors.donationNote)} {...register("donationNote")} />
            {errors.donationNote && <p className="text-xs text-destructive">{errors.donationNote.message}</p>}
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  )
}
