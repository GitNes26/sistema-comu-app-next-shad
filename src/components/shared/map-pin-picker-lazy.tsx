"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamic import — Leaflet requires the browser DOM
const MapPinPicker = dynamic(
  () => import("./map-pin-picker").then((mod) => mod.MapPinPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl border bg-muted/30" style={{ height: 300 }}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

export { MapPinPicker }
export type { MapPinPickerProps } from "./map-pin-picker"
