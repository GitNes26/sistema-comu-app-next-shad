"use client"

import { cn } from "@/lib/utils"

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

interface MapPreviewProps {
  lat: number
  lon: number
  className?: string
  height?: number
}

/**
 * MapPreview — Shows a static map preview of a location.
 *
 * - With Google Maps API key: Uses Maps Embed API (richer tiles, labels, roads)
 * - Without API key: Falls back to OpenStreetMap embed
 */
export function MapPreview({ lat, lon, className, height = 192 }: MapPreviewProps) {
  if (GOOGLE_MAPS_KEY) {
    return (
      <div className={cn("overflow-hidden rounded-xl border", className)}>
        <iframe
          title="Mapa"
          className="block w-full"
          style={{ height }}
          loading="lazy"
          referrerPolicy="no-referrer"
          src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${lat},${lon}&zoom=16&maptype=roadmap`}
          allowFullScreen
        />
      </div>
    )
  }

  // Fallback: OpenStreetMap
  const bbox = `${lon - 0.003},${lat - 0.003},${lon + 0.003},${lat + 0.003}`
  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <iframe
        title="Mapa"
        className="block w-full"
        style={{ height }}
        loading="lazy"
        referrerPolicy="no-referrer"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`}
      />
    </div>
  )
}
