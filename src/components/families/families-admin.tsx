"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Cake, Loader2, Pencil, Phone, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox, InputGroupField, TextareaField } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { FamilyDto } from "@/lib/families/server"
import { FAMILY_RELATIONS, type FamilyRelation } from "@/lib/families/rules"

// Familias del padrón. Una persona pertenece a una sola; no es lo mismo que un hogar de
// amor (célula), que es una reunión en casa.

const RELATIONS = Object.entries(FAMILY_RELATIONS).map(([value, label]) => ({ value, label }))

export function FamiliesAdmin() {
  const [families, setFamilies] = useState<FamilyDto[] | null>(null)
  const [q, setQ] = useState("")
  const [edit, setEdit] = useState<FamilyDto | "new" | null>(null)
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      setFamilies((await apiJson<{ families: FamilyDto[] }>(`/api/families?q=${encodeURIComponent(q)}`)).families)
    } catch (e) {
      setFamilies([])
      swalError("No se pudieron cargar las familias", errorMessage(e))
    }
  }, [q])
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(), q ? 300 : 0)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [load, q])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            <Users className="size-6 text-primary" /> Familias
          </h1>
          <p className="text-sm text-muted-foreground">Quiénes forman cada familia: para felicitar, ubicar tutores y acompañar a la casa completa.</p>
        </div>
        <Button onClick={() => setEdit("new")}>
          <Plus className="size-4" /> Nueva familia
        </Button>
      </div>
      <InputGroupField label="Buscar" type="search" leftIcon={<Search className="size-4" />} placeholder="Apellido o nombre de un integrante" value={q} onChange={(e) => setQ(e.target.value)} containerClassName="max-w-md" />

      {families === null ? (
        <Skeleton className="h-48 w-full" />
      ) : families.length === 0 ? (
        <EmptyState icon={Users} title={q ? "Sin resultados" : "Aún no hay familias"} description="Crea una familia y agrega a sus integrantes desde el padrón." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {families.map((f) => (
            <li key={f.id} className="space-y-3 rounded-3xl border bg-card p-4">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-heading text-base font-semibold">{f.name}</p>
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${f.name}`} onClick={() => setEdit(f)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
              <ul className="space-y-1.5">
                {f.members.length === 0 && <li className="text-sm text-muted-foreground">Sin integrantes todavía.</li>}
                {f.members.map((m) => (
                  <li key={m.memberId} className="flex items-center gap-2 text-sm">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{m.fullName.charAt(0)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {FAMILY_RELATIONS[m.relation]}
                        {m.birthday ? ` · cumple ${m.birthday}` : ""}
                      </span>
                    </span>
                    {m.phone && (
                      <a href={`tel:${m.phone}`} aria-label={`Llamar a ${m.fullName}`} className="press grid size-8 place-items-center rounded-lg border">
                        <Phone className="size-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {f.notes && <p className="text-xs text-muted-foreground">{f.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <FamilyDialog value={edit} onClose={() => setEdit(null)} onChanged={load} />
    </div>
  )
}

function FamilyDialog({ value, onClose, onChanged }: { value: FamilyDto | "new" | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [id, setId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [members, setMembers] = useState<FamilyDto["members"]>([])
  const [saving, setSaving] = useState(false)
  // Buscador de personas
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<{ id: string; fullName: string; phone: string | null; familyName: string | null }[]>([])
  const [relation, setRelation] = useState<FamilyRelation>("child")

  useEffect(() => {
    if (value === null) return
    const f = value === "new" ? null : value
    setId(f?.id ?? null)
    setName(f?.name ?? "")
    setNotes(f?.notes ?? "")
    setMembers(f?.members ?? [])
    setQ("")
    setPeople([])
  }, [value])

  useEffect(() => {
    if (q.trim().length < 2) {
      setPeople([])
      return
    }
    const t = window.setTimeout(() => {
      apiJson<{ people: typeof people }>(`/api/families/people?q=${encodeURIComponent(q.trim())}`)
        .then((d) => setPeople(d.people))
        .catch(() => setPeople([]))
    }, 250)
    return () => window.clearTimeout(t)
  }, [q])

  const saveBase = async (): Promise<string | null> => {
    try {
      if (id) {
        await apiJson(`/api/families/${id}`, { method: "PUT", body: JSON.stringify({ name, notes }) })
        return id
      }
      const r = await apiJson<{ id: string }>("/api/families", { method: "POST", body: JSON.stringify({ name, notes }) })
      setId(r.id)
      return r.id
    } catch (e) {
      swalError("No se pudo guardar la familia", errorMessage(e))
      return null
    }
  }

  const add = async (person: { id: string; fullName: string; phone: string | null }) => {
    setSaving(true)
    const familyId = await saveBase()
    if (!familyId) return setSaving(false)
    try {
      await apiJson(`/api/families/${familyId}/members`, { method: "POST", body: JSON.stringify({ memberId: person.id, relation }) })
      setMembers((m) => [...m.filter((x) => x.memberId !== person.id), { memberId: person.id, fullName: person.fullName, relation, phone: person.phone, birthday: null }])
      setQ("")
      setPeople([])
      await onChanged()
    } catch (e) {
      swalError("No se pudo agregar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async (memberId: string) => {
    if (!id) return
    try {
      await apiJson(`/api/families/${id}/members`, { method: "DELETE", body: JSON.stringify({ memberId }) })
      setMembers((m) => m.filter((x) => x.memberId !== memberId))
      await onChanged()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }
  const done = async () => {
    setSaving(true)
    const ok = await saveBase()
    setSaving(false)
    if (!ok) return
    notify.success("Familia guardada")
    onClose()
    await onChanged()
  }
  const removeFamily = async () => {
    if (!id) return
    if (!(await swalConfirm(`¿Eliminar «${name}»?`, "Las personas siguen en el padrón; solo se deshace la familia.", { confirmText: "Eliminar", danger: true }))) return
    try {
      await apiJson(`/api/families/${id}`, { method: "DELETE" })
      onClose()
      await onChanged()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={value !== null}
      onOpenChange={(o) => !o && onClose()}
      icon={<Users />}
      title={value === "new" && !id ? "Nueva familia" : "Editar familia"}
      description="Nombre de la familia y quiénes la integran."
      size="2xl"
      footer={
        <>
          {id && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void removeFamily()} disabled={saving}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          <Button onClick={() => void done()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Nombre de la familia" required placeholder="Familia Pérez López" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        <TextareaField label="Notas (opcional)" rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Integrantes</h3>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Agrega a las personas desde el padrón.</p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {members.map((m) => (
                <li key={m.memberId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{m.fullName}</span>
                  <span className="text-xs text-muted-foreground">{FAMILY_RELATIONS[m.relation]}</span>
                  {m.birthday && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Cake className="size-3" /> {m.birthday}
                    </span>
                  )}
                  <Button size="icon-sm" variant="ghost" aria-label={`Quitar a ${m.fullName}`} onClick={() => void remove(m.memberId)}>
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 rounded-2xl border bg-muted/30 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <UserPlus className="size-4" /> Agregar una persona
          </h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <InputGroupField label="Buscar en el padrón" type="search" leftIcon={<Search className="size-4" />} placeholder="Nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
            <FormCombobox label="Parentesco" options={RELATIONS} value={relation} onChange={(v) => setRelation(v as FamilyRelation)} clearable={false} searchable={false} />
          </div>
          {people.length > 0 && (
            <ul className="divide-y rounded-xl border bg-card">
              {people.map((p) => (
                <li key={p.id}>
                  <button type="button" disabled={saving || !name.trim()} onClick={() => void add(p)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted disabled:opacity-50">
                    <span className="min-w-0 flex-1 truncate font-medium">{p.fullName}</span>
                    {p.familyName && <span className="text-xs text-warning-ink">Ya está en «{p.familyName}»</span>}
                    {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!name.trim() && <p className="text-xs text-muted-foreground">Primero escribe el nombre de la familia.</p>}
        </section>
      </div>
    </DialogComponent>
  )
}
