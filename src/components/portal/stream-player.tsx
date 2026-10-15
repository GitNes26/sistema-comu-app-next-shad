"use client"

import { ExternalLink } from "lucide-react"
import type { StreamDto } from "@/lib/portal/server"

// Reproductor incrustado de YouTube o Facebook. Solo se carga el origen que el
// servidor validó (`embedUrl`); si no hay, se ofrece abrir el enlace original.
export function StreamPlayer({ stream }: { stream: StreamDto }) {
  if (!stream.embedUrl) {
    return (
      <a
        href={stream.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex aspect-video items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-medium hover:underline"
      >
        Abrir transmisión <ExternalLink className="size-4" />
      </a>
    )
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-border">
      <iframe
        key={stream.id}
        src={stream.embedUrl}
        title={stream.title}
        className="absolute inset-0 size-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
