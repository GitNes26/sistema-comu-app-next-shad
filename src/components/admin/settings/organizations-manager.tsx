"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Ban, Church, DoorOpen, Loader2, Plus, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import type { OrganizationRow } from "@/lib/settings/organizations"

// Administración de iglesias (exclusivo del superadmin): alta con su
// propietario, entrar a operar una iglesia y bloquear/desbloquear su acceso.
// Las iglesias no se eliminan: el bloqueo suspende el acceso y conserva su historial.

const schema = yup.object({
  name: yup.string().trim().required("Escribe el nombre de la iglesia").max(120),
  ownerName: yup.string().trim().required("Escribe el nombre del propietario").max(150),
  ownerEmail: yup.string().trim().email("Correo inválido").required("Escribe el correo del propietario"),
  ownerPassword: yup.string().required("Define una contraseña inicial").min(8, "Mínimo 8 caracteres"),
})
type Values = yup.InferType<typeof schema>

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error ?? "Error de red")
  return data as T
}

export function OrganizationsManager() {
  const router = useRouter()
  const { update } = useSession()
  const [rows, setRows] = useState<OrganizationRow[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: { name: "", ownerName: "", ownerEmail: "", ownerPassword: "" },
  })

  const load = useCallback(async () => {
    try {
      const data = await api<{ organizations: OrganizationRow[] }>("/api/settings/organizations")
      setRows(data.organizations)
    } catch (err) {
      setRows([])
      swalError("No se pudieron cargar las iglesias", err instanceof Error ? err.message : undefined)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (values: Values) => {
    setSaving(true)
    try {
      await api("/api/settings/organizations", { method: "POST", body: JSON.stringify(values) })
      notify.success("Iglesia creada")
      setDialogOpen(false)
      reset()
      await load()
    } catch (err) {
      swalError("No se pudo crear la iglesia", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const enter = async (org: OrganizationRow) => {
    setBusyId(org.id)
    try {
      await update({ activeOrganizationId: org.id })
      router.push("/admin")
      router.refresh()
    } catch {
      notify.error("No se pudo entrar a la iglesia")
    } finally {
      setBusyId(null)
    }
  }

  const toggleBlocked = async (org: OrganizationRow) => {
    const blocking = !org.isBlocked
    const ok = await swalConfirm(
      blocking ? `¿Bloquear «${org.name}»?` : `¿Desbloquear «${org.name}»?`,
      blocking
        ? "Sus usuarios no podrán iniciar sesión hasta que la desbloquees. La información se conserva."
        : "Sus usuarios podrán volver a iniciar sesión.",
      { confirmText: blocking ? "Bloquear" : "Desbloquear", danger: blocking }
    )
    if (!ok) return
    setBusyId(org.id)
    try {
      await api(`/api/settings/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: org.name, isBlocked: blocking, blockedReason: blocking ? "Acceso suspendido por la plataforma" : null }),
      })
      notify.success(blocking ? "Iglesia bloqueada" : "Iglesia desbloqueada")
      await load()
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nueva iglesia
        </Button>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-label="Cargando" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Church className="size-6" />
            </span>
            <p className="font-medium">Aún no hay iglesias</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea la primera iglesia con su propietario; después podrás entrar a operarla.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((org) => (
            <Card key={org.id} className={org.isBlocked ? "opacity-80" : undefined}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-heading text-base font-semibold">{org.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {org.ownerName} · {org.ownerEmail}
                    </p>
                  </div>
                  {org.isBlocked ? (
                    <StatusPill tone="danger">Bloqueada</StatusPill>
                  ) : (
                    <StatusPill tone="success">Activa</StatusPill>
                  )}
                </div>
                <p className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" />
                    {org.memberCount} usuario(s)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-4" />
                    {org.adminCount} admin(s)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void enter(org)} disabled={busyId === org.id}>
                    {busyId === org.id ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />}
                    Entrar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleBlocked(org)} disabled={busyId === org.id}>
                    <Ban className="size-4" />
                    {org.isBlocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DialogComponent
        open={dialogOpen}
        onOpenChange={(o) => !o && setDialogOpen(false)}
        title="Nueva iglesia"
        description="Se crea con su propietario (pastor principal), su perfil y su plan inicial."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Creando…" : "Crear iglesia"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={handleSubmit(onSubmit, (errs) => focusFirstInvalid(errs, formId))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <div className="sm:col-span-2" data-form-field="name">
            <InputGroupField label="Nombre de la iglesia" required error={errors.name?.message} {...register("name")} />
          </div>
          <div data-form-field="ownerName">
            <InputGroupField label="Propietario" required error={errors.ownerName?.message} {...register("ownerName")} />
          </div>
          <div data-form-field="ownerEmail">
            <InputGroupField
              label="Correo del propietario"
              type="email"
              inputMode="email"
              autoComplete="off"
              required
              error={errors.ownerEmail?.message}
              {...register("ownerEmail")}
            />
          </div>
          <div className="sm:col-span-2" data-form-field="ownerPassword">
            <InputGroupField
              label="Contraseña inicial"
              type="password"
              autoComplete="new-password"
              required
              helper="Mínimo 8 caracteres. Pídele que la cambie en su primer acceso."
              error={errors.ownerPassword?.message}
              {...register("ownerPassword")}
            />
          </div>
        </form>
      </DialogComponent>
    </div>
  )
}
