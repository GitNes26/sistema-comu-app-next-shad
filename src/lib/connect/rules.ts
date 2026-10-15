// Reglas puras de la cara pública: tarjeta de conexión, oración y dirección pública
// (/c/[slug]). Sin Prisma: las usan el servidor, el cliente y las pruebas.

/** Lo que una persona puede pedir desde «Soy nuevo». Cada tipo tiene su destino. */
export const CARD_KINDS = {
  visitor: "Soy nuevo",
  group: "Quiero integrarme a un grupo",
  school: "Quiero inscribirme a la escuela",
  contact: "Quiero escribirles",
  prayer: "Necesito oración",
} as const
export type CardKind = keyof typeof CARD_KINDS
export const isCardKind = (v: unknown): v is CardKind => typeof v === "string" && v in CARD_KINDS

/** Tipos de «grupo en casa». */
export const GROUP_INTERESTS = {
  women: "Mujeres",
  men: "Varones",
  youth: "Jóvenes",
  couples: "Matrimonios",
  any: "El que me quede más cerca",
} as const
export type GroupInterest = keyof typeof GROUP_INTERESTS

export const CARD_STATUS = { new: "Nueva", contacted: "Contactada", done: "Atendida" } as const
export type CardStatus = keyof typeof CARD_STATUS
export const isCardStatus = (v: unknown): v is CardStatus => typeof v === "string" && v in CARD_STATUS

export const PRAYER_STATUS = { open: "Por orar", praying: "Orando", answered: "Respondida" } as const
export type PrayerStatus = keyof typeof PRAYER_STATUS
export const isPrayerStatus = (v: unknown): v is PrayerStatus => typeof v === "string" && v in PRAYER_STATUS

export const PRAYER_VISIBILITY = {
  team: "Equipo de intercesión",
  leaders: "Solo el pastor y líderes",
} as const
export type PrayerVisibility = keyof typeof PRAYER_VISIBILITY
export const isPrayerVisibility = (v: unknown): v is PrayerVisibility => typeof v === "string" && v in PRAYER_VISIBILITY

export const MODALITY = { in_person: "Presencial", online: "En línea", both: "Presencial y en línea" } as const
export type Modality = keyof typeof MODALITY
export const isModality = (v: unknown): v is Modality => typeof v === "string" && v in MODALITY

const RESERVED_SLUGS = new Set(["admin", "api", "auth", "mi", "c", "legal", "static", "_next", "www", "app"])

/** «Comunidad Torreón» → «comunidad-torreon». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug)
}

export const digitsOf = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "")

export interface CardInput {
  kind: CardKind
  name: string
  phone: string | null
  email: string | null
  message: string | null
  interest: string | null
  /** Hogar de amor (célula) elegido en el buscador. */
  cellId: string | null
}
export type CardResult = { ok: true; value: CardInput } | { ok: false; field: string; error: string }

const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : ""
  return s ? s.slice(0, max) : null
}

/** Valida y normaliza una tarjeta de conexión (el servidor vuelve a llamarla). */
export function validateCard(input: Record<string, unknown>): CardResult {
  if (!isCardKind(input.kind)) return { ok: false, field: "kind", error: "Elige qué necesitas" }
  const isPrayer = input.kind === "prayer"
  // Una petición de oración puede ser anónima; lo demás necesita saber a quién escribirle.
  const name = clean(input.name, 150) ?? (isPrayer ? "Anónimo" : null)
  if (!name || name.length < 2) return { ok: false, field: "name", error: "Escribe tu nombre" }
  const phone = clean(input.phone, 30)
  const email = clean(input.email, 150)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: "email", error: "Revisa tu correo" }
  if (phone && digitsOf(phone).length < 8) return { ok: false, field: "phone", error: "Revisa tu teléfono (mínimo 8 dígitos)" }
  if (isPrayer && !clean(input.message, 1500)) return { ok: false, field: "message", error: "Cuéntanos por qué quieres que oremos" }
  if (!isPrayer && !phone && !email) return { ok: false, field: "phone", error: "Déjanos un teléfono o un correo para escribirte" }
  let interest = clean(input.interest, 80)
  const cellId = input.kind === "group" ? clean(input.cellId, 40) : null
  // Sin hogar elegido el interés es el tipo de grupo (texto libre del tipo de célula).
  if (input.kind === "group" && !interest) interest = "any"
  if (input.kind !== "group") interest = input.kind === "school" ? interest : null
  return { ok: true, value: { kind: input.kind, name, phone, email, message: clean(input.message, isPrayer ? 1500 : 1000), interest, cellId } }
}

/** «Domingo · 10:00 – 12:00». */
export function slotRange(start: string, end: string | null): string {
  return end ? `${start} – ${end}` : start
}
