"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Crown, Loader2, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { DEFAULT_HIERARCHY, duplicateHierarchyLabel, type HierarchyEntry } from "@/lib/org/hierarchy"
import { HIERARCHY_QUERY_KEY, useHierarchy } from "@/providers/hierarchy-provider"
import { cn } from "@/lib/utils"

// Ajustes → Jerarquía: nombre, descripción y visibilidad de cada nivel de la jerarquía eclesiástica.
// El orden (de menor a mayor) es fijo; lo que cambia es cómo lo llama cada iglesia.

export function HierarchyForm() {
  const qc = useQueryClient()
  const { entries } = useHierarchy()
  const [draft, setDraft] = useState<HierarchyEntry[]>(entries)
  const [saving, setSaving] = useState(false)

  // Al llegar lo guardado se carga en el formulario.
  const signature = JSON.stringify(entries)
  useEffect(() => {
    setDraft(entries)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const dirty = JSON.stringify(draft) !== signature
  const dup = duplicateHierarchyLabel(draft)
  const patch = (level: string, c: Partial<HierarchyEntry>) => setDraft((d) => d.map((e) => (e.level === level ? { ...e, ...c } : e)))

  const save = async () => {
    setSaving(true)
    try {
      const body = Object.fromEntries(draft.map((e) => [e.level, { label: e.label, description: e.description, isActive: e.isActive }]))
      const res = await fetch("/api/settings/hierarchy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hierarchy: body }) })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar")
      await qc.invalidateQueries({ queryKey: HIERARCHY_QUERY_KEY })
      notify.success("Jerarquía guardada")
    } catch (e) {
      swalError("No se pudo guardar la jerarquía", e instanceof Error ? e.message : "Intenta de nuevo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los niveles van de menor a mayor. Cambia cómo se llama cada uno en tu iglesia; el nombre se usa en el padrón, el panel, «Mi espacio» y el organigrama. Un nivel oculto ya no se ofrece al elegir la
        jerarquía de una persona, pero quienes ya lo tienen lo conservan.
      </p>
      <ol className="space-y-3">
        {draft.map((e, i) => {
          const base = DEFAULT_HIERARCHY[e.level]
          return (
            <li key={e.level} className={cn("space-y-3 rounded-2xl border bg-card p-4", !e.isActive && "opacity-70")}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">{i + 1}</span>
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  Nivel original: <span className="font-medium text-foreground">{base.label}</span>
                </p>
                <Button size="sm" variant="ghost" disabled={e.label === base.label && e.description === base.description} onClick={() => patch(e.level, { label: base.label, description: base.description })}>
                  <RotateCcw className="size-4" /> Restablecer
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InputGroupField label="Nombre" required value={e.label} maxLength={40} leftIcon={<Crown className="size-4" />} onChange={(ev) => patch(e.level, { label: ev.target.value })} />
                <InputGroupField label="Descripción" value={e.description} maxLength={160} onChange={(ev) => patch(e.level, { description: ev.target.value })} />
              </div>
              {e.level !== "believer" && (
                <SwitchField label="Ofrecer este nivel" description="Si lo apagas, no aparece al elegir la jerarquía de una persona." checked={e.isActive} onCheckedChange={(v) => patch(e.level, { isActive: v })} border={false} />
              )}
            </li>
          )
        })}
      </ol>
      {dup && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">El nombre «{dup}» está repetido: cada nivel necesita uno distinto.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(entries)}>
          Descartar cambios
        </Button>
        <Button disabled={!dirty || saving || Boolean(dup) || draft.some((e) => !e.label.trim())} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar
        </Button>
      </div>
    </div>
  )
}
