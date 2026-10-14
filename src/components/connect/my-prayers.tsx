"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, HandHeart, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FormCombobox, StatusPill, TextareaField } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError, swalPrompt } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { PRAYER_STATUS, PRAYER_VISIBILITY, type PrayerVisibility } from "@/lib/connect/rules"
import type { PrayerDto } from "@/lib/connect/server"

const TONE = { open: "warning", praying: "info", answered: "success" } as const

export function MyPrayers() {
  const [items, setItems] = useState<PrayerDto[] | null>(null)
  const [body, setBody] = useState("")
  const [visibility, setVisibility] = useState<PrayerVisibility>("team")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems((await apiJson<{ prayers: PrayerDto[] }>("/api/prayer")).prayers)
    } catch (e) {
      swalError("No se pudieron cargar tus peticiones", errorMessage(e))
      setItems([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const send = async () => {
    setSending(true)
    try {
      await apiJson("/api/prayer", { method: "POST", body: JSON.stringify({ body, visibility }) })
      setBody("")
      notify.success("Tu petición llegó. Estamos orando por ti.")
      await load()
    } catch (e) {
      swalError("No se pudo enviar", errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  const answered = async (p: PrayerDto) => {
    const note = await swalPrompt("¡Gloria a Dios!", "Cuéntanos cómo respondió (opcional)")
    if (note === null) return
    try {
      await apiJson("/api/prayer", { method: "PATCH", body: JSON.stringify({ id: p.id, note }) })
      await load()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    }
  }

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
          <HandHeart className="size-6 text-primary" /> Oración
        </h1>
        <p className="text-sm text-muted-foreground">Cuéntanos tu necesidad: nuestra familia ora contigo.</p>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <TextareaField label="¿Por qué quieres que oremos?" rows={4} maxLength={1500} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-end gap-3">
          <FormCombobox
            label="¿Quién la ve?"
            className="min-w-56 flex-1"
            options={Object.entries(PRAYER_VISIBILITY).map(([value, label]) => ({ value, label }))}
            value={visibility}
            onChange={(v) => setVisibility(v as PrayerVisibility)}
            clearable={false}
            searchable={false}
          />
          <Button onClick={() => void send()} disabled={sending || body.trim().length < 3}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar petición
          </Button>
        </div>
      </div>

      {items === null ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={HandHeart} title="Aún no has enviado peticiones" description="Aquí verás cómo va la oración por tus necesidades." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <li key={p.id} className="space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <time className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</time>
                <StatusPill tone={TONE[p.status]}>{PRAYER_STATUS[p.status]}</StatusPill>
              </div>
              <p className="text-sm whitespace-pre-line">{p.body}</p>
              {p.answeredNote && <p className="rounded-lg bg-success/10 p-2 text-sm text-success-ink">{p.answeredNote}</p>}
              {p.status !== "answered" && (
                <Button size="sm" variant="outline" onClick={() => void answered(p)}>
                  <CheckCircle2 className="size-4" /> Dios respondió
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
