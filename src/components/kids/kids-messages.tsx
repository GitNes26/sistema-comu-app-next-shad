"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, BellRing, Check, CheckCheck, MessageCircleHeart, Plus, ShieldCheck, UserRound } from "lucide-react"
import { ScrollRow } from "@/components/base/scroll-row"
import { DialogComponent } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { ALERT_PRESETS } from "@/lib/kids/rules"
import type { MessageDto } from "@/lib/kids/server"
import { cn } from "@/lib/utils"

const POLL_MS = 8000

// Frases a un toque para quien escribe como papá o mamá (se insertan en el cuadro, no se envían solas).
const PARENT_PHRASES = ["Voy en camino", "Me retraso unos minutos", "Gracias por avisarme", "¿Cómo va todo?"]

const dayKey = (iso: string) => new Date(iso).toDateString()
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Hoy"
  if (d.toDateString() === yesterday.toDateString()) return "Ayer"
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
}
const hm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })

type Row = { type: "day"; key: string; label: string } | { type: "msg"; m: MessageDto }

// Conversación entre el personal de Kids y los padres de un niño. Se actualiza
// sola mientras está abierta (sondeo corto) y marca como leído lo que llega. Usa el
// transcript de shadcn (Message + Bubble + MessageScroller) con desvanecido en los bordes.
export function KidsMessagesDialog({
  childId,
  childName,
  sessionId,
  staff,
  open,
  onClose,
  onChanged,
}: {
  childId: string | null
  childName: string
  sessionId?: string
  /** true = escribe el personal (puede mandar alertas); false = el padre/tutor. */
  staff: boolean
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const [messages, setMessages] = useState<MessageDto[] | null>(null)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [tools, setTools] = useState(staff)
  const input = useRef<HTMLTextAreaElement>(null)

  // El cuadro crece con el texto (hasta unas 5 líneas).
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [body, open])

  const load = useCallback(async () => {
    if (!childId) return
    try {
      const d = await apiJson<{ messages: MessageDto[] }>(`/api/kids/children/${childId}/messages`)
      setMessages(d.messages)
      onChanged?.()
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }, [childId, onChanged])

  useEffect(() => {
    if (!open || !childId) return
    setMessages(null)
    void load()
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
    // onChanged cambia de identidad en cada render del padre; el sondeo no debe reiniciarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, childId])

  // Mensajes con separador por día.
  const rows = useMemo(() => {
    const out: Row[] = []
    let last = ""
    for (const m of messages ?? []) {
      const k = dayKey(m.createdAt)
      if (k !== last) {
        out.push({ type: "day", key: `d-${k}`, label: dayLabel(m.createdAt) })
        last = k
      }
      out.push({ type: "msg", m })
    }
    return out
  }, [messages])

  const send = async (text: string, kind: "message" | "alert" = "message") => {
    const value = text.trim()
    if (!value || !childId) return
    setSending(true)
    try {
      await apiJson(`/api/kids/children/${childId}/messages`, { method: "POST", body: JSON.stringify({ body: value, kind, sessionId }) })
      setBody("")
      await load()
    } catch (err) {
      swalError("No se pudo enviar", errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={staff ? `Avisar a los papás de ${childName}` : `Mensajes sobre ${childName}`}
      description={staff ? "Les llega una notificación al instante." : "Habla con el personal de Comunidad Kids."}
      footer={
        <form
          className="flex w-full items-end gap-2 rounded-3xl bg-muted/50 p-2 ring-1 ring-border focus-within:ring-2 focus-within:ring-ring/40"
          onSubmit={(e) => {
            e.preventDefault()
            void send(body)
          }}
        >
          <button
            type="button"
            onClick={() => setTools((v) => !v)}
            aria-label={tools ? "Ocultar opciones rápidas" : "Mostrar opciones rápidas"}
            aria-pressed={tools}
            className={cn("press grid size-10 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground transition-transform hover:text-foreground", tools && "rotate-45 border-primary/40 text-primary")}
          >
            <Plus className="size-5" />
          </button>
          <textarea
            ref={input}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(body)
              }
            }}
            rows={1}
            maxLength={1000}
            aria-label="Mensaje"
            placeholder="Escribe un mensaje…"
            enterKeyHint="send"
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={sending || !body.trim()}
            className="press grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {sending ? <Spinner /> : <ArrowUp className="size-5" />}
          </button>
        </form>
      }
    >
      <div className="space-y-3">
        {tools && (
          <div className="blur-fade">
            {staff ? (
              <ScrollRow label="Avisos rápidos">
                {ALERT_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={sending}
                    onClick={() => void send(p, "alert")}
                    className="press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 text-xs font-medium whitespace-nowrap text-warning-ink hover:bg-warning/20"
                  >
                    <BellRing className="size-3.5" />
                    {p}
                  </button>
                ))}
              </ScrollRow>
            ) : (
              <ScrollRow label="Frases rápidas">
                {PARENT_PHRASES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setBody((cur) => (cur ? `${cur} ${p}` : p))
                      input.current?.focus()
                    }}
                    className="press inline-flex min-h-9 shrink-0 items-center rounded-full border bg-card px-3 text-xs font-medium whitespace-nowrap hover:border-primary/40"
                  >
                    {p}
                  </button>
                ))}
              </ScrollRow>
            )}
          </div>
        )}

        <div className="h-[52dvh] min-h-64 overflow-hidden rounded-2xl bg-muted/30 ring-1 ring-border">
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller>
              <MessageScrollerViewport className="scroll-fade-y px-3 py-4">
                <MessageScrollerContent aria-busy={sending} className="gap-2">
                  {messages === null && (
                    <Marker role="status" className="justify-center py-6">
                      <MarkerIcon>
                        <Spinner />
                      </MarkerIcon>
                      <MarkerContent className="shimmer">Cargando mensajes…</MarkerContent>
                    </Marker>
                  )}
                  {messages?.length === 0 && (
                    <div className="blur-fade m-auto flex max-w-64 flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <MessageCircleHeart className="size-6" />
                      </span>
                      <p className="font-medium text-foreground">Aún no hay mensajes</p>
                      <p>{staff ? "Escribe a los papás o manda un aviso rápido." : "Escribe al personal si necesitas algo de tu hijo."}</p>
                    </div>
                  )}
                  {rows.map((r, i) =>
                    r.type === "day" ? (
                      <MessageScrollerItem key={r.key} className="blur-fade">
                        <Marker variant="separator" className="py-1 text-xs first-letter:uppercase">
                          <MarkerContent>{r.label}</MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    ) : (
                      <MessageScrollerItem key={r.m.id} messageId={r.m.id} className="blur-fade" style={{ "--blur-fade-delay": `${Math.min(i, 8) * 45}ms` } as React.CSSProperties}>
                        <Message align={r.m.mine ? "end" : "start"}>
                          {!r.m.mine && (
                            <MessageAvatar>
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {staff ? <UserRound className="size-4" /> : <ShieldCheck className="size-4" />}
                                </AvatarFallback>
                              </Avatar>
                            </MessageAvatar>
                          )}
                          <MessageContent>
                            {r.m.kind === "alert" && (
                              <MessageHeader className="gap-1 text-warning-ink">
                                <BellRing className="size-3" /> Aviso
                              </MessageHeader>
                            )}
                            <Bubble variant={r.m.mine ? "default" : "muted"} align={r.m.mine ? "end" : "start"}>
                              <BubbleContent className={cn("whitespace-pre-line", r.m.kind === "alert" && "border-warning/40 bg-warning/15 text-foreground")}>
                                {r.m.body}
                              </BubbleContent>
                            </Bubble>
                            <MessageFooter className="gap-1 tabular-nums">
                              {hm(r.m.createdAt)}
                              {r.m.mine &&
                                (r.m.read ? <CheckCheck className="size-3.5 text-primary" aria-label="Leído" /> : <Check className="size-3.5" aria-label="Enviado" />)}
                            </MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )
                  )}
                  {sending && (
                    <Marker role="status" className="blur-fade justify-end">
                      <MarkerIcon>
                        <Spinner />
                      </MarkerIcon>
                      <MarkerContent className="shimmer">Enviando…</MarkerContent>
                    </Marker>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton aria-label="Ir al último mensaje" />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>
      </div>
    </DialogComponent>
  )
}
