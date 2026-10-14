// Tipos de aviso de la iglesia → grupo visual. Un solo lugar para que la campana, el
// centro de notificaciones y los toasts se vean coherentes.

export type NoticeGroup = "event" | "payment" | "school" | "ministry" | "kids" | "prayer" | "care" | "content" | "stream" | "finance" | "system"

const GROUP_BY_KIND: Record<string, NoticeGroup> = {
  event: "event",
  event_ticket: "event",
  event_payment: "payment",
  event_staff: "event",
  serve: "ministry",
  donation_paid: "payment",
  school_payment: "payment",
  school_graded: "school",
  growth: "school",
  ministry_added: "ministry",
  ministry_meeting: "ministry",
  ministry_request: "ministry",
  ministry_decision: "ministry",
  kids: "kids",
  message: "kids",
  prayer: "prayer",
  prayer_update: "prayer",
  consolidation_assigned: "care",
  consolidation_new: "care",
  connection_card: "care",
  post: "content",
  highlight: "content",
  stream_live: "stream",
  income: "finance",
  expense: "finance",
  tithe: "finance",
  subscription_due: "finance",
  welcome: "system",
  info: "system",
}

export function noticeGroup(kind: string | null | undefined): NoticeGroup {
  if (!kind) return "system"
  if (GROUP_BY_KIND[kind]) return GROUP_BY_KIND[kind]
  if (kind.startsWith("kids")) return "kids"
  if (kind.startsWith("event")) return "event"
  if (kind.startsWith("school")) return "school"
  if (kind.startsWith("ministry")) return "ministry"
  return "system"
}

export const GROUP_LABEL: Record<NoticeGroup, string> = {
  event: "Eventos",
  payment: "Pagos",
  school: "Escuela",
  ministry: "Ministerios",
  kids: "Kids",
  prayer: "Oración",
  care: "Cuidado y seguimiento",
  content: "Noticias",
  stream: "Transmisión",
  finance: "Finanzas",
  system: "General",
}
