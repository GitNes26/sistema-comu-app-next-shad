"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCheck, HandHeart, Inbox, Mail, MessageCircle, Phone, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SegmentedFilter, StatusPill } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { CARD_KINDS, CARD_STATUS, GROUP_INTERESTS, PRAYER_STATUS, type CardKind, type CardStatus, type PrayerStatus } from "@/lib/connect/rules"
import type { CardDto, PrayerDto } from "@/lib/connect/server"

// Bandeja del equipo: lo que llega de la cara pública (tarjetas) y las peticiones de oración.

const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const TONE: Record<string, "warning" | "info" | "success"> = { new: "warning", contacted: "info", done: "success", open: "warning", praying: "info", answered: "success" }

export function ConnectAdmin() {
  const [cards, setCards] = useState<CardDto[] | null>(null)
  const [prayers, setPrayers] = useState<PrayerDto[] | null>(null)
  const [cardFilter, setCardFilter] = useState<"all" | CardStatus>("new")
  const [prayerFilter, setPrayerFilter] = useState<"all" | PrayerStatus>("open")

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ cards: CardDto[]; prayers: PrayerDto[] }>("/api/connect")
      setCards(d.cards)
      setPrayers(d.prayers)
    } catch (e) {
      swalError("No se pudo cargar la bandeja", errorMessage(e))
      setCards([])
      setPrayers([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const patch = async (body: Record<string, unknown>) => {
    try {
      await apiJson("/api/connect", { method: "PATCH", body: JSON.stringify(body) })
      notify.success("Actualizado")
      await load()
    } catch (e) {
      swalError("No se pudo actualizar", errorMessage(e))
    }
  }

  const shownCards = useMemo(() => (cards ?? []).filter((c) => cardFilter === "all" || c.status === cardFilter), [cards, cardFilter])
  const shownPrayers = useMemo(() => (prayers ?? []).filter((p) => prayerFilter === "all" || p.status === prayerFilter), [prayers, prayerFilter])
  const newCards = (cards ?? []).filter((c) => c.status === "new").length
  const openPrayers = (prayers ?? []).filter((p) => p.status === "open").length

  return (
    <Tabs defaultValue="cards" className="w-full">
      <TabsList>
        <TabsTrigger value="cards">
          Tarjetas {newCards > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs text-warning-ink">{newCards}</span>}
        </TabsTrigger>
        <TabsTrigger value="prayer">
          Oración {openPrayers > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs text-warning-ink">{openPrayers}</span>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cards" className="space-y-3 pt-3">
        <SegmentedFilter
          ariaLabel="Estado de la tarjeta"
          value={cardFilter}
          onChange={setCardFilter}
          options={[{ value: "all" as const, label: "Todas" }, ...(Object.entries(CARD_STATUS).map(([value, label]) => ({ value: value as CardStatus, label })))]}
        />
        {cards === null ? (
          <Skeleton className="h-40 w-full" />
        ) : shownCards.length === 0 ? (
          <EmptyState icon={Inbox} title="Sin tarjetas aquí" description="Cuando alguien llene «Soy nuevo» o «Quiero integrarme» en la página pública, aparecerá en esta bandeja." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shownCards.map((c) => (
              <li key={c.id} className="space-y-2 rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading font-semibold">{c.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="size-3" /> {CARD_KINDS[c.kind as CardKind] ?? c.kind}
                      {c.kind === "group" && c.cellName ? ` · Hogar: ${c.cellName}` : c.interest && c.kind === "group" ? ` · ${GROUP_INTERESTS[c.interest as keyof typeof GROUP_INTERESTS] ?? c.interest}` : ""}
                      {c.interest && c.kind === "school" ? ` · ${c.interest}` : ""}
                    </p>
                  </div>
                  <StatusPill tone={TONE[c.status]}>{CARD_STATUS[c.status]}</StatusPill>
                </div>
                {c.message && <p className="text-sm whitespace-pre-line text-muted-foreground">{c.message}</p>}
                <div className="flex flex-wrap gap-1.5 text-sm">
                  {c.phone && (
                    <>
                      <a href={`tel:${c.phone}`} className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3"><Phone className="size-4" /> {c.phone}</a>
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3"><MessageCircle className="size-4" /> WhatsApp</a>
                    </>
                  )}
                  {c.email && <a href={`mailto:${c.email}`} className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3"><Mail className="size-4" /> Correo</a>}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">{fmt(c.createdAt)}</span>
                  <div className="flex gap-1.5">
                    {c.status === "new" && <Button size="sm" variant="outline" onClick={() => void patch({ type: "card", id: c.id, status: "contacted" })}>Ya lo contacté</Button>}
                    {c.status !== "done" && (
                      <Button size="sm" onClick={() => void patch({ type: "card", id: c.id, status: "done" })}>
                        <CheckCheck className="size-4" /> Atendida
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="prayer" className="space-y-3 pt-3">
        <SegmentedFilter
          ariaLabel="Estado de la petición"
          value={prayerFilter}
          onChange={setPrayerFilter}
          options={[{ value: "all" as const, label: "Todas" }, ...(Object.entries(PRAYER_STATUS).map(([value, label]) => ({ value: value as PrayerStatus, label })))]}
        />
        {prayers === null ? (
          <Skeleton className="h-40 w-full" />
        ) : shownPrayers.length === 0 ? (
          <EmptyState icon={HandHeart} title="Sin peticiones aquí" description="Las peticiones de oración del portal y de la página pública llegan a esta lista." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shownPrayers.map((p) => (
              <li key={p.id} className="space-y-2 rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{p.name ?? "Anónimo"}</p>
                  <StatusPill tone={TONE[p.status]}>{PRAYER_STATUS[p.status]}</StatusPill>
                </div>
                <p className="text-sm whitespace-pre-line">{p.body}</p>
                {p.answeredNote && <p className="rounded-lg bg-success/10 p-2 text-sm text-success-ink">{p.answeredNote}</p>}
                {p.contact && <p className="text-xs text-muted-foreground">Contacto: {p.contact}</p>}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {fmt(p.createdAt)} · {p.visibility === "leaders" ? "Solo pastoral" : "Intercesión"}
                  </span>
                  <div className="flex gap-1.5">
                    {p.status === "open" && <Button size="sm" variant="outline" onClick={() => void patch({ type: "prayer", id: p.id, status: "praying" })}>Orar</Button>}
                    {p.status !== "answered" && <Button size="sm" onClick={() => void patch({ type: "prayer", id: p.id, status: "answered" })}>Respondida</Button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
