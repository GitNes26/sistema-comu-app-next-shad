"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, ImageUp, Loader2, Move, Printer, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { DiplomaConfigDto } from "@/lib/school/growth"

// Configuración del diploma: diseño del sistema, o la imagen/PDF de la escuela sobre la
// que el sistema escribe el nombre del alumno en cursiva legible. El nombre se coloca
// tocando (o arrastrando) sobre la plantilla.

const SAMPLE_NAME = "María Fernanda Gómez Ruiz"
const COLORS = ["#1f2937", "#000000", "#7c2d12", "#78350f", "#1e3a8a", "#14532d", "#ffffff"]

export function DiplomaDesigner({ schoolId, open, onClose }: { schoolId: string | null; open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<DiplomaConfigDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [version, setVersion] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    try {
      const r = await apiJson<{ config: DiplomaConfigDto }>(`/api/school/programs/${schoolId}/diploma`)
      setCfg(r.config)
    } catch (e) {
      swalError("No se pudo cargar", errorMessage(e))
      onClose()
    }
  }, [schoolId, onClose])

  useEffect(() => {
    if (open) {
      setCfg(null)
      void load()
    }
  }, [open, load])

  const patch = (p: Partial<DiplomaConfigDto>) => setCfg((c) => (c ? { ...c, ...p } : c))

  const upload = async (file: File) => {
    if (!schoolId) return
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      const res = await fetch(`/api/school/programs/${schoolId}/diploma`, { method: "POST", body: form, credentials: "same-origin" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "No se pudo subir el archivo")
      notify.success("Plantilla subida")
      setVersion((v) => v + 1)
      await load()
    } catch (e) {
      swalError("No se pudo subir", errorMessage(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const save = async (): Promise<boolean> => {
    if (!schoolId || !cfg) return false
    setSaving(true)
    try {
      await apiJson(`/api/school/programs/${schoolId}/diploma`, {
        method: "PUT",
        body: JSON.stringify({
          mode: cfg.mode,
          nameX: cfg.nameX,
          nameY: cfg.nameY,
          nameSize: cfg.nameSize,
          nameColor: cfg.nameColor,
          showSerial: cfg.showSerial,
        }),
      })
      return true
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveAndClose = async () => {
    if (await save()) {
      notify.success("Diploma guardado")
      onClose()
    }
  }
  const preview = async () => {
    if (await save()) window.open(`/api/school/programs/${schoolId}/diploma/sample?v=${Date.now()}`, "_blank", "noopener")
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="4xl"
      title="Diploma de la escuela"
      description="Se entrega al finalizar el Lanzamiento a quien completó todos los libros."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => void preview()} disabled={saving || !cfg}>
            <Printer className="size-4" />
            Ver ejemplo en PDF
          </Button>
          <Button onClick={() => void saveAndClose()} disabled={saving || !cfg}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      {!cfg ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Origen del diploma">
            <ModeCard
              active={cfg.mode === "generated"}
              icon={Sparkles}
              title="Diseño del sistema"
              text="Un diploma elegante con el nombre en cursiva, dirección y folio."
              onClick={() => patch({ mode: "generated" })}
            />
            <ModeCard
              active={cfg.mode === "uploaded"}
              icon={ImageUp}
              title="Mi propio diploma"
              text="Sube la imagen o el PDF; el sistema escribe el nombre del alumno."
              onClick={() => patch({ mode: "uploaded" })}
            />
          </div>

          {cfg.mode === "uploaded" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
                <FileText className="size-5 text-muted-foreground" />
                <p className="min-w-0 flex-1 text-sm">
                  {cfg.hasTemplate ? (cfg.templateKind === "pdf" ? "Plantilla en PDF cargada" : "Plantilla en imagen cargada") : "Aún no subes tu diploma"}
                  <span className="block text-xs text-muted-foreground">PNG, JPG, WEBP o PDF, hasta 8 MB. Deja libre el espacio del nombre.</span>
                </p>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
                  {cfg.hasTemplate ? "Cambiar" : "Subir archivo"}
                </Button>
              </div>

              {cfg.hasTemplate && (
                <>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Move className="size-4" />
                    Toca o arrastra sobre el diploma para colocar el nombre.
                  </p>
                  <Stage schoolId={schoolId!} cfg={cfg} version={version} onPlace={(x, y) => patch({ nameX: x, nameY: y })} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tamaño del nombre</Label>
                      <Slider min={0.02} max={0.12} step={0.002} value={[cfg.nameSize]} onValueChange={([v]) => patch({ nameSize: v })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Color ${c}`}
                            aria-pressed={cfg.nameColor === c}
                            onClick={() => patch({ nameColor: c })}
                            className="size-8 rounded-full ring-1 ring-border aria-pressed:ring-2 aria-pressed:ring-primary"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <Switch checked={cfg.showSerial} onCheckedChange={(v) => patch({ showSerial: v })} />
                    Mostrar el folio al pie del diploma
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </DialogComponent>
  )
}

function ModeCard({ active, icon: Icon, title, text, onClick }: { active: boolean; icon: typeof Sparkles; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border bg-card p-3 text-left ring-primary/0 transition-shadow aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-primary/30"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  )
}

/** Plantilla con el nombre de ejemplo encima, en la tipografía real del diploma. */
function Stage({ schoolId, cfg, version, onPlace }: { schoolId: string; cfg: DiplomaConfigDto; version: number; onPlace: (x: number, y: number) => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ratio, setRatio] = useState(792 / 612)
  const [ready, setReady] = useState(false)
  const dragging = useRef(false)
  const src = `/api/school/programs/${schoolId}/diploma/template?v=${version}`

  // PDF: se pinta la primera página en un canvas.
  useEffect(() => {
    if (cfg.templateKind !== "pdf") return
    let alive = true
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | null = null
    setReady(false)
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
        task = pdfjs.getDocument({ url: src, withCredentials: true })
        const doc = await task.promise
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const vp = page.getViewport({ scale: 1100 / base.width })
        const canvas = canvasRef.current
        if (!alive || !canvas) return
        canvas.width = vp.width
        canvas.height = vp.height
        setRatio(vp.width / vp.height)
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise
        if (alive) setReady(true)
      } catch {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
      void task?.destroy()
    }
  }, [cfg.templateKind, src])

  const place = (e: React.PointerEvent) => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    onPlace(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000)
  }

  return (
    <div className="space-y-2">
      <style>{`@font-face{font-family:"Dancing Script";font-weight:600;font-display:swap;src:url(/fonts/diploma/dancing-script-600.woff2) format("woff2"),url(/fonts/diploma/dancing-script-600.woff) format("woff")}`}</style>
      <div
        ref={stageRef}
        className="relative mx-auto w-full max-w-3xl cursor-crosshair touch-none overflow-hidden rounded-xl bg-muted ring-1 ring-border select-none"
        style={{ aspectRatio: ratio, containerType: "inline-size" }}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          place(e)
        }}
        onPointerMove={(e) => dragging.current && place(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {cfg.templateKind === "pdf" ? (
          <>
            <canvas ref={canvasRef} className="absolute inset-0 size-full" />
            {!ready && <Skeleton className="absolute inset-0" />}
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Plantilla del diploma"
            draggable={false}
            className="absolute inset-0 size-full object-fill"
            onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          />
        )}
        <span
          className="pointer-events-none absolute whitespace-nowrap"
          style={{
            left: `${cfg.nameX * 100}%`,
            top: `${cfg.nameY * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: '"Dancing Script", cursive',
            fontWeight: 600,
            fontSize: `${cfg.nameSize * 100}cqw`,
            lineHeight: 1,
            color: cfg.nameColor,
            outline: "1px dashed rgba(59,130,246,.8)",
            outlineOffset: "0.2em",
          }}
        >
          {SAMPLE_NAME}
        </span>
      </div>
    </div>
  )
}
