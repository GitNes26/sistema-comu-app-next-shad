import { StatusPill, type StatusTone } from "@/components/base/status-pill"

// Etiquetas de estado por dominio, construidas sobre StatusPill. Cada módulo
// (compras, crédito, devoluciones, catálogos…) usa estas en lugar de dibujar
// su propio Badge, para que un estado se vea igual en todo el sistema.

function makePill(labels: Record<string, string>, tones: Record<string, StatusTone>) {
  return function DomainPill({ status, className }: { status: string; className?: string }) {
    return (
      <StatusPill tone={tones[status] ?? "neutral"} className={className}>
        {labels[status] ?? status}
      </StatusPill>
    )
  }
}

/** Activo / inactivo de cualquier registro (combos, proveedores, usuarios…). */
export function ActiveStatusPill({
  active,
  activeLabel = "Activo",
  inactiveLabel = "Inactivo",
  className,
}: {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
  className?: string
}) {
  return (
    <StatusPill tone={active ? "success" : "neutral"} className={className}>
      {active ? activeLabel : inactiveLabel}
    </StatusPill>
  )
}

export const CREDIT_STATUS_LABELS: Record<string, string> = { active: "Activa", suspended: "Suspendida", settled: "Liquidada", closed: "Cerrada" }
export const CreditStatusPill = makePill(CREDIT_STATUS_LABELS, { active: "success", suspended: "danger", settled: "neutral", closed: "neutral" })

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  requested: "Solicitada",
  quoted: "Respondida",
  approved: "Aprobada",
  sent: "Enviada",
  partially_received: "Recepción parcial",
  received: "Recibida",
  cancelled: "Cancelada",
}
export const PurchaseStatusPill = makePill(PURCHASE_STATUS_LABELS, {
  draft: "neutral",
  requested: "info",
  quoted: "info",
  approved: "primary",
  sent: "info",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
})

export const RETURN_STATUS_LABELS: Record<string, string> = { pending: "Pendiente", approved: "Aprobada", completed: "Completada", rejected: "Rechazada" }
export const ReturnStatusPill = makePill(RETURN_STATUS_LABELS, { pending: "warning", approved: "info", completed: "success", rejected: "danger" })

export const RETURN_TYPE_LABELS: Record<string, string> = { refund: "Reembolso", coupon: "Cupón", points: "Puntos", credit: "Crédito", exchange: "Cambio" }
/** Tipo de devolución: categoría, no estado (sin punto). */
export function ReturnTypePill({ type, className }: { type: string; className?: string }) {
  return (
    <StatusPill tone="neutral" dot={false} className={className}>
      {RETURN_TYPE_LABELS[type] ?? type}
    </StatusPill>
  )
}

export const PUBLICATION_TYPE_LABELS: Record<string, string> = { product_new: "Nuevo", promotion: "Promoción", notice: "Aviso" }
export const PublicationTypePill = makePill(PUBLICATION_TYPE_LABELS, { product_new: "success", promotion: "warning", notice: "info" })
