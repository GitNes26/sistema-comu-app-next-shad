import { prisma } from "@/lib/db"
import { resolveHierarchy, sanitizeHierarchy, duplicateHierarchyLabel, type HierarchyEntry } from "@/lib/org/hierarchy"
import { CrudError } from "@/lib/crud/types"

/** Jerarquía de la iglesia (con valores por defecto donde no se haya editado). */
export async function getHierarchy(organizationId: string): Promise<HierarchyEntry[]> {
  const row = await prisma.appSettings.findUnique({ where: { organizationId }, select: { hierarchyLabels: true } })
  return resolveHierarchy(row?.hierarchyLabels)
}

/** Guarda nombres, descripciones y visibilidad; rechaza nombres repetidos. */
export async function saveHierarchy(organizationId: string, raw: unknown): Promise<HierarchyEntry[]> {
  const stored = sanitizeHierarchy(raw)
  const entries = resolveHierarchy(stored)
  const dup = duplicateHierarchyLabel(entries)
  if (dup) throw new CrudError(`El nombre «${dup}» está repetido; cada nivel necesita uno distinto`, 400)
  const json = JSON.parse(JSON.stringify(stored))
  await prisma.appSettings.upsert({
    where: { organizationId },
    update: { hierarchyLabels: json },
    create: { organizationId, hierarchyLabels: json },
  })
  return entries
}
