"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pause, Pencil, Play, Plus, Power, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment, DatePicker, FormCombobox, InputGroupField, StatusPill, TextareaField } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { CampaignCard } from "@/components/finance/campaign-card"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { CAMPAIGN_KINDS, CAMPAIGN_STATUS, type CampaignKind } from "@/lib/finance/campaign-rules"
import type { CampaignDto } from "@/lib/finance/campaigns"

// Campañas de donativos: ComuniDAR («Construyamos juntos nuestro templo») y cualquier
// proyecto con propósito y vigencia. No siempre hay una activa.

const TONE = { active: "success", paused: "warning", closed: "neutral" } as const
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromYmd = (s: string | null) => (s ? new Date(`${s}T12:00:00`) : null)

export function CampaignsTab({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<CampaignDto[] | null>(null)
  const [edit, setEdit] = useState<CampaignDto | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      setRows((await apiJson<{ campaigns: CampaignDto[] }>("/api/finance/campaigns")).campaigns)
    } catch (e) {
      setRows([])
      swalError("No se pudieron cargar las campañas", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (c: CampaignDto, status: string) => {
    if (status === "closed" && !(await swalConfirm(`¿Cerrar «${c.name}»?`, "Deja de recibir aportaciones; lo reunido se conserva.", { confirmText: "Cerrar campaña" }))) return
    try {
      await apiJson(`/api/finance/campaigns/${c.id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      await load()
      onChanged()
    } catch (e) {
      swalError("No se pudo actualizar", errorMessage(e))
    }
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Abre una campaña cuando haya un propósito (el templo, un evento, un proyecto). Las aportaciones confirmadas se suman solas a su meta.
        </p>
        {canManage && (
          <Button onClick={() => setEdit("new")}>
            <Plus className="size-4" /> Nueva campaña
          </Button>
        )}
      </div>

      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Target} title="Sin campañas" description="Crea «ComuniDAR · Nuestro templo» u otra campaña para que la familia pueda aportar con un propósito." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <CampaignCard
                c={c}
                action={
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusPill tone={TONE[c.status]}>{CAMPAIGN_STATUS[c.status]}</StatusPill>
                      {c.status === "active" && !c.open && <span className="text-warning-ink">Fuera de vigencia</span>}
                      <span>{c.donors} aportaciones</span>
                      {!c.isPublic && <span>· Solo para la familia</span>}
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEdit(c)}>
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                        {c.status === "active" ? (
                          <Button size="sm" variant="ghost" onClick={() => void setStatus(c, "paused")}>
                            <Pause className="size-3.5" /> Pausar
                          </Button>
                        ) : (
                          c.status === "paused" && (
                            <Button size="sm" variant="ghost" onClick={() => void setStatus(c, "active")}>
                              <Play className="size-3.5" /> Reanudar
                            </Button>
                          )
                        )}
                        {c.status !== "closed" ? (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void setStatus(c, "closed")}>
                            <Power className="size-3.5" /> Cerrar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => void setStatus(c, "active")}>
                            <Play className="size-3.5" /> Reabrir
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <CampaignDialog
        value={edit}
        onClose={() => setEdit(null)}
        onSaved={async () => {
          await load()
          onChanged()
        }}
      />
    </div>
  )
}

function CampaignDialog({ value, onClose, onSaved }: { value: CampaignDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState<CampaignKind>("project")
  const [goal, setGoal] = useState("")
  const [starts, setStarts] = useState<Date | null>(null)
  const [ends, setEnds] = useState<Date | null>(null)
  const [image, setImage] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (value === null) return
    const c = value === "new" ? null : value
    setName(c?.name ?? "")
    setDescription(c?.description ?? "")
    setKind(c?.kind ?? "project")
    setGoal(c?.goalAmount != null ? String(c.goalAmount) : "")
    setStarts(fromYmd(c?.startsAt ?? null))
    setEnds(fromYmd(c?.endsAt ?? null))
    setImage(c?.imageUrl ?? "")
    setIsPublic(c?.isPublic ?? true)
  }, [value])

  const save = async () => {
    setSaving(true)
    try {
      const body = JSON.stringify({ name, description, kind, goalAmount: goal, startsAt: starts ? ymdOf(starts) : null, endsAt: ends ? ymdOf(ends) : null, imageUrl: image || null, isPublic })
      if (value === "new") await apiJson("/api/finance/campaigns", { method: "POST", body })
      else if (value) await apiJson(`/api/finance/campaigns/${value.id}`, { method: "PUT", body })
      notify.success("Campaña guardada")
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
      open={value !== null}
      onOpenChange={(o) => !o && onClose()}
      icon={<Target />}
      title={value === "new" ? "Nueva campaña" : "Editar campaña"}
      description="Un propósito claro, una meta opcional y, si quieres, una vigencia."
      size="2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Nombre" required value={name} maxLength={120} placeholder="ComuniDAR · Nuestro templo" onChange={(e) => setName(e.target.value)} />
        <TextareaField label="Descripción" rows={4} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} hint="Cuenta para qué es y cómo se usará lo reunido." />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormCombobox
            label="Tipo"
            options={Object.entries(CAMPAIGN_KINDS).map(([v, label]) => ({ value: v, label }))}
            value={kind}
            onChange={(v) => setKind(v as CampaignKind)}
            clearable={false}
            searchable={false}
          />
          <InputGroupField label="Meta (opcional)" type="number" inputMode="decimal" min="0" step="1" value={goal} placeholder="Sin meta" onChange={(e) => setGoal(e.target.value)} />
          <DatePicker label="Abre el (opcional)" value={starts} onChange={setStarts} />
          <DatePicker label="Cierra el (opcional)" value={ends} onChange={setEnds} disabledBefore={starts ?? undefined} />
        </div>
        <Attachment label="Imagen (opcional)" value={image || null} onChange={(u) => setImage(u ?? "")} upload={uploadFile} />
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          Mostrarla también en la página pública
        </label>
      </div>
    </DialogComponent>
  )
}
