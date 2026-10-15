"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

/** Dato bancario con botón para copiarlo (CLABE, cuenta…). */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      window.setTimeout(() => setDone(false), 1800)
    } catch {
      /* sin portapapeles */
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
      </div>
      <button type="button" onClick={() => void copy()} aria-label={`Copiar ${label}`} className="press grid size-9 place-items-center rounded-lg hover:bg-muted">
        {done ? <Check className="size-4 text-success-ink" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}
