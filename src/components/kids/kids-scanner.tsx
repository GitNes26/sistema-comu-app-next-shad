"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Camera, Check, Loader2, LogIn, LogOut, QrCode, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DialogComponent } from "@/components/ui/dialog"
import { StatusPill } from "@/components/base/status-pill"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { parseQrPayload } from "@/lib/kids/rules"
import type { LookupDto } from "@/lib/kids/server"
import { cn } from "@/lib/utils"

// Entrada y salida por QR. El escáner solo identifica al niño; la salida exige que
// QUIEN opera tenga el permiso de autorizarla (el servidor lo vuelve a comprobar).

export function KidsScannerDialog({
  sessionId,
  open,
  canAuthorizeExit,
  rooms,
  onClose,
  onDone,
  preset,
}: {
  sessionId: string
  open: boolean
  canAuthorizeExit: boolean
  rooms: { id: string; name: string }[]
  onClose: () => void
  onDone: () => Promise<void>
  /** Si ya se sabe a quién (p. ej. «Salida» desde la lista), se salta el escaneo. */
  preset?: { childId: string } | null
}) {
  const reader = useId().replace(/:/g, "")
  const [lookup, setLookup] = useState<LookupDto | null>(null)
  const [manual, setManual] = useState("")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [pickedUpBy, setPickedUpBy] = useState("")
  const [note, setNote] = useState("")
  const handled = useRef(false)

  const identify = useCallback(
    async (input: { token?: string; childId?: string }) => {
      setBusy(true)
      try {
        const d = await apiJson<{ lookup: LookupDto }>(`/api/kids/sessions/${sessionId}/lookup`, { method: "POST", body: JSON.stringify(input) })
        setLookup(d.lookup)
        setChecklist({})
        setPickedUpBy("")
        setNote("")
      } catch (err) {
        handled.current = false
        swalError("No se pudo identificar", errorMessage(err))
      } finally {
        setBusy(false)
      }
    },
    [sessionId]
  )

  // Al abrir: limpia y, si ya se sabe a quién, lo identifica.
  useEffect(() => {
    if (!open) return
    handled.current = false
    setLookup(null)
    setManual("")
    setCameraError(null)
    if (preset) void identify({ childId: preset.childId })
  }, [open, preset, identify])

  // Cámara: solo mientras se espera una lectura.
  useEffect(() => {
    if (!open || lookup || preset) return
    let stopped = false
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null
    ;(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        // El contenedor existe cuando el diálogo ya montó.
        await new Promise((r) => setTimeout(r, 150))
        if (stopped || !document.getElementById(reader)) return
        const s = new Html5Qrcode(reader)
        scanner = s
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            const token = parseQrPayload(text)
            if (!token || handled.current) return
            handled.current = true
            void identify({ token })
          },
          () => {}
        )
      } catch {
        if (!stopped) setCameraError("No se pudo usar la cámara. Escribe el código o busca al niño en la lista.")
      }
    })()
    return () => {
      stopped = true
      const s = scanner
      scanner = null
      if (s) void s.stop().then(() => s.clear()).catch(() => {})
    }
  }, [open, lookup, preset, reader, identify])

  const act = async (kind: "check-in" | "check-out") => {
    if (!lookup) return
    setBusy(true)
    try {
      const body =
        kind === "check-in"
          ? { childId: lookup.child.id, roomId: lookup.roomId, checklist, note }
          : { childId: lookup.child.id, pickedUpBy }
      await apiJson(`/api/kids/sessions/${sessionId}/${kind}`, { method: "POST", body: JSON.stringify(body) })
      notify.success(kind === "check-in" ? `${lookup.child.fullName} ya está dentro` : `${lookup.child.fullName} salió`)
      await onDone()
      if (preset) onClose()
      else {
        handled.current = false
        setLookup(null)
      }
    } catch (err) {
      swalError(kind === "check-in" ? "No se pudo dar entrada" : "No se pudo registrar la salida", errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const room = rooms.find((r) => r.id === lookup?.roomId)

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={preset ? "Salida de Kids" : "Entrada y salida con QR"}
      description={preset ? undefined : "Apunta la cámara al QR que muestra el papá."}
      className="max-w-[90vw]"
    >
      {!lookup ? (
        <div className="space-y-4">
          {!preset && (
            <>
              <div className="overflow-hidden rounded-2xl border bg-muted/40">
                <div id={reader} className="min-h-56 w-full" />
              </div>
              {cameraError && (
                <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning-ink">
                  <Camera className="mt-0.5 size-4 shrink-0" />
                  {cameraError}
                </p>
              )}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const token = parseQrPayload(manual)
                  if (!token) {
                    swalError("Código no válido", "Revisa que esté completo.")
                    return
                  }
                  void identify({ token })
                }}
              >
                <div className="flex-1 space-y-1.5">
                  <label htmlFor={`${reader}-m`} className="text-sm font-medium">
                    ¿Sin cámara? Escribe el código
                  </label>
                  <Input id={`${reader}-m`} value={manual} onChange={(e) => setManual(e.target.value)} autoComplete="off" placeholder="Código del QR" />
                </div>
                <Button type="submit" disabled={busy || !manual.trim()}>
                  <QrCode className="size-4" />
                  Buscar
                </Button>
              </form>
            </>
          )}
          {busy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Identificando…
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">
              {lookup.child.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lookup.child.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <QrCode className="size-6 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-lg font-semibold">{lookup.child.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {lookup.child.ageLabel}
                {room ? ` · ${room.name}` : ""}
              </p>
              <div className="mt-1.5">
                <StatusPill tone={lookup.state === "in" ? "success" : lookup.state === "out" ? "neutral" : "info"}>
                  {lookup.state === "in" ? "Dentro del servicio" : lookup.state === "out" ? "Ya salió" : "Aún sin entrada"}
                </StatusPill>
              </div>
            </div>
          </div>

          {lookup.child.indications && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" />
              <span className="whitespace-pre-line">{lookup.child.indications}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Tutores: {lookup.child.guardians.map((g) => `${g.fullName} (${g.relation})`).join(", ") || "—"}
          </p>

          {lookup.state === "none" && (
            <div className="space-y-3">
              {lookup.child.section === "baby" && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">¿Qué trae el bebé?</legend>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {lookup.checklistItems.map((item) => (
                      <label key={item} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm", checklist[item] && "border-primary bg-primary/5")}>
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={checklist[item] ?? false}
                          onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Nota de entrada (opcional)" aria-label="Nota de entrada" />
              <Button className="w-full" size="lg" disabled={busy || !lookup.roomId} onClick={() => void act("check-in")}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                Dar entrada{room ? ` a ${room.name}` : ""}
              </Button>
              {!lookup.roomId && <p className="text-xs text-destructive">No hay un salón para su edad. Fíjale uno en su ficha.</p>}
            </div>
          )}

          {lookup.state === "in" && (
            <div className="space-y-3">
              {canAuthorizeExit ? (
                <>
                  <Input value={pickedUpBy} onChange={(e) => setPickedUpBy(e.target.value)} maxLength={80} placeholder="¿Quién lo recoge? (nombre)" aria-label="Quién recoge" />
                  <Button className="w-full" size="lg" disabled={busy} onClick={() => void act("check-out")}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                    Autorizar salida
                  </Button>
                </>
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  La salida debe autorizarla personal con el permiso correspondiente. Avísale a la dirección de Kids.
                </p>
              )}
            </div>
          )}

          {lookup.state === "out" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4" /> Su salida ya fue registrada en este servicio.
            </p>
          )}

          {!preset && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                handled.current = false
                setLookup(null)
              }}
            >
              Escanear otro
            </Button>
          )}
        </div>
      )}
    </DialogComponent>
  )
}
