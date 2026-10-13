"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Ban, Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { DiplomaDto } from "@/lib/school/growth"

// Diploma: la primera página del PDF que genera el servidor (diseño del sistema o la
// plantilla de la escuela con el nombre del alumno), con descarga e impresión.
export function DiplomaView({ diplomaId, backHref }: { diplomaId: string; backHref: string }) {
  const [d, setD] = useState<DiplomaDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState(false)
  const [ratio, setRatio] = useState(792 / 612)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfUrl = `/api/school/diplomas/${diplomaId}/pdf`

  useEffect(() => {
    apiJson<{ diploma: DiplomaDto }>(`/api/school/diplomas/${diplomaId}`)
      .then((r) => setD(r.diploma))
      .catch((e) => setError(errorMessage(e, "No se pudo abrir el diploma")))
  }, [diplomaId])

  useEffect(() => {
    if (!d) return
    let alive = true
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | null = null
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
        task = pdfjs.getDocument({ url: pdfUrl, withCredentials: true })
        const doc = await task.promise
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const vp = page.getViewport({ scale: (1100 / base.width) * dpr })
        const canvas = canvasRef.current
        if (!alive || !canvas) return
        canvas.width = vp.width
        canvas.height = vp.height
        setRatio(vp.width / vp.height)
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise
        if (alive) setRendered(true)
      } catch (e) {
        if (alive) setError(errorMessage(e, "No se pudo mostrar el diploma"))
      }
    })()
    return () => {
      alive = false
      void task?.destroy()
    }
  }, [d, pdfUrl])

  if (error) return <EmptyState icon={Ban} title="No se pudo abrir el diploma" description={error} />
  if (!d) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline">
            <a href={`${pdfUrl}?download=1`}>
              <Download className="size-4" />
              Descargar PDF
            </a>
          </Button>
          <Button asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Printer className="size-4" />
              Imprimir
            </a>
          </Button>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl bg-muted ring-1 ring-border" style={{ aspectRatio: ratio }}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label={`Diploma de ${d.memberName}`} role="img" />
        {!rendered && <Skeleton className="absolute inset-0" />}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Folio {d.serial} · {d.schoolName}
      </p>
    </div>
  )
}
