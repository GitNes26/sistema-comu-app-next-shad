"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, CreditCard, ExternalLink, HandCoins, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { DonationDto } from "@/lib/finance/server"
import { PAYMENT_PROVIDERS, type PaymentProvider } from "@/lib/payments/rules"

// «Mis donativos»: los datos para dar y el aviso de transferencia. La tesorería lo
// confirma y entonces se registra como ingreso; nadie más ve lo que cada quien da.

interface Info {
  enabled: boolean
  online?: PaymentProvider[]
  bank?: string | null
  holder?: string | null
  clabe?: string | null
  account?: string | null
  card?: string | null
  link?: string | null
  note?: string | null
}
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const KIND = { tithe: "Diezmo", offering: "Ofrenda", donation: "Donativo" } as const

export function MyDonations() {
  const [info, setInfo] = useState<Info | null>(null)
  const [mine, setMine] = useState<DonationDto[] | null>(null)
  const [amount, setAmount] = useState("")
  const [kind, setKind] = useState("tithe")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState<PaymentProvider | null>(null)
  const [onlineAmount, setOnlineAmount] = useState("")
  const [onlineKind, setOnlineKind] = useState("tithe")
  const [returned, setReturned] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [i, m] = await Promise.all([apiJson<{ info: Info }>("/api/finance/donations/info"), apiJson<{ donations: DonationDto[] }>("/api/finance/donations/mine")])
      setInfo(i.info)
      setMine(m.donations)
    } catch (e) {
      setInfo({ enabled: false })
      setMine([])
      swalError("No se pudo cargar", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
    const r = new URLSearchParams(window.location.search).get("pago")
    if (r) setReturned(r)
  }, [load])

  const payOnline = async (provider: PaymentProvider) => {
    setPaying(provider)
    try {
      const r = await apiJson<{ url: string }>("/api/finance/donations/checkout", {
        method: "POST",
        body: JSON.stringify({ provider, amount: onlineAmount, kind: onlineKind }),
      })
      window.location.assign(r.url)
    } catch (e) {
      swalError("No se pudo iniciar el pago", errorMessage(e))
      setPaying(null)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify.success("Copiado")
    } catch {
      /* sin portapapeles */
    }
  }
  const send = async () => {
    setSaving(true)
    try {
      await apiJson("/api/finance/donations", { method: "POST", body: JSON.stringify({ amount, kind, reference }) })
      notify.success("Aviso enviado; la tesorería lo confirmará")
      setAmount("")
      setReference("")
      await load()
    } catch (e) {
      swalError("No se pudo enviar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!info || !mine) return <Skeleton className="h-48 w-full" />
  const rows: [string, string | null | undefined][] = [
    ["Banco", info.bank],
    ["Titular", info.holder],
    ["CLABE", info.clabe],
    ["Cuenta", info.account],
    ["Tarjeta", info.card],
  ]

  const online = info.online ?? []
  return (
    <div className="space-y-6">
      {returned === "ok" && (
        <p role="status" className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          ¡Gracias! Estamos confirmando tu pago; en unos momentos aparecerá como confirmado en «Mis avisos».
        </p>
      )}
      {returned === "cancelado" && <p role="status" className="rounded-2xl border bg-muted/50 p-3 text-sm">El pago se canceló; no se hizo ningún cargo.</p>}

      {online.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            <CreditCard className="size-4 text-primary" />
            Dar en línea
          </h2>
          <p className="text-sm text-muted-foreground">Paga de forma segura con tarjeta; el pago se registra solo.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputGroupField label="Monto (MXN)" required inputMode="decimal" value={onlineAmount} onChange={(e) => setOnlineAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            <FormCombobox
              label="Es un…"
              options={Object.entries(KIND).map(([value, label]) => ({ value, label }))}
              value={onlineKind}
              onChange={setOnlineKind}
              clearable={false}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {online.map((p) => (
              <Button key={p} onClick={() => void payOnline(p)} disabled={paying !== null || !onlineAmount}>
                {paying === p && <Loader2 className="size-4 animate-spin" />}
                Pagar con {PAYMENT_PROVIDERS[p].label}
              </Button>
            ))}
          </div>
        </section>
      )}

      {info.enabled ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-heading text-base font-semibold">Datos para dar</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {rows
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="truncate text-sm font-medium">{value}</dd>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Copiar ${label}`} onClick={() => void copy(value!)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              ))}
          </dl>
          {info.link && (
            <a href={info.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Dar en línea <ExternalLink className="size-3.5" />
            </a>
          )}
          {info.note && <p className="text-sm text-muted-foreground">{info.note}</p>}
        </section>
      ) : (
        <EmptyState icon={HandCoins} title="Aún no hay datos para donar" description="La iglesia no ha publicado sus datos de donativos." />
      )}

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-heading text-base font-semibold">Ya hice mi transferencia</h2>
        <p className="text-sm text-muted-foreground">Avísanos para que la tesorería la confirme y la registre.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <InputGroupField label="Monto" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <FormCombobox
            label="Es un…"
            options={Object.entries(KIND).map(([value, label]) => ({ value, label }))}
            value={kind}
            onChange={setKind}
            clearable={false}
          />
          <InputGroupField label="Folio o referencia" value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void send()} disabled={saving || !amount}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enviar aviso
          </Button>
        </div>
      </section>

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Mis avisos</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {mine.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {KIND[d.kind as keyof typeof KIND] ?? d.kind} · {new Date(d.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  {d.reference ? ` · ${d.reference}` : ""}
                </span>
                <span className="tabular-nums">{money(d.amount)}</span>
                <StatusPill tone={d.status === "paid" ? "success" : d.status === "pending" ? "warning" : "neutral"}>
                  {d.status === "paid" ? "Confirmado" : d.status === "pending" ? "En revisión" : "No confirmado"}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
