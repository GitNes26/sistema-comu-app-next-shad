"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Megaphone, Pencil, Pin, Plus, Radio, Trash2, Tv } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { POST_AUDIENCES, POST_KINDS, STREAM_PLATFORMS, STREAM_STATUS, type PostAudience, type PostKind, type StreamStatus } from "@/lib/portal/rules"
import type { PostDto, StreamDto } from "@/lib/portal/server"

// Administración del contenido del portal: publicaciones y transmisiones.

const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }))

export function ContentAdmin() {
  const [posts, setPosts] = useState<PostDto[] | null>(null)
  const [streams, setStreams] = useState<StreamDto[] | null>(null)
  const [post, setPost] = useState<PostDto | "new" | null>(null)
  const [stream, setStream] = useState<StreamDto | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        apiJson<{ posts: PostDto[] }>("/api/portal/posts?manage=1"),
        apiJson<{ streams: StreamDto[] }>("/api/portal/streams?manage=1"),
      ])
      setPosts(p.posts)
      setStreams(s.streams)
    } catch (e) {
      swalError("No se pudo cargar", errorMessage(e))
      setPosts([])
      setStreams([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const removePost = async (p: PostDto) => {
    if (!(await swalConfirm(`¿Eliminar «${p.title}»?`, undefined, { confirmText: "Eliminar", danger: true }))) return
    try {
      await apiJson(`/api/portal/posts/${p.id}`, { method: "DELETE" })
      notify.success("Publicación eliminada")
      await load()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }
  const removeStream = async (s: StreamDto) => {
    if (!(await swalConfirm(`¿Eliminar «${s.title}»?`, undefined, { confirmText: "Eliminar", danger: true }))) return
    try {
      await apiJson(`/api/portal/streams/${s.id}`, { method: "DELETE" })
      notify.success("Transmisión eliminada")
      await load()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }
  const setStreamStatus = async (s: StreamDto, status: StreamStatus) => {
    try {
      await apiJson(`/api/portal/streams/${s.id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      await load()
    } catch (e) {
      swalError("No se pudo cambiar", errorMessage(e))
    }
  }

  if (!posts || !streams) return <Skeleton className="h-64 w-full" />

  return (
    <Tabs defaultValue="posts" className="space-y-4">
      <TabsList>
        <TabsTrigger value="posts">Publicaciones ({posts.length})</TabsTrigger>
        <TabsTrigger value="streams">Transmisiones ({streams.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setPost("new")}>
            <Plus className="size-4" />
            Nueva publicación
          </Button>
        </div>
        {posts.length === 0 ? (
          <EmptyState icon={Megaphone} title="Sin publicaciones" description="Publica anuncios, devocionales, artículos o noticias para toda la iglesia." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {p.pinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{p.title}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {POST_KINDS[p.kind]} · {POST_AUDIENCES[p.audience]} · {fmt(p.publishedAt)}
                  </span>
                </span>
                {!p.isPublished && (
                  <StatusPill tone="warning" dot={false}>
                    Borrador
                  </StatusPill>
                )}
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setPost(p)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => void removePost(p)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="streams" className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setStream("new")}>
            <Plus className="size-4" />
            Nueva transmisión
          </Button>
        </div>
        {streams.length === 0 ? (
          <EmptyState icon={Tv} title="Sin transmisiones" description="Agrega el enlace de un video o directo de YouTube o Facebook y se verá incrustado en el portal." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {streams.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {STREAM_PLATFORMS[s.platform]}
                    {s.scheduledAt ? ` · ${fmt(s.scheduledAt)}` : ""}
                    {!s.isPublished ? " · oculta" : ""}
                  </span>
                </span>
                <StatusPill tone={s.status === "live" ? "danger" : s.status === "scheduled" ? "warning" : "neutral"}>{STREAM_STATUS[s.status]}</StatusPill>
                {s.status !== "live" ? (
                  <Button size="sm" variant="outline" onClick={() => void setStreamStatus(s, "live")}>
                    <Radio className="size-4" />
                    Poner en vivo
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void setStreamStatus(s, "ended")}>
                    Terminar
                  </Button>
                )}
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setStream(s)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => void removeStream(s)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <PostDialog value={post} onClose={() => setPost(null)} onSaved={load} />
      <StreamDialog value={stream} onClose={() => setStream(null)} onSaved={load} />
    </Tabs>
  )
}

function PostDialog({ value, onClose, onSaved }: { value: PostDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [kind, setKind] = useState<PostKind>("announcement")
  const [audience, setAudience] = useState<PostAudience>("all")
  const [cover, setCover] = useState("")
  const [pinned, setPinned] = useState(false)
  const [published, setPublished] = useState(true)
  const [at, setAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (value === null) return
    const p = value === "new" ? null : value
    setTitle(p?.title ?? "")
    setBody(p?.body ?? "")
    setKind(p?.kind ?? "announcement")
    setAudience(p?.audience ?? "all")
    setCover(p?.coverUrl ?? "")
    setPinned(p?.pinned ?? false)
    setPublished(p?.isPublished ?? true)
    setAt(p ? new Date(p.publishedAt) : null)
  }, [value])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { title, body, kind, audience, coverUrl: cover || null, pinned, isPublished: published, publishedAt: at ? at.toISOString() : undefined }
      if (value === "new") await apiJson("/api/portal/posts", { method: "POST", body: JSON.stringify(payload) })
      else if (value) await apiJson(`/api/portal/posts/${value.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      notify.success("Publicación guardada")
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
      size="2xl"
      title={value === "new" ? "Nueva publicación" : "Editar publicación"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !title.trim() || !body.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Título" required value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        <div className="space-y-1.5">
          <Label htmlFor="post-body">Contenido</Label>
          <Textarea id="post-body" rows={8} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-muted-foreground">Los enlaces que empiezan con https:// se vuelven clicables.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormCombobox label="Tipo" options={opts(POST_KINDS)} value={kind} onChange={(v) => setKind(v as PostKind)} clearable={false} />
          <FormCombobox label="¿Quién lo ve?" options={opts(POST_AUDIENCES)} value={audience} onChange={(v) => setAudience(v as PostAudience)} clearable={false} />
          <DateTimePicker label="Publicar el" value={at} onChange={setAt} />
          <Attachment label="Imagen de portada (opcional)" value={cover || null} onChange={(u) => setCover(u ?? "")} upload={uploadFile} />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={published} onCheckedChange={setPublished} />
            Publicada
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={pinned} onCheckedChange={setPinned} />
            Fijar arriba
          </label>
        </div>
      </div>
    </DialogComponent>
  )
}

function StreamDialog({ value, onClose, onSaved }: { value: StreamDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<StreamStatus>("scheduled")
  const [at, setAt] = useState<Date | null>(null)
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (value === null) return
    const s = value === "new" ? null : value
    setTitle(s?.title ?? "")
    setUrl(s?.url ?? "")
    setDescription(s?.description ?? "")
    setStatus(s?.status ?? "scheduled")
    setAt(s?.scheduledAt ? new Date(s.scheduledAt) : null)
    setPublished(s?.isPublished ?? true)
  }, [value])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { title, url, description, status, scheduledAt: at ? at.toISOString() : null, isPublished: published }
      if (value === "new") await apiJson("/api/portal/streams", { method: "POST", body: JSON.stringify(payload) })
      else if (value) await apiJson(`/api/portal/streams/${value.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      notify.success("Transmisión guardada")
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
      size="xl"
      title={value === "new" ? "Nueva transmisión" : "Editar transmisión"}
      description="Pega el enlace del video o directo de YouTube o Facebook; se reproduce dentro del portal."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !title.trim() || !url.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Título" required value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        <InputGroupField label="Enlace" required inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} />
        <div className="space-y-1.5">
          <Label htmlFor="stream-desc">Descripción</Label>
          <Textarea id="stream-desc" rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormCombobox label="Estado" options={opts(STREAM_STATUS)} value={status} onChange={(v) => setStatus(v as StreamStatus)} clearable={false} />
          <DateTimePicker label="Fecha y hora" value={at} onChange={setAt} />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={published} onCheckedChange={setPublished} />
          Visible para los creyentes
        </label>
      </div>
    </DialogComponent>
  )
}
