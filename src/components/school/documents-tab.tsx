"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BookOpen, Eye, FileImage, FileText, FileType2, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { DocumentDto } from "@/lib/school/documents"

// Libro digital del curso: se suben PDF, Word (.docx) o imágenes y se define qué
// páginas se abren en cada clase. Quien cursa solo recibe lo habilitado.

const KIND_LABEL = { pdf: "PDF", docx: "Word", image: "Imagen" } as const
const KIND_ICON = { pdf: FileText, docx: FileType2, image: FileImage } as const
const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function DocumentsTab({ courseId, weeks }: { courseId: string; weeks: number }) {
  const [docs, setDocs] = useState<DocumentDto[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<DocumentDto | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ documents: DocumentDto[] }>(`/api/school/courses/${courseId}/documents`)
      setDocs(d.documents)
    } catch (e) {
      setDocs([])
      swalError("No se pudieron cargar los documentos", errorMessage(e))
    }
  }, [courseId])
  useEffect(() => {
    void load()
  }, [load])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/school/courses/${courseId}/documents`, { method: "POST", body: form })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; pageCount?: number } | null
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "No se pudo subir el archivo")
      notify.success(`Archivo subido (${data.pageCount} página${data.pageCount === 1 ? "" : "s"})`)
      await load()
    } catch (e) {
      swalError("No se pudo subir", errorMessage(e))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Sube el libro en PDF, Word o imágenes y define qué páginas se abren en cada clase. Los alumnos subrayan y anotan, y cada quien conserva sus apuntes.
        </p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Subir archivo del libro digital"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        <Button onClick={() => input.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Subir archivo
        </Button>
      </div>

      {docs === null ? (
        <Skeleton className="h-32 w-full" />
      ) : docs.length === 0 ? (
        <EmptyState icon={BookOpen} title="Sin libro digital" description="Sube el PDF o el documento de Word del libro. Hasta 30 MB (PDF) o 15 MB (Word)." />
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const Icon = KIND_ICON[d.kind]
            return (
              <li key={d.id} className="space-y-2 rounded-2xl border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {KIND_LABEL[d.kind]} · {d.pageCount} página{d.pageCount === 1 ? "" : "s"} · {fmtSize(d.size)}
                    </span>
                  </span>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/school/libro/${d.id}`}>
                      <Eye className="size-4" /> Ver
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
                    Secciones
                  </Button>
                </div>
                {d.sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin secciones: los alumnos ven todo el documento. Define qué se abre en cada clase.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {d.sections.map((s) => (
                      <li key={s.id}>
                        <StatusPill tone="info" dot={false}>
                          Sem. {s.week}: {s.title} (pp. {s.fromPage}–{s.toPage})
                        </StatusPill>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <SectionsDialog doc={editing} weeks={weeks} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  )
}

interface Row {
  week: string
  title: string
  from: string
  to: string
}

function SectionsDialog({ doc, weeks, onClose, onSaved }: { doc: DocumentDto | null; weeks: number; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!doc) return
    setTitle(doc.title)
    setRows(doc.sections.map((s) => ({ week: String(s.week), title: s.title, from: String(s.fromPage), to: String(s.toPage) })))
  }, [doc])

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addRow = () => {
    const last = rows.at(-1)
    const from = last ? Math.min((doc?.pageCount ?? 1), Number(last.to) + 1) : 1
    setRows((r) => [...r, { week: String(Math.min(weeks, last ? Number(last.week) + 1 : 1)), title: "", from: String(from), to: String(Math.min(doc?.pageCount ?? 1, from + 9)) }])
  }

  const save = async () => {
    if (!doc) return
    setSaving(true)
    try {
      await apiJson(`/api/school/documents/${doc.id}`, {
        method: "PUT",
        body: JSON.stringify({ title, sections: rows.map((r) => ({ week: Number(r.week), title: r.title, fromPage: Number(r.from), toPage: Number(r.to) })) }),
      })
      notify.success("Secciones guardadas")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!doc) return
    const yes = await swalConfirm("¿Quitar este documento?", "Los apuntes de los alumnos sobre él también se eliminan.", { confirmText: "Quitar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/school/documents/${doc.id}`, { method: "DELETE" })
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={doc !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Secciones por clase"
      description={doc ? `${doc.pageCount} páginas. Cada sección se abre al darse la clase de su semana.` : undefined}
      className="max-w-[96vw] md:max-w-2xl"
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void remove()} disabled={saving}>
            <Trash2 className="size-4" />
            Quitar documento
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Título" required value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin secciones: todo el documento es visible desde la primera clase.</p>}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr_4.5rem_4.5rem_auto] items-start gap-2">
              <FormCombobox
                ariaLabel="Semana"
                options={Array.from({ length: weeks }, (_, k) => ({ value: String(k + 1), label: `Semana ${k + 1}` }))}
                value={r.week}
                onChange={(v) => set(i, { week: v })}
                clearable={false}
              />
              <InputGroupField aria-label="Título de la sección" placeholder="Tema de la clase" value={r.title} maxLength={120} onChange={(e) => set(i, { title: e.target.value })} />
              <InputGroupField aria-label="Desde la página" inputMode="numeric" placeholder="Desde" value={r.from} onChange={(e) => set(i, { from: e.target.value.replace(/\D/g, "") })} />
              <InputGroupField aria-label="Hasta la página" inputMode="numeric" placeholder="Hasta" value={r.to} onChange={(e) => set(i, { to: e.target.value.replace(/\D/g, "") })} />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar sección" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="size-4" /> Agregar sección
          </Button>
        </div>
      </div>
    </DialogComponent>
  )
}
