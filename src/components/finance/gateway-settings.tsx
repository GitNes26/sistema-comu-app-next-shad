"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { PAYMENT_PROVIDERS } from "@/lib/payments/rules"
import type { GatewayDto } from "@/lib/payments/server"

// Conexión de la cuenta de la iglesia con su pasarela de pago. Las llaves se envían
// una vez y quedan cifradas: aquí solo se ve si ya están guardadas.

const HELP: Record<GatewayDto["provider"], { secret: string; webhook: string; where: string }> = {
  stripe: {
    secret: "Llave secreta (sk_test_… o sk_live_…)",
    webhook: "Secreto de firma del webhook (whsec_…)",
    where: "En Stripe: Desarrolladores → Webhooks → agrega la dirección de abajo con el evento checkout.session.completed.",
  },
  mercadopago: {
    secret: "Access Token (APP_USR-… o TEST-…)",
    webhook: "Clave secreta de las notificaciones",
    where: "En Mercado Pago: Tus integraciones → Webhooks → agrega la dirección de abajo con el evento Pagos.",
  },
}

export function GatewaySettings() {
  const [gateways, setGateways] = useState<GatewayDto[] | null>(null)
  const [editing, setEditing] = useState<GatewayDto | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await apiJson<{ gateways: GatewayDto[] }>("/api/finance/gateway")
      setGateways(r.gateways)
    } catch (e) {
      setGateways([])
      swalError("No se pudo cargar la configuración", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (!gateways) return <Skeleton className="h-24 w-full" />
  return (
    <section className="space-y-2 rounded-2xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="size-4 text-primary" />
        Pagos en línea
      </h3>
      <p className="text-xs text-muted-foreground">Conecta la cuenta de la iglesia para que los creyentes den con tarjeta desde su espacio. El dinero llega directo a tu cuenta.</p>
      <ul className="divide-y rounded-xl border">
        {gateways.map((g) => (
          <li key={g.provider} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{PAYMENT_PROVIDERS[g.provider].label}</span>
              <span className="block text-xs text-muted-foreground">{PAYMENT_PROVIDERS[g.provider].description}</span>
            </span>
            <StatusPill tone={g.isActive ? "success" : g.hasSecret ? "warning" : "neutral"}>
              {g.isActive ? (g.mode === "live" ? "Activa" : "Activa (pruebas)") : g.hasSecret ? "Configurada, sin activar" : "Sin configurar"}
            </StatusPill>
            <Button size="sm" variant="outline" onClick={() => setEditing(g)}>
              Configurar
            </Button>
          </li>
        ))}
      </ul>
      <GatewayDialog gateway={editing} onClose={() => setEditing(null)} onSaved={load} />
    </section>
  )
}

function GatewayDialog({ gateway, onClose, onSaved }: { gateway: GatewayDto | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [secret, setSecret] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [active, setActive] = useState(false)
  const [live, setLive] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!gateway) return
    setSecret("")
    setWebhookSecret("")
    setActive(gateway.isActive)
    setLive(gateway.mode === "live")
  }, [gateway])

  const save = async () => {
    if (!gateway) return
    setSaving(true)
    try {
      await apiJson("/api/finance/gateway", {
        method: "PUT",
        body: JSON.stringify({ provider: gateway.provider, secretKey: secret, webhookSecret, isActive: active, mode: live ? "live" : "test" }),
      })
      notify.success("Configuración guardada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const copy = async () => {
    if (!gateway) return
    try {
      await navigator.clipboard.writeText(gateway.webhookUrl)
      notify.success("Dirección copiada")
    } catch {
      /* sin portapapeles */
    }
  }
  const help = gateway ? HELP[gateway.provider] : null

  return (
    <DialogComponent
      open={gateway !== null}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={gateway ? `Configurar ${PAYMENT_PROVIDERS[gateway.provider].label}` : "Configurar"}
      description="Las llaves se guardan cifradas y no se vuelven a mostrar."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      {gateway && help && (
        <div className="space-y-4">
          <InputGroupField
            label={help.secret}
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={gateway.hasSecret ? "Ya guardada; escribe para reemplazarla" : ""}
          />
          <InputGroupField
            label={help.webhook}
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={gateway.hasWebhookSecret ? "Ya guardado; escribe para reemplazarlo" : ""}
          />
          <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs">
            <p className="font-medium">Dirección del webhook</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all">{gateway.webhookUrl}</code>
              <Button size="icon-sm" variant="ghost" aria-label="Copiar dirección" onClick={() => void copy()}>
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground">{help.where}</p>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={live} onCheckedChange={setLive} />
            Son llaves de producción (cobros reales)
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={active} onCheckedChange={setActive} />
            Ofrecer este medio de pago a los creyentes
          </label>
        </div>
      )}
    </DialogComponent>
  )
}
