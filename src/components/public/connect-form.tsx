"use client"

import { useState } from "react"
import { CheckCircle2, HandHeart, HeartHandshake, Loader2, GraduationCap, MessageCircle, Send, Sparkles, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormCombobox, InputGroupField, TextareaField } from "@/components/base"
import { apiJson, ApiError, errorMessage } from "@/lib/ministries/client"
import { CARD_KINDS, GROUP_INTERESTS, type CardKind } from "@/lib/connect/rules"

// «Tarjeta de conexión»: una sola puerta para quien llega. Cada opción tiene su destino
// (Consolidación, grupos en casa, escuela, intercesión o la bandeja del equipo).

const KIND_UI: Record<CardKind, { icon: LucideIcon; hint: string; done: string }> = {
  visitor: { icon: Sparkles, hint: "Queremos conocerte y acompañarte en tu primera visita.", done: "¡Qué gusto que estés aquí! Alguien de la familia te escribirá muy pronto." },
  group: { icon: HeartHandshake, hint: "Un grupo en casa es una familia pequeña donde caminamos juntos.", done: "¡Gracias! Te ayudaremos a encontrar el grupo en casa más cercano." },
  school: { icon: GraduationCap, hint: "Cuéntanos qué curso te interesa y te damos los datos de inscripción.", done: "¡Recibido! Te contactaremos con los datos de inscripción." },
  contact: { icon: MessageCircle, hint: "Escríbenos lo que necesites; te respondemos personalmente.", done: "Gracias por escribirnos. Te responderemos pronto." },
  prayer: { icon: HandHeart, hint: "Nuestro equipo de intercesión orará por ti. Puedes ser anónimo.", done: "Estamos orando por ti. Dios te ama y te escucha." },
}

export function ConnectForm({ slug, churchName, initialKind }: { slug: string; churchName: string; initialKind: CardKind }) {
  const [kind, setKind] = useState<CardKind>(initialKind)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [interest, setInterest] = useState("any")
  const [message, setMessage] = useState("")
  const [trap, setTrap] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null)
  const [done, setDone] = useState(false)

  const ui = KIND_UI[kind]
  const isPrayer = kind === "prayer"

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      await apiJson(`/api/public/${encodeURIComponent(slug)}/connect`, {
        method: "POST",
        body: JSON.stringify({ kind, name, phone, email, message, interest: kind === "group" ? interest : kind === "school" ? message.slice(0, 80) : null, website: trap }),
      })
      setDone(true)
    } catch (e) {
      setError({ field: e instanceof ApiError ? e.field : null, text: errorMessage(e, "No se pudo enviar. Intenta de nuevo.") })
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-primary" />
        <h2 className="mt-4 font-heading text-2xl font-semibold">¡Gracias{name ? `, ${name.split(" ")[0]}` : ""}!</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{ui.done}</p>
        <p className="mt-6 text-sm text-muted-foreground">Con cariño, {churchName}.</p>
      </div>
    )
  }

  const fieldError = (f: string) => (error?.field === f ? error.text : undefined)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
      className="space-y-5 rounded-3xl border bg-card p-5 sm:p-7"
      noValidate
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="¿Qué necesitas?">
        {(Object.keys(CARD_KINDS) as CardKind[]).map((k) => {
          const Icon = KIND_UI[k].icon
          const active = k === kind
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setKind(k)}
              className={`press flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-medium ${active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" />
              {CARD_KINDS[k]}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-muted-foreground">{ui.hint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputGroupField
          label={isPrayer ? "Tu nombre (opcional)" : "Tu nombre"}
          required={!isPrayer}
          autoComplete="name"
          value={name}
          maxLength={150}
          onChange={(e) => setName(e.target.value)}
          error={fieldError("name")}
          containerClassName="sm:col-span-2"
        />
        <InputGroupField label="Celular o WhatsApp" type="tel" autoComplete="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} error={fieldError("phone")} />
        <InputGroupField label="Correo" type="email" autoComplete="email" value={email} maxLength={150} onChange={(e) => setEmail(e.target.value)} error={fieldError("email")} />
        {kind === "group" && (
          <FormCombobox
            label="Tipo de grupo"
            options={Object.entries(GROUP_INTERESTS).map(([value, label]) => ({ value, label }))}
            value={interest}
            onChange={setInterest}
            clearable={false}
            searchable={false}
            className="sm:col-span-2"
          />
        )}
        <TextareaField
          label={isPrayer ? "¿Por qué quieres que oremos?" : kind === "school" ? "¿Qué curso te interesa?" : "Cuéntanos más (opcional)"}
          rows={4}
          value={message}
          maxLength={isPrayer ? 1500 : 1000}
          onChange={(e) => setMessage(e.target.value)}
          error={fieldError("message")}
          required={isPrayer}
          containerClassName="sm:col-span-2"
        />
      </div>

      {/* Campo trampa: las personas no lo ven. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      {error && !error.field && <p role="alert" className="text-sm text-destructive">{error.text}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        {isPrayer ? "Enviar mi petición" : "Enviar"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Tus datos solo los ve el equipo de {churchName} y no se comparten.</p>
    </form>
  )
}
