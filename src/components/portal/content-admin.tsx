"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CaseSensitive,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Palette,
  Pencil,
  Pin,
  Plus,
  Radio,
  Trash2,
  Tv,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { TextareaField } from "@/components/base/textarea-field"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { PostFlyer } from "@/components/portal/post-flyer"
import {
  contrastRatio,
  defaultFlyer,
  FLYER_FONTS,
  FLYER_LAYOUTS,
  FLYER_MODES,
  FLYER_PALETTES,
  type Flyer,
  type FlyerDesign,
  type FlyerFont,
  type FlyerLayout,
} from "@/lib/portal/flyer"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import {
  POST_AUDIENCES,
  POST_KINDS,
  STREAM_PLATFORMS,
  STREAM_STATUS,
  type PostAudience,
  type PostKind,
  type StreamStatus,
} from "@/lib/portal/rules"
import type { PostDto, StreamDto } from "@/lib/portal/server"

// Administración del contenido del portal: publicaciones y transmisiones.

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, label]) => ({ value, label }))

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
    if (
      !(await swalConfirm(`¿Eliminar «${p.title}»?`, undefined, {
        confirmText: "Eliminar",
        danger: true,
      }))
    )
      return
    try {
      await apiJson(`/api/portal/posts/${p.id}`, { method: "DELETE" })
      notify.success("Publicación eliminada")
      await load()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }
  const removeStream = async (s: StreamDto) => {
    if (
      !(await swalConfirm(`¿Eliminar «${s.title}»?`, undefined, {
        confirmText: "Eliminar",
        danger: true,
      }))
    )
      return
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
      await apiJson(`/api/portal/streams/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
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
        <TabsTrigger value="streams">
          Transmisiones ({streams.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setPost("new")}>
            <Plus className="size-4" />
            Nueva publicación
          </Button>
        </div>
        {posts.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Sin publicaciones"
            description="Publica anuncios, devocionales, artículos o noticias para toda la iglesia."
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {p.pinned && (
                      <Pin className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{p.title}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {POST_KINDS[p.kind]} · {POST_AUDIENCES[p.audience]} ·{" "}
                    {fmt(p.publishedAt)}
                  </span>
                </span>
                {!p.isPublished && (
                  <StatusPill tone="warning" dot={false}>
                    Borrador
                  </StatusPill>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Editar"
                  onClick={() => setPost(p)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Eliminar"
                  onClick={() => void removePost(p)}
                >
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
          <EmptyState
            icon={Tv}
            title="Sin transmisiones"
            description="Agrega el enlace de un video o directo de YouTube o Facebook y se verá incrustado en el portal."
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {streams.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {STREAM_PLATFORMS[s.platform]}
                    {s.scheduledAt ? ` · ${fmt(s.scheduledAt)}` : ""}
                    {!s.isPublished ? " · oculta" : ""}
                  </span>
                </span>
                <StatusPill
                  tone={
                    s.status === "live"
                      ? "danger"
                      : s.status === "scheduled"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {STREAM_STATUS[s.status]}
                </StatusPill>
                {s.status !== "live" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setStreamStatus(s, "live")}
                  >
                    <Radio className="size-4" />
                    Poner en vivo
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setStreamStatus(s, "ended")}
                  >
                    Terminar
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Editar"
                  onClick={() => setStream(s)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Eliminar"
                  onClick={() => void removeStream(s)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <PostDialog value={post} onClose={() => setPost(null)} onSaved={load} />
      <StreamDialog
        value={stream}
        onClose={() => setStream(null)}
        onSaved={load}
      />
    </Tabs>
  )
}

function PostDialog({
  value,
  onClose,
  onSaved,
}: {
  value: PostDto | "new" | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [kind, setKind] = useState<PostKind>("announcement")
  const [audience, setAudience] = useState<PostAudience>("all")
  const [cover, setCover] = useState("")
  const [flyer, setFlyer] = useState<Flyer | null>(null)
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
    setFlyer(p?.flyer ?? null)
    setPinned(p?.pinned ?? false)
    setPublished(p?.isPublished ?? true)
    setAt(p ? new Date(p.publishedAt) : null)
  }, [value])

  // Cambiar el tipo cambia la plantilla del flyer, conservando colores y tipografía elegidos.
  const changeKind = (k: PostKind) => {
    setKind(k)
    setFlyer((f) => (f && f.mode === "template" ? { ...f, template: k } : f))
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        title,
        body,
        kind,
        audience,
        coverUrl: cover || null,
        flyer,
        pinned,
        isPublished: published,
        publishedAt: at ? at.toISOString() : undefined,
      }
      if (value === "new")
        await apiJson("/api/portal/posts", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      else if (value)
        await apiJson(`/api/portal/posts/${value.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
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
      size="4xl"
      icon={<Megaphone />}
      title={value === "new" ? "Nueva publicación" : "Editar publicación"}
      description="Anuncios, devocionales, artículos y noticias, con flyer opcional."
      bodyClassName="gap-4"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !title.trim() || !body.trim()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-4">
          <InputGroupField
            label="Título"
            required
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextareaField
            label="Contenido"
            rows={8}
            value={body}
            maxLength={8000}
            onChange={(e) => setBody(e.target.value)}
            hint="Los enlaces que empiezan con https:// se vuelven clicables."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormCombobox
              label="Tipo"
              options={opts(POST_KINDS)}
              value={kind}
              onChange={(v) => changeKind(v as PostKind)}
              clearable={false}
            />
            <FormCombobox
              label="¿Quién lo ve?"
              options={opts(POST_AUDIENCES)}
              value={audience}
              onChange={(v) => setAudience(v as PostAudience)}
              clearable={false}
            />
            <DateTimePicker
              label="Publicar el"
              value={at}
              onChange={setAt}
              className="sm:col-span-2"
            />
            <Attachment
              label="Imagen de portada (opcional)"
              value={cover || null}
              onChange={(u) => setCover(u ?? "")}
              upload={uploadFile}
            />
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

        <aside className="min-w-0 space-y-3 rounded-2xl border bg-muted/30 p-3 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-11rem)] lg:self-start lg:overflow-y-auto">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" /> Flyer
            </span>
            <Switch
              checked={flyer !== null}
              onCheckedChange={(on) => setFlyer(on ? defaultFlyer(kind) : null)}
            />
          </label>
          {flyer && (
            <>
              {(flyer.mode === "template" || flyer.url) && (
                <PostFlyer
                  flyer={flyer}
                  title={title || "Título de la publicación"}
                  body={body || "Aquí va un extracto del contenido."}
                  kind={kind}
                />
              )}
              <SegmentedFilter
                ariaLabel="Origen del flyer"
                value={flyer.mode}
                onChange={(m) =>
                  setFlyer(
                    m === "upload"
                      ? { mode: "upload", url: "" }
                      : defaultFlyer(kind)
                  )
                }
                options={Object.entries(FLYER_MODES).map(([value, label]) => ({
                  value: value as Flyer["mode"],
                  label,
                }))}
              />
              {flyer.mode === "upload" ? (
                <Attachment
                  label="Tu flyer (imagen)"
                  value={flyer.url || null}
                  onChange={(u) => setFlyer({ mode: "upload", url: u ?? "" })}
                  upload={uploadFile}
                />
              ) : (
                <FlyerDesigner design={flyer} onChange={setFlyer} />
              )}
            </>
          )}
        </aside>
      </div>
    </DialogComponent>
  )
}

function FlyerDesigner({
  design,
  onChange,
}: {
  design: FlyerDesign
  onChange: (d: FlyerDesign) => void
}) {
  const set = <K extends keyof FlyerDesign>(k: K, v: FlyerDesign[K]) =>
    onChange({ ...design, [k]: v })
  const lowContrast = contrastRatio(design.bg, design.fg) < 3
  const color = (key: "bg" | "fg" | "accent", label: string) => (
    <label className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <input
        type="color"
        value={design[key]}
        onChange={(e) => set(key, e.target.value)}
        className="h-10 w-full min-w-10 cursor-pointer rounded-lg border bg-transparent p-0.5"
        aria-label={label}
      />
      {label}
    </label>
  )
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <LayoutTemplate className="size-4 text-muted-foreground" /> Estructura
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(FLYER_LAYOUTS) as FlyerLayout[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => set("layout", l)}
              aria-pressed={design.layout === l}
              className={`press rounded-lg border px-1 py-1.5 text-center text-[0.7rem] font-medium ${design.layout === l ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              {FLYER_LAYOUTS[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Palette className="size-4 text-muted-foreground" /> Colores
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FLYER_PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              aria-label={`Paleta ${p.label}`}
              onClick={() =>
                onChange({ ...design, bg: p.bg, fg: p.fg, accent: p.accent })
              }
              className="press flex h-9 w-12 overflow-hidden rounded-lg border"
            >
              <span className="flex-1" style={{ background: p.bg }} />
              <span className="w-3" style={{ background: p.accent }} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {color("bg", "Fondo")}
          {color("fg", "Texto")}
          {color("accent", "Acento")}
        </div>
        {lowContrast && (
          <p className="text-xs text-warning-ink">
            El texto casi no se distingue del fondo; prueba otro color.
          </p>
        )}
      </div>
      <FormCombobox
        label="Tipografía"
        icon={<CaseSensitive className="size-4" />}
        options={Object.entries(FLYER_FONTS).map(([value, f]) => ({
          value,
          label: f.label,
        }))}
        value={design.font}
        onChange={(v) => set("font", v as FlyerFont)}
        clearable={false}
        searchable={false}
      />
      <InputGroupField
        label="Subtítulo (opcional)"
        value={design.subtitle ?? ""}
        maxLength={160}
        onChange={(e) => set("subtitle", e.target.value || null)}
        hint="Si lo dejas vacío se usa un extracto del contenido."
      />
      <InputGroupField
        label="Pie: lugar, fecha o contacto (opcional)"
        value={design.footer ?? ""}
        maxLength={120}
        onChange={(e) => set("footer", e.target.value || null)}
      />
      <Attachment
        label="Imagen del flyer (opcional)"
        value={design.imageUrl}
        onChange={(u) => set("imageUrl", u ?? null)}
        upload={uploadFile}
      />
    </div>
  )
}

function StreamDialog({
  value,
  onClose,
  onSaved,
}: {
  value: StreamDto | "new" | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
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
      const payload = {
        title,
        url,
        description,
        status,
        scheduledAt: at ? at.toISOString() : null,
        isPublished: published,
      }
      if (value === "new")
        await apiJson("/api/portal/streams", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      else if (value)
        await apiJson(`/api/portal/streams/${value.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
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
          <Button
            onClick={() => void save()}
            disabled={saving || !title.trim() || !url.trim()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField
          label="Título"
          required
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <InputGroupField
          label="Enlace"
          required
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.target.value)}
        />
        <TextareaField
          label="Descripción"
          rows={3}
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormCombobox
            label="Estado"
            options={opts(STREAM_STATUS)}
            value={status}
            onChange={(v) => setStatus(v as StreamStatus)}
            clearable={false}
          />
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
