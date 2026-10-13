"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BellRing, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DialogComponent } from "@/components/ui/dialog"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { ALERT_PRESETS } from "@/lib/kids/rules"
import type { MessageDto } from "@/lib/kids/server"
import { cn } from "@/lib/utils"

const POLL_MS = 8000

// Conversación entre el personal de Kids y los padres de un niño. Se actualiza
// sola mientras está abierta (sondeo corto) y marca como leído lo que llega.
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
  const bottom = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [messages?.length])

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
          className="flex w-full items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(body)
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={1000}
            aria-label="Mensaje"
            placeholder="Escribe un mensaje…"
            className="min-h-11 flex-1"
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={sending || !body.trim()}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      }
    >
      <div className="space-y-3">
        {staff && (
          <div className="flex flex-wrap gap-2">
            {ALERT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={sending}
                onClick={() => void send(p, "alert")}
                className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 text-xs font-medium text-warning-ink hover:bg-warning/20"
              >
                <BellRing className="size-3.5" />
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2" aria-live="polite">
          {messages === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {messages?.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay mensajes.</p>}
          {messages?.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.kind === "alert" ? "border border-warning/40 bg-warning/15" : m.mine ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {m.kind === "alert" && <p className="mb-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">Aviso</p>}
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={cn("mt-0.5 text-[0.7rem]", m.mine && m.kind !== "alert" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.createdAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </div>
    </DialogComponent>
  )
}
