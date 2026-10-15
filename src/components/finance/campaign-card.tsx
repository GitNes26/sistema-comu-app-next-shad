"use client"

import { Building2, CalendarDays, Gift, Sprout, Ticket, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CAMPAIGN_KINDS, type CampaignKind } from "@/lib/finance/campaign-rules"

// Tarjeta de una campaña de donativos con su termómetro. Se usa en el portal del
// creyente, en la página pública y en tesorería: mismo diseño, distinta acción.

const KIND_ICON: Record<CampaignKind, LucideIcon> = { building: Building2, project: Sprout, event: Ticket, general: Gift }
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export interface CampaignCardData {
  name: string
  description: string | null
  kind: CampaignKind
  goalAmount: number | null
  raised: number
  progress: number | null
  remaining: number | null
  imageUrl: string | null
  endsAt: string | null
}

export function CampaignCard({
  c,
  selected,
  onSelect,
  action,
  className,
}: {
  c: CampaignCardData
  selected?: boolean
  onSelect?: () => void
  action?: React.ReactNode
  className?: string
}) {
  const Icon = KIND_ICON[c.kind]
  const Wrapper = onSelect ? "button" : "div"
  return (
    <Wrapper
      {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {})}
      className={cn(
        "flex w-full flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-4 text-left",
        onSelect && "press",
        selected && "border-primary ring-2 ring-primary/30",
        className
      )}
    >
      {c.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.imageUrl} alt="" className="-mx-4 -mt-4 mb-1 h-32 w-[calc(100%+2rem)] max-w-none object-cover" />
      )}
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base leading-tight font-semibold">{c.name}</p>
          <p className="text-xs text-muted-foreground">
            {CAMPAIGN_KINDS[c.kind]}
            {c.endsAt && (
              <span className="inline-flex items-center gap-1">
                {" · "}
                <CalendarDays className="size-3" /> hasta {new Date(`${c.endsAt}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </p>
        </div>
      </div>
      {c.description && <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p>}

      <div className="space-y-1.5">
        {c.progress !== null ? (
          <>
            <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(c.progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la meta">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_60%,var(--warning))] transition-all duration-700" style={{ width: `${c.progress}%` }} />
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-heading font-semibold tabular-nums">{money(c.raised)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {c.progress}% de {money(c.goalAmount ?? 0)}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm">
            <span className="font-heading font-semibold tabular-nums">{money(c.raised)}</span> <span className="text-xs text-muted-foreground">reunidos</span>
          </p>
        )}
      </div>
      {action}
    </Wrapper>
  )
}
