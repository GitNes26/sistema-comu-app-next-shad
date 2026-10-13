"use client"

import { useState, useCallback, useEffect } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import type { LatLngTuple } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Crosshair, MapPin, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Fix Leaflet default icon path for bundlers
import L from "leaflet"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

export interface MapPinPickerProps {
  /** Current latitude */
  lat?: number | null
  /** Current longitude */
  lon?: number | null
  /** Called when user picks a location */
  onChange: (lat: number, lon: number) => void
  /** Called when user wants to close the picker */
  onClose?: () => void
  /** Initial center if no lat/lon */
  defaultCenter?: LatLngTuple
  /** Map height */
  height?: number
  /** Additional CSS class */
  className?: string
}

/** Draggable marker that updates position on drag */
function DraggableMarker({
  position,
  onDrop,
}: {
  position: LatLngTuple
  onDrop: (lat: number, lng: number) => void
}) {
  const [draggable, setDraggable] = useState(true)
  const [pos, setPos] = useState<LatLngTuple>(position)

  const eventHandlers = {
    dragend() {
      const marker = this as unknown as L.Marker
      const latlng = marker.getLatLng()
      setPos([latlng.lat, latlng.lng])
      onDrop(latlng.lat, latlng.lng)
    },
  }

  // Sync position when parent changes (e.g., "detect my location")
  useEffect(() => {
    setPos(position)
  }, [position[0], position[1]])

  return (
    <Marker
      position={pos}
      draggable={draggable}
      eventHandlers={eventHandlers}
    />
  )
}

/** Component that handles map click events */
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Component that flies to a location */
function FlyToLocation({ center }: { center: LatLngTuple }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, 16, { duration: 1 })
  }, [center[0], center[1]])
  return null
}

export function MapPinPicker({
  lat,
  lon,
  onChange,
  onClose,
  defaultCenter = [19.4326, -99.1332], // CDMX default
  height = 300,
  className,
}: MapPinPickerProps) {
  const center: LatLngTuple = lat != null && lon != null ? [lat, lon] : defaultCenter
  const [position, setPosition] = useState<LatLngTuple>(center)

  useEffect(() => {
    if (lat != null && lon != null) {
      setPosition([lat, lon])
    }
  }, [lat, lon])

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setPosition([lat, lng])
      onChange(lat, lng)
    },
    [onChange]
  )

  const handleMarkerDrop = useCallback(
    (lat: number, lng: number) => {
      setPosition([lat, lng])
      onChange(lat, lng)
    },
    [onChange]
  )

  const handleDetectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter: LatLngTuple = [pos.coords.latitude, pos.coords.longitude]
        setPosition(newCenter)
        onChange(pos.coords.latitude, pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [onChange])

  return (
    <div className={cn("relative overflow-hidden rounded-xl border", className)}>
      {/* Toolbar */}
      <div className="absolute left-2 top-2 z-[1000] flex gap-1.5">
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          className="size-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
          onClick={handleDetectLocation}
          title="Mi ubicación"
        >
          <Crosshair className="size-3.5" />
        </Button>
        {onClose && (
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="size-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
            onClick={onClose}
            title="Cerrar mapa"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Coordinates badge */}
      {lat != null && lon != null && (
        <div className="absolute bottom-2 left-2 z-[1000] rounded-lg bg-background/90 px-2 py-1 text-xs font-mono shadow-md backdrop-blur-sm">
          <MapPin className="mr-1 inline size-3" />
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={center}
        zoom={lat != null ? 16 : 12}
        style={{ height, width: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onClick={handleMapClick} />
        {lat != null && lon != null && (
          <>
            <FlyToLocation center={center} />
            <DraggableMarker position={center} onDrop={handleMarkerDrop} />
          </>
        )}
      </MapContainer>

      {/* Instruction */}
      <div className="absolute bottom-2 right-2 z-[1000] rounded-lg bg-background/90 px-2 py-1 text-xs shadow-md backdrop-blur-sm">
        Toca para colocar un pin
      </div>
    </div>
  )
}
