"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import "pdfjs-dist/web/pdf_viewer.css"
import { ArrowLeft, Ban, Highlighter, Loader2, MessageSquareText, NotebookPen, Scan, Trash2, Type, X, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { AnnotationDto, DocumentViewDto } from "@/lib/school/documents"
import type { NRect } from "@/lib/school/document-rules"
import { cn } from "@/lib/utils"

// Visor del libro digital con apuntes privados: subrayado de colores, texto sobre
// la página y notas ligadas a un fragmento. Las notas se muestran como un marcador
// discreto en el margen y el texto completo en el panel «Mis apuntes».

const COLORS = [
  { value: "#facc15", label: "Amarillo" },
  { value: "#4ade80", label: "Verde" },
  { value: "#f472b6", label: "Rosa" },
  { value: "#60a5fa", label: "Azul" },
]
type Tool = "select" | "text" | "area"
interface Pending {
  page: number
  rects: NRect[]
  quote: string
}

const MAX_BASE_WIDTH = 880

export function DocumentViewer({ documentId, backHref }: { documentId: string; backHref: string }) {
  const [doc, setDoc] = useState<DocumentViewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<AnnotationDto[]>([])
  const [tool, setTool] = useState<Tool>("select")
  const [color, setColor] = useState(COLORS[0].value)
  const [pending, setPending] = useState<Pending | null>(null)
  const [noteText, setNoteText] = useState("")
  const [asNote, setAsNote] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panel, setPanel] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [pdf, setPdf] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ document: DocumentViewDto }>(`/api/school/documents/${documentId}`)
      setDoc(d.document)
      setNotes(d.document.annotations)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el documento"))
    }
  }, [documentId])
  useEffect(() => {
    void load()
  }, [load])

  // Ancho disponible (respeta el contenedor; el zoom lo multiplica).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.min(MAX_BASE_WIDTH, el.clientWidth)))
    ro.observe(el)
    setWidth(Math.min(MAX_BASE_WIDTH, el.clientWidth))
    return () => ro.disconnect()
  }, [doc])

  // PDF: se carga el archivo ya recortado a las páginas habilitadas.
  useEffect(() => {
    if (!doc || doc.kind !== "pdf") return
    let cancelled = false
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | null = null
    ;(async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
        task = pdfjs.getDocument({ url: `/api/school/documents/${documentId}/file`, withCredentials: true })
        const loaded = await task.promise
        if (!cancelled) setPdf(loaded)
      } catch {
        if (!cancelled) setError("No se pudo cargar el PDF")
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [doc, documentId])

  const create = async (data: { page: number; kind: "highlight" | "text" | "note"; rects: NRect[]; text?: string; quote?: string; color?: string }) => {
    try {
      const r = await apiJson<{ id: string }>(`/api/school/documents/${documentId}/annotations`, { method: "POST", body: JSON.stringify({ color, ...data }) })
      setNotes((n) => [...n, { id: r.id, page: data.page, kind: data.kind, color: data.color ?? color, rects: data.rects, text: data.text ?? null, quote: data.quote ?? null }])
    } catch (e) {
      swalError("No se pudo guardar el apunte", errorMessage(e))
    }
  }
  const update = async (a: AnnotationDto, patch: Partial<AnnotationDto>) => {
    const next = { ...a, ...patch }
    try {
      await apiJson(`/api/school/documents/${documentId}/annotations`, {
        method: "POST",
        body: JSON.stringify({ id: a.id, page: next.page, kind: next.kind, color: next.color, rects: next.rects, text: next.text, quote: next.quote }),
      })
      setNotes((n) => n.map((x) => (x.id === a.id ? next : x)))
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    }
  }
  const remove = async (a: AnnotationDto) => {
    if (a.kind !== "highlight") {
      const yes = await swalConfirm("¿Borrar este apunte?", undefined, { confirmText: "Borrar", danger: true })
      if (!yes) return
    }
    try {
      await apiJson(`/api/school/documents/${documentId}/annotations?id=${a.id}`, { method: "DELETE" })
      setNotes((n) => n.filter((x) => x.id !== a.id))
      setOpen(null)
    } catch (e) {
      swalError("No se pudo borrar", errorMessage(e))
    }
  }

  const commitPending = async (kind: "highlight" | "note") => {
    if (!pending) return
    if (kind === "note" && !noteText.trim()) return
    await create({ page: pending.page, kind, rects: pending.rects, quote: pending.quote, text: kind === "note" ? noteText.trim() : undefined })
    setPending(null)
    setNoteText("")
    setAsNote(false)
    window.getSelection()?.removeAllRanges()
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir el libro" description={error} />
      </div>
    )
  }
  if (!doc) return <Skeleton className="h-96 w-full" />

  const pageWidth = Math.round(width * zoom)
  const sectionsLabel = doc.sections.length > 0 ? doc.sections.map((s) => `Sem. ${s.week}: ${s.title}`).join(" · ") : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-heading text-lg font-semibold">{doc.title}</h1>
      </div>
      {doc.mode === "student" && doc.pages.length < doc.totalPages && (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Ves las páginas habilitadas hasta tu última clase ({doc.pages.length} de {doc.totalPages}). {sectionsLabel}
        </p>
      )}

      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 backdrop-blur">
        <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")} title="Selecciona texto para subrayar o anotar">
          <Highlighter className="size-4" /> Subrayar
        </Button>
        <Button size="sm" variant={tool === "area" ? "default" : "outline"} onClick={() => setTool("area")} title="Arrastra para resaltar un área (útil en imágenes)">
          <Scan className="size-4" /> Área
        </Button>
        <Button size="sm" variant={tool === "text" ? "default" : "outline"} onClick={() => setTool("text")} title="Toca la página para escribir sobre ella">
          <Type className="size-4" /> Texto
        </Button>
        <span className="mx-1 h-6 w-px bg-border" />
        <span className="flex items-center gap-1" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.label}
              onClick={() => setColor(c.value)}
              className={cn("size-7 rounded-full border-2", color === c.value ? "border-foreground" : "border-transparent")}
              style={{ background: c.value }}
            />
          ))}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}>
            <ZoomOut className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}>
            <ZoomIn className="size-4" />
          </Button>
          <Button size="sm" variant={panel ? "default" : "outline"} onClick={() => setPanel((p) => !p)}>
            <NotebookPen className="size-4" /> Mis apuntes ({notes.filter((n) => n.kind !== "highlight").length})
          </Button>
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div ref={wrapRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="mx-auto space-y-4" style={{ width: pageWidth }}>
            {doc.pages.map((original, index) => (
              <PageSurface
                key={original}
                doc={doc}
                pdf={pdf}
                index={index}
                original={original}
                width={pageWidth}
                tool={tool}
                color={color}
                annotations={notes.filter((n) => n.page === original)}
                openId={open}
                onOpen={setOpen}
                onSelection={(p) => {
                  setPending(p)
                  setAsNote(false)
                }}
                onArea={(rect) => void create({ page: original, kind: "highlight", rects: [rect] })}
                onText={(rect, text) => void create({ page: original, kind: "text", rects: [rect], text })}
                onUpdate={update}
                onRemove={remove}
              />
            ))}
          </div>
        </div>

        {panel && (
          <aside className="sticky top-16 hidden max-h-[calc(100dvh-6rem)] w-72 shrink-0 space-y-2 overflow-y-auto rounded-2xl border bg-card p-3 md:block">
            <NotesPanel notes={notes} onOpen={(a) => document.getElementById(`page-${a.page}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} onRemove={remove} onUpdate={update} />
          </aside>
        )}
      </div>

      {panel && (
        <section className="space-y-2 rounded-2xl border bg-card p-3 md:hidden">
          <NotesPanel notes={notes} onOpen={(a) => document.getElementById(`page-${a.page}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} onRemove={remove} onUpdate={update} />
        </section>
      )}

      {pending && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg space-y-2 rounded-2xl border bg-card p-3 shadow-lg">
          {asNote ? (
            <>
              <p className="line-clamp-2 text-xs text-muted-foreground">“{pending.quote}”</p>
              <Textarea rows={3} autoFocus value={noteText} maxLength={2000} onChange={(e) => setNoteText(e.target.value)} placeholder="Escribe tu nota…" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAsNote(false)}>
                  Atrás
                </Button>
                <Button size="sm" disabled={!noteText.trim()} onClick={() => void commitPending("note")}>
                  Guardar nota
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1" role="radiogroup" aria-label="Color del subrayado">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={color === c.value}
                    aria-label={c.label}
                    onClick={() => setColor(c.value)}
                    className={cn("size-8 rounded-full border-2", color === c.value ? "border-foreground" : "border-transparent")}
                    style={{ background: c.value }}
                  />
                ))}
              </span>
              <Button size="sm" onClick={() => void commitPending("highlight")}>
                <Highlighter className="size-4" /> Subrayar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAsNote(true)}>
                <MessageSquareText className="size-4" /> Nota
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                aria-label="Cancelar"
                onClick={() => {
                  setPending(null)
                  window.getSelection()?.removeAllRanges()
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

function PageSurface({
  doc,
  pdf,
  index,
  original,
  width,
  tool,
  color,
  annotations,
  openId,
  onOpen,
  onSelection,
  onArea,
  onText,
  onUpdate,
  onRemove,
}: {
  doc: DocumentViewDto
  pdf: import("pdfjs-dist").PDFDocumentProxy | null
  index: number
  original: number
  width: number
  tool: Tool
  color: string
  annotations: AnnotationDto[]
  openId: string | null
  onOpen: (id: string | null) => void
  onSelection: (p: Pending) => void
  onArea: (r: NRect) => void
  onText: (r: NRect, text: string) => void
  onUpdate: (a: AnnotationDto, patch: Partial<AnnotationDto>) => Promise<void>
  onRemove: (a: AnnotationDto) => Promise<void>
}) {
  const host = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const textLayer = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(index < 2)
  const [height, setHeight] = useState(Math.round(width * 1.3))
  const [drag, setDrag] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "800px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // PDF: lienzo + capa de texto (para poder seleccionar).
  useEffect(() => {
    if (doc.kind !== "pdf" || !pdf || !visible) return
    let cancelled = false
    ;(async () => {
      const pdfjs = await import("pdfjs-dist")
      const page = await pdf.getPage(index + 1)
      const base = page.getViewport({ scale: 1 })
      const scale = width / base.width
      const vp = page.getViewport({ scale })
      if (cancelled || !canvas.current || !textLayer.current) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const c = canvas.current
      c.width = Math.floor(vp.width * dpr)
      c.height = Math.floor(vp.height * dpr)
      c.style.width = `${vp.width}px`
      c.style.height = `${vp.height}px`
      setHeight(Math.round(vp.height))
      const ctx = c.getContext("2d")
      if (!ctx) return
      await page.render({ canvas: c, canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise
      if (cancelled || !textLayer.current) return
      const layer = textLayer.current
      layer.replaceChildren()
      layer.style.setProperty("--scale-factor", String(scale))
      layer.style.setProperty("--total-scale-factor", String(scale))
      const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport: vp })
      await tl.render()
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [doc.kind, pdf, index, width, visible])

  const norm = (clientX: number, clientY: number) => {
    const box = surface.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (clientY - box.top) / box.height)) }
  }

  // Subrayar o anotar: se toma la selección de texto al soltar.
  const onPointerUp = () => {
    if (tool === "area" && drag) {
      const rect = { x: Math.min(drag.x, drag.cx), y: Math.min(drag.y, drag.cy), w: Math.abs(drag.cx - drag.x), h: Math.abs(drag.cy - drag.y) }
      setDrag(null)
      if (rect.w > 0.01 && rect.h > 0.01) onArea(rect)
      return
    }
    if (tool !== "select") return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !surface.current) return
    const range = sel.getRangeAt(0)
    if (!surface.current.contains(range.commonAncestorContainer)) return
    const box = surface.current.getBoundingClientRect()
    const rects: NRect[] = Array.from(range.getClientRects())
      .map((r) => ({ x: (r.left - box.left) / box.width, y: (r.top - box.top) / box.height, w: r.width / box.width, h: r.height / box.height }))
      .filter((r) => r.w > 0.003 && r.h > 0.003)
    if (rects.length === 0) return
    onSelection({ page: original, rects, quote: sel.toString().replace(/\s+/g, " ").trim().slice(0, 500) })
  }

  const isImage = doc.kind === "image"
  const surfaceHeight = doc.kind === "pdf" ? height : undefined

  return (
    <div ref={host} id={`page-${original}`} className="space-y-1">
      <p className="text-center text-[0.7rem] text-muted-foreground">Página {original}</p>
      <div
        ref={surface}
        className={cn("relative mx-auto overflow-hidden rounded-lg border bg-white text-neutral-900 shadow-sm", tool === "text" && "cursor-text", tool === "area" && "cursor-crosshair")}
        style={{ width, height: surfaceHeight, minHeight: doc.kind === "pdf" ? undefined : 200 }}
        onPointerUp={onPointerUp}
        onPointerDown={(e) => {
          if (tool === "area" && surface.current) {
            const p = norm(e.clientX, e.clientY)
            setDrag({ x: p.x, y: p.y, cx: p.x, cy: p.y })
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          }
        }}
        onPointerMove={(e) => {
          if (drag) {
            const p = norm(e.clientX, e.clientY)
            setDrag({ ...drag, cx: p.x, cy: p.y })
          }
        }}
        onPointerCancel={() => setDrag(null)}
        onClick={(e) => {
          if (tool === "text" && surface.current && e.target === e.currentTarget) {
            const p = norm(e.clientX, e.clientY)
            setDraft({ x: p.x, y: p.y, text: "" })
          }
        }}
      >
        {doc.kind === "pdf" && (
          <>
            <canvas ref={canvas} className="block" />
            <div ref={textLayer} className="textLayer absolute inset-0" style={{ pointerEvents: tool === "select" ? "auto" : "none" }} />
          </>
        )}
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/school/documents/${doc.id}/file`} alt={`Página ${original}`} className="block w-full select-none" draggable={false} onLoad={(e) => setHeight(e.currentTarget.clientHeight)} />
        )}
        {doc.kind === "docx" && (
          <div
            className="docx-page select-text px-8 py-6 text-[15px] leading-relaxed [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_table]:my-3 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_a]:text-blue-700 [&_a]:underline"
            style={{ pointerEvents: tool === "select" ? "auto" : "none" }}
            dangerouslySetInnerHTML={{ __html: doc.html?.[index] ?? "" }}
          />
        )}

        {/* Apuntes: subrayados, texto y marcadores discretos de nota */}
        <div className="pointer-events-none absolute inset-0">
          {annotations.map((a) =>
            a.kind === "text" ? (
              <button
                key={a.id}
                type="button"
                className="pointer-events-auto absolute max-w-[60%] rounded-sm px-1 text-left text-[13px] leading-tight font-medium whitespace-pre-wrap"
                style={{ left: `${a.rects[0].x * 100}%`, top: `${a.rects[0].y * 100}%`, color: a.color === "#facc15" ? "#a16207" : a.color, background: "rgb(255 255 255 / 0.55)" }}
                onClick={() => onOpen(openId === a.id ? null : a.id)}
              >
                {a.text}
              </button>
            ) : (
              a.rects.map((r, i) => (
                <button
                  key={`${a.id}-${i}`}
                  type="button"
                  aria-label={a.kind === "note" ? "Ver nota" : "Subrayado"}
                  className={cn("pointer-events-auto absolute", a.kind === "note" && "border-b border-dotted border-neutral-700")}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    background: a.kind === "highlight" || a.kind === "note" ? a.color : "transparent",
                    opacity: a.kind === "note" ? 0.22 : 0.4,
                    mixBlendMode: "multiply",
                  }}
                  onClick={() => onOpen(openId === a.id ? null : a.id)}
                />
              ))
            )
          )}
          {annotations
            .filter((a) => a.kind === "note")
            .map((a, i) => (
              <button
                key={`m-${a.id}`}
                type="button"
                aria-label={`Nota ${i + 1}`}
                onClick={() => onOpen(openId === a.id ? null : a.id)}
                className="pointer-events-auto absolute -right-0 grid size-5 place-items-center rounded-full bg-neutral-800 text-[10px] font-semibold text-white shadow"
                style={{ right: 4, top: `calc(${a.rects[0].y * 100}% - 2px)` }}
              >
                {i + 1}
              </button>
            ))}
          {drag && (
            <div
              className="absolute border border-dashed"
              style={{
                left: `${Math.min(drag.x, drag.cx) * 100}%`,
                top: `${Math.min(drag.y, drag.cy) * 100}%`,
                width: `${Math.abs(drag.cx - drag.x) * 100}%`,
                height: `${Math.abs(drag.cy - drag.y) * 100}%`,
                background: color,
                opacity: 0.35,
              }}
            />
          )}
          {draft && (
            <input
              autoFocus
              value={draft.text}
              maxLength={300}
              placeholder="Escribe aquí…"
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onBlur={() => {
                if (draft.text.trim()) onText({ x: draft.x, y: draft.y, w: Math.min(0.5, 1 - draft.x), h: 0.04 }, draft.text.trim())
                setDraft(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") setDraft(null)
              }}
              className="pointer-events-auto absolute rounded border bg-white/90 px-1 text-[13px] text-neutral-900"
              style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: 200 }}
            />
          )}
        </div>
      </div>

      {annotations.find((a) => a.id === openId) && (
        <AnnotationPopover a={annotations.find((x) => x.id === openId)!} onClose={() => onOpen(null)} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    </div>
  )
}

function AnnotationPopover({ a, onClose, onUpdate, onRemove }: { a: AnnotationDto; onClose: () => void; onUpdate: (a: AnnotationDto, p: Partial<AnnotationDto>) => Promise<void>; onRemove: (a: AnnotationDto) => Promise<void> }) {
  const [text, setText] = useState(a.text ?? "")
  const [saving, setSaving] = useState(false)
  return (
    <div className="mx-auto max-w-md space-y-2 rounded-2xl border bg-card p-3 text-sm shadow">
      {a.quote && <p className="line-clamp-3 text-xs text-muted-foreground">“{a.quote}”</p>}
      {a.kind !== "highlight" ? (
        <Textarea rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
      ) : (
        <p className="text-xs text-muted-foreground">Subrayado</p>
      )}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button key={c.value} type="button" aria-label={c.label} onClick={() => void onUpdate(a, { color: c.value })} className={cn("size-6 rounded-full border-2", a.color === c.value ? "border-foreground" : "border-transparent")} style={{ background: c.value }} />
        ))}
        <span className="ml-auto flex gap-1">
          {a.kind !== "highlight" && (
            <Button
              size="sm"
              disabled={saving || !text.trim() || text === a.text}
              onClick={async () => {
                setSaving(true)
                await onUpdate(a, { text: text.trim() })
                setSaving(false)
              }}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label="Borrar apunte" onClick={() => void onRemove(a)}>
            <Trash2 className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Cerrar" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </span>
      </div>
    </div>
  )
}

function NotesPanel({ notes, onOpen, onRemove, onUpdate }: { notes: AnnotationDto[]; onOpen: (a: AnnotationDto) => void; onRemove: (a: AnnotationDto) => Promise<void>; onUpdate: (a: AnnotationDto, p: Partial<AnnotationDto>) => Promise<void> }) {
  const list = useMemo(() => [...notes].sort((a, b) => a.page - b.page || a.rects[0].y - b.rects[0].y), [notes])
  const [editing, setEditing] = useState<string | null>(null)
  const [text, setText] = useState("")
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Mis apuntes</h2>
      <p className="text-xs text-muted-foreground">Solo tú los ves.</p>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Aún no tienes apuntes. Selecciona texto para subrayarlo o anotarlo.</p>}
      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id} className="space-y-1 rounded-xl border p-2 text-xs">
            <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => onOpen(a)}>
              <span className="size-3 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="text-muted-foreground">Pág. {a.page}</span>
              <span className="min-w-0 flex-1 truncate">{a.kind === "highlight" ? (a.quote ?? "Subrayado") : (a.text ?? "")}</span>
            </button>
            {a.kind !== "highlight" && a.quote && <p className="line-clamp-2 text-muted-foreground">“{a.quote}”</p>}
            {editing === a.id ? (
              <div className="space-y-1">
                <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!text.trim()}
                    onClick={async () => {
                      await onUpdate(a, { text: text.trim() })
                      setEditing(null)
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-1">
                {a.kind !== "highlight" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(a.id)
                      setText(a.text ?? "")
                    }}
                  >
                    Editar
                  </Button>
                )}
                <Button size="icon-sm" variant="ghost" aria-label="Borrar" onClick={() => void onRemove(a)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
