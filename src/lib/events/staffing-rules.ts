// Reglas puras de los servidores para eventos.

export const STAFF_STATUS = {
  assigned: "Asignado: espera su confirmación",
  offered: "Se ofreció: espera al líder",
  confirmed: "Confirmado",
  declined: "No puede",
  rejected: "No aceptado",
} as const
export type StaffStatus = keyof typeof STAFF_STATUS

/** Estados que ocupan un lugar del pedido. */
const COUNTED: StaffStatus[] = ["assigned", "confirmed"]

export function staffCounts(statuses: string[]) {
  const n = (s: StaffStatus) => statuses.filter((x) => x === s).length
  return {
    confirmed: n("confirmed"),
    assigned: n("assigned"),
    offered: n("offered"),
    /** Lugares ocupados (asignados o confirmados). */
    taken: statuses.filter((s) => COUNTED.includes(s as StaffStatus)).length,
  }
}

export function remainingSlots(quantity: number, statuses: string[]): number {
  return Math.max(0, quantity - staffCounts(statuses).taken)
}

/** ¿Ya empezó (o pasó) el evento? Se da un margen de 1 día para registrar lo último. */
export function eventClosedForStaffing(startsAt: Date, status: string, now = new Date()): boolean {
  return status === "cancelled" || status === "closed" || startsAt.getTime() < now.getTime() - 86_400_000
}

export const isStaffAction = (v: unknown): v is "assign" | "remove" | "approve" | "reject" | "offer" | "withdraw" | "confirm" | "decline" =>
  typeof v === "string" && ["assign", "remove", "approve", "reject", "offer", "withdraw", "confirm", "decline"].includes(v)
