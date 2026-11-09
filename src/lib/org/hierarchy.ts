// Jerarquía eclesiástica editable. Los niveles (el enum `ChurchHierarchy`) son fijos y van en este
// orden, de menor a mayor; cada iglesia puede cambiar el NOMBRE y la DESCRIPCIÓN de cada nivel
// (p. ej. «Pastor principal» → «Pastor presidente») y ocultar los que no usa en los selectores.

export const HIERARCHY_LEVELS = ["believer", "disciple", "servant", "leader", "network_leader", "pastor", "senior_pastor"] as const
export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number]

export interface HierarchyEntry {
  level: HierarchyLevel
  label: string
  description: string
  /** Se ofrece al elegir la jerarquía de un creyente (los ya asignados se conservan). */
  isActive: boolean
}

export const DEFAULT_HIERARCHY: Record<HierarchyLevel, { label: string; description: string }> = {
  believer: { label: "Creyente", description: "Persona que se congrega y está en proceso de crecimiento." },
  disciple: { label: "Discípulo", description: "Recibe discipulado personal y empieza a caminar con un discipulador." },
  servant: { label: "Servidor", description: "Sirve en un ministerio o área de la iglesia." },
  leader: { label: "Líder", description: "Lidera una célula, un equipo o un ministerio." },
  network_leader: { label: "Líder de red", description: "Cuida y supervisa a los líderes de varias células." },
  pastor: { label: "Pastor", description: "Cuida pastoralmente a la congregación." },
  senior_pastor: { label: "Pastor principal", description: "Cabeza de la iglesia local." },
}

export type StoredHierarchy = Partial<Record<HierarchyLevel, { label?: string; description?: string; isActive?: boolean }>>

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "")

/** Normaliza lo que llega del formulario: solo niveles conocidos, textos acotados, y al menos un nivel activo. */
export function sanitizeHierarchy(raw: unknown): StoredHierarchy {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const out: StoredHierarchy = {}
  for (const level of HIERARCHY_LEVELS) {
    const o = src[level] && typeof src[level] === "object" ? (src[level] as Record<string, unknown>) : {}
    const label = text(o.label, 40)
    const description = text(o.description, 160)
    const entry: { label?: string; description?: string; isActive?: boolean } = {}
    if (label && label !== DEFAULT_HIERARCHY[level].label) entry.label = label
    if (description && description !== DEFAULT_HIERARCHY[level].description) entry.description = description
    if (o.isActive === false) entry.isActive = false
    if (Object.keys(entry).length) out[level] = entry
  }
  // «Creyente» es el nivel de partida de todo registro: no se puede ocultar.
  if (out.believer?.isActive === false) {
    delete out.believer.isActive
    if (Object.keys(out.believer).length === 0) delete out.believer
  }
  return out
}

/** Tabla completa (con valores por defecto) a partir de lo guardado. */
export function resolveHierarchy(stored: unknown): HierarchyEntry[] {
  const s = (stored && typeof stored === "object" ? stored : {}) as StoredHierarchy
  return HIERARCHY_LEVELS.map((level) => ({
    level,
    label: s[level]?.label?.trim() || DEFAULT_HIERARCHY[level].label,
    description: s[level]?.description?.trim() || DEFAULT_HIERARCHY[level].description,
    isActive: s[level]?.isActive !== false,
  }))
}

/** Detecta nombres repetidos entre niveles (confundirían al elegir). */
export function duplicateHierarchyLabel(entries: HierarchyEntry[]): string | null {
  const seen = new Set<string>()
  for (const e of entries) {
    const k = e.label.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase()
    if (seen.has(k)) return e.label
    seen.add(k)
  }
  return null
}
