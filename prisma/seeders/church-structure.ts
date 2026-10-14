import { prisma } from "../../src/lib/db/client"

// Estructura base de una iglesia (Comunidad): ministerios (la misión) y áreas de servicio
// (la organización). Es idempotente: crea lo que falte y conserva lo que ya exista.
// Nombres con la forma en que la iglesia los usa: VTR («Venga Tu Reino»), Saetas
// (mujeres), Hombres de Reino (HR, varones).

export interface StructureNode {
  name: string
  shortName?: string
  kind?: string
  category: "ministry" | "service"
  description?: string
  parent?: string
}

export const CHURCH_STRUCTURE: StructureNode[] = [
  // ── Ministerios ───────────────────────────────────────────────────────────
  { name: "Alabanza", kind: "worship", category: "ministry", description: "Dirige la adoración en reuniones y eventos; incluye al grupo musical Mismo Sentir." },
  { name: "Consolidación", kind: "consolidation", category: "ministry", description: "Da seguimiento a quienes nos visitan hasta integrarlos a la familia." },
  { name: "Comunidad Kids", kind: "kids", category: "ministry", description: "Enseña la Biblia a los niños en un lugar seguro." },
  { name: "Comunidad Babies", kind: "kids", category: "ministry", parent: "Comunidad Kids", description: "Cuidado y amor para los más pequeños." },
  { name: "VTR (Jóvenes)", shortName: "VTR", kind: "youth", category: "ministry", description: "Venga Tu Reino: la generación joven de la iglesia." },
  { name: "Saetas (Mujeres)", shortName: "Saetas", kind: "group", category: "ministry", description: "Ministerio de mujeres." },
  { name: "Hombres de Reino (HR)", shortName: "HR", kind: "group", category: "ministry", description: "Ministerio de varones." },
  { name: "Matrimonios", kind: "group", category: "ministry", description: "Fortalece a los matrimonios y a las familias." },
  { name: "Intercesión", category: "ministry", description: "Equipo que ora por las peticiones de la iglesia." },
  { name: "Grupos en casa", category: "ministry", description: "Familias pequeñas que se reúnen en los hogares durante la semana." },
  { name: "Escuela de Ministerio", category: "ministry", description: "Formación en los fundamentos de la vida cristiana." },
  { name: "Teología", category: "ministry", description: "Programa de estudios bíblicos y teológicos de seis años." },
  // ── Áreas de servicio ─────────────────────────────────────────────────────
  { name: "Producción", category: "service", description: "Hace posible cada reunión: audio, luces, proyección y transmisión." },
  { name: "Audio", category: "service", parent: "Producción" },
  { name: "Iluminación", category: "service", parent: "Producción" },
  { name: "Proyección", category: "service", parent: "Producción" },
  { name: "Fotografía", category: "service", parent: "Producción" },
  { name: "Video", category: "service", parent: "Producción" },
  { name: "Transmisión", category: "service", parent: "Producción" },
  { name: "Ujieres", category: "service", description: "Cuidan el orden y el acomodo en las reuniones." },
  { name: "Bienvenida", category: "service", description: "Reciben a quienes llegan y los hacen sentir en casa." },
  { name: "Cafetería", category: "service", description: "Café y alimentos para la familia." },
  { name: "Librería", category: "service", description: "Libros y recursos para crecer." },
  { name: "Comunicación y redes", category: "service", description: "Mantiene informada a la familia." },
  { name: "Arte", category: "service", parent: "Comunicación y redes" },
  { name: "Logística y eventos", category: "service" },
  { name: "Seguridad y estacionamiento", category: "service" },
  { name: "Limpieza y mantenimiento", category: "service" },
  { name: "Administración", category: "service", description: "Finanzas, secretaría y recursos de la iglesia." },
]

/** Nombres anteriores de la demo → nombre vigente (se renombran en lugar de duplicar). */
const LEGACY_NAMES: Record<string, string> = {
  Jóvenes: "VTR (Jóvenes)",
  Mujeres: "Saetas (Mujeres)",
  Varones: "Hombres de Reino (HR)",
  "Hombres de Reino": "Hombres de Reino (HR)",
}

/** Crea la estructura que falte en la iglesia y devuelve nombre → id. */
export async function seedChurchStructure(organizationId: string): Promise<Map<string, string>> {
  for (const [from, to] of Object.entries(LEGACY_NAMES)) {
    const old = await prisma.ministry.findFirst({ where: { organizationId, name: from }, select: { id: true } })
    if (!old) continue
    const taken = await prisma.ministry.findFirst({ where: { organizationId, name: to }, select: { id: true } })
    if (!taken) await prisma.ministry.update({ where: { id: old.id }, data: { name: to } })
  }

  const ids = new Map<string, string>()
  for (const [index, n] of CHURCH_STRUCTURE.entries()) {
    const existing = await prisma.ministry.findFirst({ where: { organizationId, name: n.name } })
    const parentId = n.parent ? ids.get(n.parent) ?? null : null
    const row =
      existing ??
      (await prisma.ministry.create({
        data: {
          organizationId,
          name: n.name,
          kind: n.kind ?? "general",
          category: n.category,
          shortName: n.shortName ?? null,
          description: n.description ?? null,
          parentId,
          sortOrder: index,
        },
      }))
    // Lo ya existente conserva sus datos, pero recibe categoría y sigla si no las tenía.
    if (existing) {
      await prisma.ministry.update({
        where: { id: existing.id },
        data: {
          category: n.category,
          ...(existing.shortName ? {} : { shortName: n.shortName ?? null }),
          ...(existing.parentId || !parentId ? {} : { parentId }),
        },
      })
    }
    ids.set(n.name, row.id)
  }
  return ids
}
