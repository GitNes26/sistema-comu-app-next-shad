// Reglas puras de Familia (parentescos); las usan servidor y cliente.
export const FAMILY_RELATIONS = { head: "Cabeza de familia", spouse: "Cónyuge", child: "Hijo(a)", relative: "Otro pariente" } as const
export type FamilyRelation = keyof typeof FAMILY_RELATIONS
export const isFamilyRelation = (v: unknown): v is FamilyRelation => typeof v === "string" && v in FAMILY_RELATIONS
