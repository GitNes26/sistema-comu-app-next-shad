"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  ListMusic,
  Loader2,
  Mic2,
  Music,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { StatusPill, type StatusTone } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import {
  AUDITION_STATUS_LABEL,
  ROSTER_STATUS_LABEL,
  SONG_KEYS,
  addDays,
  moveItem,
  toYmd,
  weekStartOf,
  type AuditionStatusKey,
  type RosterStatusKey,
} from "@/lib/worship/rules"
import type { AuditionDto, ProgramDto, RosterEntryDto, SongDto } from "@/lib/worship/server"
import type { WorkspaceDto } from "@/lib/ministries/server"
import { cn } from "@/lib/utils"

// Espacio de Alabanza: programa semanal, rol, canciones y audiciones. Lo comparten
// el panel y «Mi espacio»; el servidor decide qué puede hacer cada quien.

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error ?? "Error de red")
  return data as T
}

const KEY_OPTIONS = SONG_KEYS.map((k) => ({ value: k, label: k }))
const ROSTER_TONE: Record<RosterStatusKey, StatusTone> = { pending: "warning", confirmed: "success", declined: "danger" }
const AUDITION_TONE: Record<AuditionStatusKey, StatusTone> = { scheduled: "info", passed: "success", failed: "danger", cancelled: "neutral" }

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "short" })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
const fmtWeek = (ymd: string) => {
  const start = new Date(`${ymd}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
  return `${f(start)} – ${f(end)}`
}

export function WorshipWorkspace({ ministryId, backHref }: { ministryId: string; backHref: string }) {
  const [ws, setWs] = useState<WorkspaceDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ workspace: WorkspaceDto }>(`/api/ministries/${ministryId}`)
      .then((d) => setWs(d.workspace))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo abrir Alabanza"))
  }, [ministryId])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir Alabanza" description={error} />
      </div>
    )
  }
  if (!ws) return <Skeleton className="h-64 w-full" />
  if (ws.ministry.kind !== "worship") {
    return <EmptyState icon={Ban} title="Este ministerio no es de alabanza" description="Marca el ministerio como de alabanza para usar el programa y el rol." />
  }
  const canManage = ws.access.canManage
  const canEdit = ws.access.canManage || ws.access.myRole === "assistant"

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`${backHref}/${ministryId}`}>
          <ArrowLeft className="size-4" />
          {ws.ministry.name}
        </Link>
      </Button>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Music className="size-5" />
        </span>
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Alabanza</h1>
          <p className="text-sm text-muted-foreground">Programa de la semana, rol de servicio y canciones.</p>
        </div>
      </div>

      <Tabs defaultValue="program">
        <TabsList>
          <TabsTrigger value="program">
            <ListMusic className="size-4" /> Programa
          </TabsTrigger>
          <TabsTrigger value="roster">
            <CalendarDays className="size-4" /> Rol
          </TabsTrigger>
          <TabsTrigger value="songs">
            <Music className="size-4" /> Canciones
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="auditions">
              <Mic2 className="size-4" /> Audiciones
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="program">
          <ProgramTab ministryId={ministryId} />
        </TabsContent>
        <TabsContent value="roster">
          <RosterTab ministryId={ministryId} />
        </TabsContent>
        <TabsContent value="songs">
          <SongsTab />
        </TabsContent>
        {canManage && (
          <TabsContent value="auditions">
            <AuditionsTab ministryId={ministryId} />
          </TabsContent>
        )}
      </Tabs>
      {!canEdit && <p className="text-xs text-muted-foreground">Solo el líder o el apoyo del ministerio pueden editar el programa y el rol.</p>}
    </div>
  )
}

// ── Programa semanal ──────────────────────────────────────────────────────────

type DraftSong = { songId: string; title: string; artist: string | null; songKey: string | null; keyUsed: string | null }

function ProgramTab({ ministryId }: { ministryId: string }) {
  const [week, setWeek] = useState(() => toYmd(weekStartOf(new Date())))
  const [program, setProgram] = useState<ProgramDto | null>(null)
  const [draft, setDraft] = useState<DraftSong[]>([])
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api<{ program: ProgramDto }>(`/api/worship/${ministryId}/program?week=${week}`)
      setProgram(d.program)
      setDraft(d.program.songs.map((s) => ({ songId: s.songId, title: s.title, artist: s.artist, songKey: s.songKey, keyUsed: s.keyUsed })))
      setTitle(d.program.title ?? "")
      setNotes(d.program.notes ?? "")
      setDirty(false)
    } catch (err) {
      swalError("No se pudo cargar el programa", err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [ministryId, week])

  useEffect(() => {
    void load()
  }, [load])

  const go = async (next: string) => {
    if (dirty) {
      const ok = await swalConfirm("Tienes cambios sin guardar", "Si cambias de semana se perderán.", { confirmText: "Descartar y continuar", danger: true })
      if (!ok) return
    }
    setWeek(next)
  }
  const shift = (days: number) => void go(toYmd(addDays(new Date(`${week}T00:00:00.000Z`), days)))

  const save = async () => {
    setSaving(true)
    try {
      await api(`/api/worship/${ministryId}/program?week=${week}`, {
        method: "PUT",
        body: JSON.stringify({ title, notes, songs: draft.map((s) => ({ songId: s.songId, keyUsed: s.keyUsed })) }),
      })
      notify.success("Programa guardado")
      await load()
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const copyPrevious = async () => {
    try {
      const prev = toYmd(addDays(new Date(`${week}T00:00:00.000Z`), -7))
      const d = await api<{ program: ProgramDto }>(`/api/worship/${ministryId}/program?week=${prev}`)
      if (d.program.songs.length === 0) {
        notify.info("La semana anterior no tiene programa")
        return
      }
      setDraft(d.program.songs.map((s) => ({ songId: s.songId, title: s.title, artist: s.artist, songKey: s.songKey, keyUsed: s.keyUsed })))
      setDirty(true)
    } catch (err) {
      swalError("No se pudo copiar", err instanceof Error ? err.message : undefined)
    }
  }

  const canEdit = program?.canEdit ?? false
  const isCurrent = week === toYmd(weekStartOf(new Date()))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Semana anterior" onClick={() => shift(-7)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-heading text-sm font-semibold">{fmtWeek(week)}</p>
          <p className="text-xs text-muted-foreground">{isCurrent ? "Esta semana" : "Semana de programa"}</p>
        </div>
        <Button size="icon-sm" variant="outline" aria-label="Semana siguiente" onClick={() => shift(7)}>
          <ChevronRight className="size-4" />
        </Button>
        {!isCurrent && (
          <Button size="sm" variant="ghost" onClick={() => void go(toYmd(weekStartOf(new Date())))}>
            Hoy
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          {canEdit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <InputGroupField
                label="Título (opcional)"
                placeholder="Ej. Semana de adoración"
                value={title}
                maxLength={150}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
              />
              <InputGroupField
                label="Notas (opcional)"
                value={notes}
                maxLength={1000}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setDirty(true)
                }}
              />
            </div>
          )}
          {!canEdit && (program?.title || program?.notes) && (
            <p className="text-sm text-muted-foreground">{[program?.title, program?.notes].filter(Boolean).join(" · ")}</p>
          )}

          {draft.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title="Sin programa para esta semana"
              description={canEdit ? "Agrega las canciones que se tocarán en los servicios de la semana." : "Aún no se ha armado el programa."}
            />
          ) : (
            <ol className="divide-y rounded-2xl border bg-card">
              {draft.map((s, i) => (
                <li key={`${s.songId}-${i}`} className="flex items-center gap-2 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                  <button type="button" onClick={() => setDetailId(s.songId)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium hover:underline">{s.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.artist ?? "—"}</span>
                  </button>
                  {canEdit ? (
                    <div className="w-24 shrink-0">
                      <FormCombobox
                        ariaLabel={`Tono de ${s.title}`}
                        options={KEY_OPTIONS}
                        value={s.keyUsed ?? s.songKey}
                        placeholder="Tono"
                        clearable={false}
                        onChange={(v) => {
                          setDraft((d) => d.map((x, j) => (j === i ? { ...x, keyUsed: v } : x)))
                          setDirty(true)
                        }}
                      />
                    </div>
                  ) : (
                    (s.keyUsed ?? s.songKey) && <StatusPill tone="neutral" dot={false}>{s.keyUsed ?? s.songKey}</StatusPill>
                  )}
                  {canEdit && (
                    <span className="flex shrink-0">
                      <Button size="icon-sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => { setDraft((d) => moveItem(d, i, i - 1)); setDirty(true) }}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Bajar" disabled={i === draft.length - 1} onClick={() => { setDraft((d) => moveItem(d, i, i + 1)); setDirty(true) }}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${s.title}`} onClick={() => { setDraft((d) => d.filter((_, j) => j !== i)); setDirty(true) }}>
                        <X className="size-4" />
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setPickerOpen(true)}>
                <Plus className="size-4" />
                Agregar canción
              </Button>
              {draft.length === 0 && (
                <Button variant="ghost" onClick={() => void copyPrevious()}>
                  Copiar la semana anterior
                </Button>
              )}
              <Button className="ml-auto" onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Guardar programa
              </Button>
            </div>
          )}

          {program && program.history.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Historial</p>
              <div className="flex flex-wrap gap-2">
                {program.history.map((h) => (
                  <button
                    key={h.weekStart}
                    type="button"
                    onClick={() => void go(h.weekStart)}
                    className={cn(
                      "press rounded-full border px-3 py-1.5 text-xs font-medium",
                      h.weekStart === week ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40"
                    )}
                  >
                    {fmtWeek(h.weekStart)} · {h.count}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SongPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(s) => {
          setDraft((d) => [...d, { songId: s.id, title: s.title, artist: s.artist, songKey: s.songKey, keyUsed: null }])
          setDirty(true)
          setPickerOpen(false)
        }}
      />
      <SongDetailDialog songId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}

function SongPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: SongDto) => void }) {
  const [q, setQ] = useState("")
  const [songs, setSongs] = useState<SongDto[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const d = await api<{ songs: SongDto[] }>(`/api/worship/songs?q=${encodeURIComponent(q)}`)
        setSongs(d.songs)
      } catch {
        setSongs([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open])

  return (
    <DialogComponent open={open} onOpenChange={(o) => !o && onClose()} title="Agregar canción" description="Elige del catálogo de la iglesia.">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input
            type="search"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título o artista…"
            aria-label="Buscar canción"
            className="pl-9 md:pl-9 desk:pl-9"
            autoFocus
          />
        </div>
        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
          {loading && (
            <li className="flex justify-center p-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {!loading && songs.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados. Agrégala en la pestaña Canciones.</li>}
          {songs.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onPick(s)} className="flex min-h-12 w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-muted">
                <span className="text-sm font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground">{[s.artist, s.songKey].filter(Boolean).join(" · ") || "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DialogComponent>
  )
}

function SongDetailDialog({ songId, onClose }: { songId: string | null; onClose: () => void }) {
  const [song, setSong] = useState<SongDto | null>(null)
  useEffect(() => {
    if (!songId) {
      setSong(null)
      return
    }
    let alive = true
    api<{ song: SongDto }>(`/api/worship/songs/${songId}`)
      .then((d) => alive && setSong(d.song))
      .catch(() => alive && setSong(null))
    return () => {
      alive = false
    }
  }, [songId])

  return (
    <DialogComponent
      open={songId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={song?.title ?? "Canción"}
      description={song ? [song.artist, song.songKey ? `Tono ${song.songKey}` : null, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(" · ") : undefined}
    >
      {!song ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-4">
          {song.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={song.imageUrl} alt="" className="max-h-48 w-full rounded-xl object-contain" />
          )}
          {song.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {song.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:border-primary/40"
                >
                  <ExternalLink className="size-3.5" />
                  {l.label}
                </a>
              ))}
            </div>
          )}
          {song.notes && <p className="rounded-xl bg-muted/60 p-3 text-sm">{song.notes}</p>}
          {song.lyrics ? (
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{song.lyrics}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">Esta canción aún no tiene letra.</p>
          )}
        </div>
      )}
    </DialogComponent>
  )
}

// ── Canciones ─────────────────────────────────────────────────────────────────

const songSchema = yup.object({
  title: yup.string().trim().required("Escribe el título").max(150),
  artist: yup.string().trim().max(150).default(""),
  songKey: yup.string().default(""),
  bpm: yup
    .number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .integer("Debe ser entero")
    .min(30, "Mínimo 30")
    .max(300, "Máximo 300")
    .optional(),
  lyrics: yup.string().max(20000).default(""),
  notes: yup.string().trim().max(2000).default(""),
  imageUrl: yup.string().default(""),
  isActive: yup.boolean().default(true),
  links: yup
    .array(
      yup.object({
        label: yup.string().trim().max(60).default(""),
        url: yup.string().trim().url("URL inválida (https://…)").required("Pega el enlace"),
      })
    )
    .max(10)
    .default([]),
})
type SongValues = yup.InferType<typeof songSchema>

function SongsTab() {
  const [songs, setSongs] = useState<SongDto[] | null>(null)
  const [canWrite, setCanWrite] = useState(false)
  const [q, setQ] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editing, setEditing] = useState<SongDto | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api<{ songs: SongDto[]; canWrite: boolean }>(`/api/worship/songs?q=${encodeURIComponent(q)}&all=1`)
      setSongs(d.songs)
      setCanWrite(d.canWrite)
    } catch (err) {
      setSongs([])
      swalError("No se pudo cargar el catálogo", err instanceof Error ? err.message : undefined)
    }
  }, [q])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  const openEdit = async (id: string) => {
    try {
      const d = await api<{ song: SongDto }>(`/api/worship/songs/${id}`)
      setEditing(d.song)
    } catch (err) {
      swalError("No se pudo abrir la canción", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input
            type="search"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título o artista…"
            aria-label="Buscar canción"
            className="pl-9 md:pl-9 desk:pl-9"
          />
        </div>
        {canWrite && (
          <Button className="ml-auto" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nueva canción
          </Button>
        )}
      </div>

      {songs === null ? (
        <Skeleton className="h-40 w-full" />
      ) : songs.length === 0 ? (
        <EmptyState icon={Music} title="Sin canciones" description={canWrite ? "Agrega las canciones que usa el ministerio, con su tono, letra y enlaces." : "Aún no hay canciones en el catálogo."} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {songs.map((s) => (
            <li key={s.id}>
              <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", !s.isActive && "opacity-60")}>
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Music className="size-5 text-muted-foreground" />
                  )}
                </span>
                <button type="button" onClick={() => setDetailId(s.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium hover:underline">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.artist, s.songKey, s.bpm ? `${s.bpm} BPM` : null].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="mt-0.5 flex gap-2 text-[0.7rem] text-muted-foreground">
                    {s.hasLyrics && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3" /> Letra
                      </span>
                    )}
                    {s.links.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="size-3" /> {s.links.length}
                      </span>
                    )}
                    {!s.isActive && <span>Inactiva</span>}
                  </span>
                </button>
                {canWrite && (
                  <Button size="sm" variant="ghost" onClick={() => void openEdit(s.id)}>
                    Editar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SongDetailDialog songId={detailId} onClose={() => setDetailId(null)} />
      <SongFormDialog
        song={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          await load()
        }}
      />
    </div>
  )
}

function SongFormDialog({ song, onClose, onSaved }: { song: SongDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const isNew = song === "new"
  const current = song && song !== "new" ? song : null
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SongValues>({ resolver: yupResolver(songSchema) as never })
  const links = useFieldArray({ control, name: "links" })

  useEffect(() => {
    if (song === null) return
    reset({
      title: current?.title ?? "",
      artist: current?.artist ?? "",
      songKey: current?.songKey ?? "",
      bpm: current?.bpm ?? undefined,
      lyrics: current?.lyrics ?? "",
      notes: current?.notes ?? "",
      imageUrl: current?.imageUrl ?? "",
      isActive: current?.isActive ?? true,
      links: current?.links ?? [],
    })
  }, [song, current, reset])

  const submit = async (v: SongValues) => {
    try {
      const body = JSON.stringify({ ...v, songKey: v.songKey || null, bpm: v.bpm ?? null })
      if (current) await api(`/api/worship/songs/${current.id}`, { method: "PUT", body })
      else await api("/api/worship/songs", { method: "POST", body })
      notify.success(current ? "Canción guardada" : "Canción agregada")
      await onSaved()
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <DialogComponent
      open={song !== null}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Nueva canción" : "Editar canción"}
      description="Tono, letra y enlaces de referencia para el ministerio."
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
        <div className="sm:col-span-2" data-form-field="title">
          <InputGroupField id="title" label="Título" required error={errors.title?.message} {...register("title")} />
        </div>
        <InputGroupField id="artist" label="Artista o ministerio" error={errors.artist?.message} {...register("artist")} />
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="songKey"
            render={({ field }) => (
              <FormCombobox label="Tono" options={KEY_OPTIONS} value={field.value} onChange={field.onChange} onClear={() => field.onChange("")} placeholder="—" />
            )}
          />
          <div data-form-field="bpm">
            <InputGroupField id="bpm" label="BPM" inputMode="numeric" error={errors.bpm?.message} {...register("bpm")} />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="lyrics">Letra</Label>
          <Textarea id="lyrics" rows={8} {...register("lyrics")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas para el ministerio</Label>
          <Textarea id="notes" rows={2} placeholder="Ej. Empezar suave, subir en el puente" {...register("notes")} />
        </div>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <Attachment
                label="Imagen (portada o diapositiva)"
                value={field.value || null}
                onChange={(u) => field.onChange(u ?? "")}
                upload={uploadFile}
                accept={UPLOAD_IMAGE_ACCEPT}
              />
            )}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Enlaces de referencia</Label>
            <Button type="button" size="sm" variant="outline" disabled={links.fields.length >= 10} onClick={() => links.append({ label: "", url: "" })}>
              <Plus className="size-4" />
              Agregar enlace
            </Button>
          </div>
          {links.fields.length === 0 && <p className="text-xs text-muted-foreground">YouTube, Spotify, partituras, acordes…</p>}
          {links.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_2fr_auto] items-start gap-2">
              <InputGroupField aria-label="Etiqueta del enlace" placeholder="YouTube" {...register(`links.${i}.label` as const)} />
              <InputGroupField
                aria-label="URL del enlace"
                type="url"
                inputMode="url"
                placeholder="https://…"
                error={errors.links?.[i]?.url?.message}
                {...register(`links.${i}.url` as const)}
              />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar enlace" onClick={() => links.remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {current && (
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <SwitchField
                  label="Activa"
                  description="Las canciones inactivas no aparecen al armar programas; los anteriores las conservan."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        )}
      </form>
    </DialogComponent>
  )
}

// ── Rol ───────────────────────────────────────────────────────────────────────

const rosterSchema = yup.object({
  memberId: yup.string().required("Elige a la persona"),
  serviceAt: yup.date().typeError("Elige fecha y hora").required("Elige fecha y hora"),
  serviceLabel: yup.string().trim().max(80).default(""),
  instrument: yup.string().trim().max(60).default(""),
})
type RosterValues = yup.InferType<typeof rosterSchema>

function RosterTab({ ministryId }: { ministryId: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<{ entries: RosterEntryDto[]; canEdit: boolean; servers: { memberId: string; fullName: string }[] } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api<{ roster: { entries: RosterEntryDto[]; canEdit: boolean; servers: { memberId: string; fullName: string }[] } }>(
        `/api/worship/${ministryId}/roster?month=${month}`
      )
      setData(d.roster)
    } catch (err) {
      setData({ entries: [], canEdit: false, servers: [] })
      swalError("No se pudo cargar el rol", err instanceof Error ? err.message : undefined)
    }
  }, [ministryId, month])

  useEffect(() => {
    void load()
  }, [load])

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(Date.UTC(y, m - 1 + delta, 1))
    setMonth(d.toISOString().slice(0, 7))
  }

  const respond = async (id: string, status: "confirmed" | "declined") => {
    setBusy(id)
    try {
      await api(`/api/worship/roster/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      notify.success(status === "confirmed" ? "Confirmaste tu lugar" : "Avisaste que no puedes")
      await load()
    } catch (err) {
      swalError("No se pudo responder", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const remove = async (e: RosterEntryDto) => {
    const ok = await swalConfirm(`¿Quitar a «${e.fullName}» de este servicio?`, undefined, { confirmText: "Quitar", danger: true })
    if (!ok) return
    setBusy(e.id)
    try {
      await api(`/api/worship/roster/${e.id}`, { method: "DELETE" })
      await load()
    } catch (err) {
      swalError("No se pudo quitar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, RosterEntryDto[]>()
    for (const e of data?.entries ?? []) map.set(e.serviceAt, [...(map.get(e.serviceAt) ?? []), e])
    return [...map.entries()]
  }, [data])

  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center font-heading text-sm font-semibold first-letter:uppercase">{monthLabel}</p>
        <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
        {data?.canEdit && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Asignar
          </Button>
        )}
      </div>

      {data === null ? (
        <Skeleton className="h-40 w-full" />
      ) : groups.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin asignaciones este mes" description={data.canEdit ? "Asigna a los servidores a cada servicio del mes." : "Aún no se publica el rol de este mes."} />
      ) : (
        <ul className="space-y-3">
          {groups.map(([serviceAt, entries]) => (
            <li key={serviceAt} className="rounded-2xl border bg-card">
              <div className="flex flex-wrap items-baseline gap-x-2 border-b px-3 py-2">
                <span className="text-sm font-semibold first-letter:uppercase">{fmtDay(serviceAt)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtTime(serviceAt)}</span>
                {entries[0].serviceLabel && <span className="text-xs text-muted-foreground">· {entries[0].serviceLabel}</span>}
              </div>
              <ul className="divide-y">
                {entries.map((e) => (
                  <li key={e.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", e.mine && "bg-primary/5")}>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{e.fullName}</span>
                      {e.mine && <span className="ml-1.5 text-xs text-primary">(tú)</span>}
                      {e.instrument && <span className="ml-2 text-xs text-muted-foreground">{e.instrument}</span>}
                    </span>
                    <StatusPill tone={ROSTER_TONE[e.status]}>{ROSTER_STATUS_LABEL[e.status]}</StatusPill>
                    {e.mine && e.status !== "confirmed" && (
                      <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => void respond(e.id, "confirmed")}>
                        <UserCheck className="size-4" /> Confirmo
                      </Button>
                    )}
                    {e.mine && e.status !== "declined" && (
                      <Button size="sm" variant="ghost" disabled={busy === e.id} onClick={() => void respond(e.id, "declined")}>
                        No puedo
                      </Button>
                    )}
                    {data.canEdit && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Quitar a ${e.fullName}`} disabled={busy === e.id} onClick={() => void remove(e)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <RosterDialog ministryId={ministryId} open={addOpen} servers={data?.servers ?? []} onClose={() => setAddOpen(false)} onDone={load} />
    </div>
  )
}

function RosterDialog({
  ministryId,
  open,
  servers,
  onClose,
  onDone,
}: {
  ministryId: string
  open: boolean
  servers: { memberId: string; fullName: string }[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RosterValues>({
    resolver: yupResolver(rosterSchema) as never,
    defaultValues: { memberId: "", serviceAt: undefined, serviceLabel: "", instrument: "" },
  })
  useEffect(() => {
    if (open) reset({ memberId: "", serviceAt: undefined, serviceLabel: "", instrument: "" })
  }, [open, reset])

  const submit = async (v: RosterValues) => {
    try {
      await api(`/api/worship/${ministryId}/roster`, { method: "POST", body: JSON.stringify({ ...v, serviceAt: v.serviceAt.toISOString() }) })
      notify.success("Asignación guardada")
      onClose()
      await onDone()
    } catch (err) {
      swalError("No se pudo asignar", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Asignar al rol"
      description="Quién toca en qué servicio. La persona podrá confirmar desde su espacio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Asignar
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="space-y-4">
        <div data-form-field="memberId">
          <Controller
            control={control}
            name="memberId"
            render={({ field }) => (
              <FormCombobox
                label="Persona"
                required
                options={servers.map((s) => ({ value: s.memberId, label: s.fullName }))}
                value={field.value}
                onChange={field.onChange}
                clearable={false}
                error={errors.memberId?.message}
              />
            )}
          />
        </div>
        <div data-form-field="serviceAt">
          <Controller
            control={control}
            name="serviceAt"
            render={({ field }) => (
              <DateTimePicker label="Servicio (fecha y hora)" required value={field.value ?? null} onChange={(d) => field.onChange(d ?? undefined)} error={errors.serviceAt?.message} />
            )}
          />
        </div>
        <InputGroupField id="serviceLabel" label="Servicio (etiqueta)" placeholder="Ej. Domingo 10:00" {...register("serviceLabel")} />
        <InputGroupField id="instrument" label="Instrumento o función" placeholder="Ej. Batería, Voz" {...register("instrument")} />
      </form>
    </DialogComponent>
  )
}

// ── Audiciones ────────────────────────────────────────────────────────────────

function AuditionsTab({ ministryId }: { ministryId: string }) {
  const [rows, setRows] = useState<AuditionDto[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api<{ auditions: AuditionDto[] }>(`/api/worship/${ministryId}/auditions`)
      setRows(d.auditions)
    } catch (err) {
      setRows([])
      swalError("No se pudieron cargar las audiciones", err instanceof Error ? err.message : undefined)
    }
  }, [ministryId])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = async (a: AuditionDto, status: "passed" | "failed" | "cancelled") => {
    let addToMinistry = false
    if (status === "passed" && !a.alreadyServes) {
      addToMinistry = await swalConfirm(`¿Integrar a «${a.fullName}» al ministerio?`, "Se agrega como servidor; puedes cambiar su papel después.", {
        confirmText: "Sí, integrarlo",
        cancelText: "Solo aprobar",
        icon: "question",
      })
    }
    setBusy(a.id)
    try {
      await api(`/api/worship/auditions/${a.id}`, { method: "PATCH", body: JSON.stringify({ status, addToMinistry }) })
      notify.success(status === "passed" ? "Audición aprobada" : status === "failed" ? "Audición registrada como no aprobada" : "Audición cancelada")
      await load()
    } catch (err) {
      swalError("No se pudo registrar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Programar audición
        </Button>
      </div>
      {rows === null ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Mic2} title="Sin audiciones" description="Programa la audición de quien quiera integrarse al ministerio." />
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id} className="rounded-2xl border bg-card p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {a.fullName}
                    {a.instrument && <span className="ml-2 text-xs font-normal text-muted-foreground">{a.instrument}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground first-letter:uppercase">
                    {fmtDay(a.scheduledAt)} · {fmtTime(a.scheduledAt)}
                  </p>
                </div>
                <StatusPill tone={AUDITION_TONE[a.status]}>{AUDITION_STATUS_LABEL[a.status]}</StatusPill>
              </div>
              {a.status === "scheduled" && (
                <div className="mt-2 flex flex-wrap justify-end gap-1">
                  <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => void resolve(a, "passed")}>
                    <Check className="size-4" /> Aprobar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => void resolve(a, "failed")}>
                    No aprobar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => void resolve(a, "cancelled")}>
                    Cancelar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <AuditionDialog ministryId={ministryId} open={open} onClose={() => setOpen(false)} onDone={load} />
    </div>
  )
}

const auditionSchema = yup.object({
  memberId: yup.string().required("Elige a la persona"),
  instrument: yup.string().trim().max(60).default(""),
  scheduledAt: yup.date().typeError("Elige fecha y hora").required("Elige fecha y hora"),
})
type AuditionValues = yup.InferType<typeof auditionSchema>

function AuditionDialog({ ministryId, open, onClose, onDone }: { ministryId: string; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const [candidates, setCandidates] = useState<{ id: string; fullName: string }[]>([])
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AuditionValues>({
    resolver: yupResolver(auditionSchema) as never,
    defaultValues: { memberId: "", instrument: "", scheduledAt: undefined },
  })

  useEffect(() => {
    if (!open) return
    reset({ memberId: "", instrument: "", scheduledAt: undefined })
    // Creyentes que aún no sirven en el ministerio (mínimo de datos).
    api<{ candidates: { id: string; fullName: string }[] }>(`/api/ministries/${ministryId}/members?q=`)
      .then((d) => setCandidates(d.candidates))
      .catch(() => setCandidates([]))
  }, [open, ministryId, reset])

  const submit = async (v: AuditionValues) => {
    try {
      await api(`/api/worship/${ministryId}/auditions`, { method: "POST", body: JSON.stringify({ ...v, scheduledAt: v.scheduledAt.toISOString() }) })
      notify.success("Audición programada")
      onClose()
      await onDone()
    } catch (err) {
      swalError("No se pudo programar", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Programar audición"
      description="Quien quiera integrarse debe estar registrado en el padrón de creyentes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Programar
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="space-y-4">
        <div data-form-field="memberId">
          <Controller
            control={control}
            name="memberId"
            render={({ field }) => (
              <FormCombobox
                label="Creyente"
                required
                options={candidates.map((c) => ({ value: c.id, label: c.fullName }))}
                value={field.value}
                onChange={field.onChange}
                clearable={false}
                error={errors.memberId?.message}
                helper="Se muestran los primeros 20; escribe para buscar entre ellos."
              />
            )}
          />
        </div>
        <InputGroupField id="instrument" label="Instrumento o voz" placeholder="Ej. Guitarra, Voz" {...register("instrument")} />
        <div data-form-field="scheduledAt">
          <Controller
            control={control}
            name="scheduledAt"
            render={({ field }) => (
              <DateTimePicker label="Fecha y hora" required value={field.value ?? null} onChange={(d) => field.onChange(d ?? undefined)} error={errors.scheduledAt?.message} />
            )}
          />
        </div>
      </form>
    </DialogComponent>
  )
}
