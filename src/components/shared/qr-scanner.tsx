"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Camera, CameraOff, KeyRound, Lock, RotateCcw, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Lector de QR con la cámara (html5-qrcode), robusto para diálogos animados:
// • espera a que el contenedor exista (los diálogos se montan en un portal);
// • evita arrancar dos veces sobre el mismo elemento (Strict Mode);
// • explica por qué no abre la cámara: permiso negado, sin cámara, cámara
//   ocupada o conexión no segura (la cámara exige HTTPS o localhost).

type ScanState = "starting" | "scanning" | "insecure" | "denied" | "nocamera" | "busy" | "error"

const MESSAGES: Record<Exclude<ScanState, "starting" | "scanning">, { title: string; text: string }> = {
  insecure: {
    title: "La cámara necesita una conexión segura",
    text: "El navegador solo permite la cámara en sitios HTTPS (o localhost). Abre el sistema con su dirección https o usa el PIN.",
  },
  denied: {
    title: "Permiso de cámara bloqueado",
    text: "Permite la cámara en el candado de la barra de direcciones del navegador y vuelve a intentar.",
  },
  nocamera: { title: "No se encontró una cámara", text: "Este dispositivo no tiene cámara disponible." },
  busy: { title: "La cámara está en uso", text: "Cierra otras apps o pestañas que la estén usando y reintenta." },
  error: { title: "No se pudo abrir la cámara", text: "Reintenta o confirma con el PIN." },
}

function classify(err: unknown): ScanState {
  const text = `${(err as { name?: string })?.name ?? ""} ${(err as { message?: string })?.message ?? ""} ${String(err)}`
  if (/NotAllowed|Permission|denied/i.test(text)) return "denied"
  if (/NotFound|Requested device not found|DevicesNotFound|OverconstrainedError/i.test(text)) return "nocamera"
  if (/NotReadable|Could not start|TrackStart|in use/i.test(text)) return "busy"
  return "error"
}

interface Html5QrcodeLike {
  start: (...args: unknown[]) => Promise<unknown>
  stop: () => Promise<void>
  clear: () => void
  isScanning?: boolean
}

export function QrScanner({
  active,
  onResult,
  onUsePin,
  className,
}: {
  active: boolean
  /** Se llama una sola vez por lectura; el lector se detiene al leer. */
  onResult: (text: string) => void
  onUsePin?: () => void
  className?: string
}) {
  const rawId = useId()
  const boxId = `qr-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`
  const [state, setState] = useState<ScanState>("starting")
  const [attempt, setAttempt] = useState(0)
  const scannerRef = useRef<Html5QrcodeLike | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let handled = false

    const stop = async () => {
      const s = scannerRef.current
      scannerRef.current = null
      if (!s) return
      try {
        if (s.isScanning !== false) await s.stop()
      } catch {
        /* ya detenido */
      }
      try {
        s.clear()
      } catch {
        /* ignore */
      }
    }

    const run = async () => {
      setState("starting")
      if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState("insecure")
        return
      }
      // Esperar a que el contenedor esté en el DOM (hasta ~2 s).
      let el: HTMLElement | null = null
      for (let i = 0; i < 40 && !cancelled; i++) {
        el = document.getElementById(boxId)
        if (el && el.clientWidth > 0) break
        await new Promise((r) => setTimeout(r, 50))
      }
      if (cancelled) return
      if (!el) {
        setState("error")
        return
      }
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        if (cancelled) return
        const scanner = new Html5Qrcode(boxId, { verbose: false }) as unknown as Html5QrcodeLike
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s } }, aspectRatio: 1 },
          (decoded: string) => {
            if (handled) return
            handled = true
            void stop().then(() => onResultRef.current(decoded))
          },
          () => {
            /* frames sin QR: normal */
          }
        )
        if (cancelled) {
          await stop()
          return
        }
        setState("scanning")
      } catch (err) {
        await stop()
        if (!cancelled) setState(classify(err))
      }
    }

    void run()
    return () => {
      cancelled = true
      void stop()
    }
  }, [active, attempt, boxId])

  const failed = state !== "starting" && state !== "scanning"

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <div id={boxId} className="absolute inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
        {state === "scanning" && (
          <div aria-hidden className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80">
            <div className="absolute inset-x-3 h-0.5 animate-[scanline_2s_ease-in-out_infinite] rounded bg-primary shadow-[0_0_12px_var(--primary)]" />
          </div>
        )}
        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Camera className="size-8 animate-pulse" />
            <span className="text-sm">Abriendo cámara…</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-5 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-background text-muted-foreground">
              {state === "insecure" ? <Lock className="size-6" /> : <CameraOff className="size-6" />}
            </span>
            <div>
              <p className="font-semibold">{MESSAGES[state].title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{MESSAGES[state].text}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {state !== "insecure" && state !== "nocamera" && (
                <Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                  <RotateCcw className="size-4" /> Reintentar
                </Button>
              )}
              {onUsePin && (
                <Button size="sm" onClick={onUsePin}>
                  <KeyRound className="size-4" /> Usar PIN
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      {state === "scanning" && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <ScanLine className="size-4" /> Apunta al QR del cliente
        </p>
      )}
    </div>
  )
}
