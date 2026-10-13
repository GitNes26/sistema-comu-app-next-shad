"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { ArrowLeft, Check, Loader2, LocateFixed, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OverlayBackGuard } from "@/hooks/use-overlay-back"
import { useLocation, type LocationResult } from "@/hooks/use-location"
import { useAddressSuggestions } from "@/components/shared/use-address-suggestions"

export interface PickedAddress {
  lat: number
  lon: number
  address: string
  parts: LocationResult["parts"]
}

const DEFAULT_CENTER: [number, number] = [25.5428, -103.4068]

/** Pasa al padre el centro del mapa cuando termina de moverse (el pin va fijo al centro). */
function CenterWatcher({ onCenter }: { onCenter: (lat: number, lon: number) => void }) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter()
      onCenter(c.lat, c.lng)
    },
  })
  return null
}

function MapController({ target }: { target: { lat: number; lon: number; zoom?: number; nonce: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], target.zoom ?? 17, { duration: 0.7 })
  }, [map, target])
  return null
}

/**
 * Selector de ubicación a pantalla completa (estilo apps de reparto): el pin
 * queda fijo al centro y se mueve el mapa; arriba hay un buscador con
 * autocompletado y un botón que lleva a tu ubicación. Abajo se ve la dirección
 * resultante y el botón de confirmar.
 */
export function AddressMapPicker({
  open,
  initial,
  fallbackCenter,
  onClose,
  onConfirm,
  onPermissionError,
}: {
  open: boolean
  initial: { lat: number; lon: number } | null
  /** Centro cuando aún no hay dirección (p. ej. la sede más cercana). */
  fallbackCenter?: { lat: number; lon: number } | null
  onClose: () => void
  onConfirm: (value: PickedAddress) => void
  onPermissionError?: () => void
}) {
  const { detectMyLocation, reverseGeocode, warmLocation, error } = useLocation()
  const [mounted, setMounted] = useState(false)
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(initial)
  const [resolved, setResolved] = useState<LocationResult | null>(null)
  const [resolving, setResolving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [target, setTarget] = useState<{ lat: number; lon: number; zoom?: number; nonce: number } | null>(null)
  const [query, setQuery] = useState("")
  const { suggestions, searching, clear, pick } = useAddressSuggestions(query, open, center)
  const seq = useRef(0)

  useEffect(() => setMounted(true), [])
  // Sin dirección previa: si ya hay permiso, abre el mapa en tu ubicación (no en otra ciudad).
  useEffect(() => {
    if (!open || initial) return
    let alive = true
    void warmLocation().then((p) => {
      if (alive && p) setTarget({ lat: p.lat, lon: p.lon, nonce: Date.now() })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (!open) return
    setCenter(initial)
    setResolved(null)
    setQuery("")
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Dirección del punto donde quedó el pin.
  const resolve = useCallback(
    async (lat: number, lon: number) => {
      const id = ++seq.current
      setResolving(true)
      const result = await reverseGeocode(lat, lon)
      if (id !== seq.current) return
      setResolved(result ?? { coords: { lat, lon }, address: "", parts: {} })
      setResolving(false)
    },
    [reverseGeocode]
  )

  useEffect(() => {
    if (!open || !center) return
    const t = window.setTimeout(() => void resolve(center.lat, center.lon), 350)
    return () => window.clearTimeout(t)
  }, [open, center, resolve])

  const locate = async () => {
    setLocating(true)
    const res = await detectMyLocation()
    setLocating(false)
    if (res) setTarget({ lat: res.coords.lat, lon: res.coords.lon, nonce: Date.now() })
    else onPermissionError?.()
  }

  const choose = async (index: number) => {
    const res = await pick(index)
    if (!res) return
    clear()
    setQuery("")
    setTarget({ lat: res.lat, lon: res.lon, nonce: Date.now() })
  }

  if (!open || !mounted) return null
  const start = initial ?? fallbackCenter ?? { lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1] }

  // Es un diálogo de Radix propio: así funciona también cuando se abre desde otro diálogo
  // (que de lo contrario bloquea el puntero y el foco fuera de él: mapa trabado, buscador
  // sin respuesta y cierre al tocar).
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
    <DialogPrimitive.Portal>
    <DialogPrimitive.Content
      data-slot="dialog-content"
      aria-describedby={undefined}
      onInteractOutside={(e) => e.preventDefault()}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="fixed inset-0 z-[100] isolate flex flex-col bg-background outline-none"
    >
      <OverlayBackGuard />
      <DialogPrimitive.Title className="sr-only">Elegir ubicación de entrega</DialogPrimitive.Title>
      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={[start.lat, start.lon]}
          zoom={initial ? 17 : 14}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CenterWatcher onCenter={(lat, lon) => setCenter({ lat, lon })} />
          <MapController target={target} />
        </MapContainer>

        {/* Pin fijo al centro: la punta queda en el centro del mapa */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full">
          <MapPin className="size-11 fill-primary text-primary-foreground drop-shadow-lg" strokeWidth={1.5} />
        </div>

        {/* Buscador */}
        <div className="absolute inset-x-0 top-0 z-[1000] p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Volver"
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-background shadow-lg active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar calle, colonia o negocio…"
                aria-label="Buscar dirección"
                className="h-12 w-full rounded-2xl border-0 bg-background pr-10 pl-10 text-base shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {searching && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </div>
          {suggestions.length > 0 && (
            <ul className="mt-2 max-h-[40dvh] overflow-y-auto rounded-2xl bg-background p-1 shadow-xl" role="listbox">
              {suggestions.map((s, i) => (
                <li key={`${s.description}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => void choose(i)}
                    className="flex min-h-12 w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2">{s.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mi ubicación */}
        <button
          type="button"
          onClick={() => void locate()}
          aria-label="Ir a mi ubicación"
          className="absolute right-3 bottom-4 z-[1000] grid size-12 place-items-center rounded-2xl bg-background shadow-lg active:scale-95"
        >
          {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5 text-primary" />}
        </button>
      </div>

      {/* Dirección y confirmación */}
      <div className="space-y-3 border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="min-h-12">
          <p className="text-xs font-medium text-muted-foreground">Entregaremos en</p>
          {resolving || !resolved ? (
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando dirección…
            </p>
          ) : (
            <p className="mt-0.5 text-base font-semibold leading-snug">{resolved.address || "Punto seleccionado en el mapa"}</p>
          )}
          {error && !resolved && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Button
          type="button"
          className="h-14 w-full rounded-2xl text-base font-semibold"
          disabled={!center || resolving || !resolved}
          onClick={() => {
            if (!center || !resolved) return
            onConfirm({ lat: center.lat, lon: center.lon, address: resolved.address, parts: resolved.parts })
          }}
        >
          <Check className="size-5" /> Confirmar ubicación
        </Button>
      </div>
    </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
