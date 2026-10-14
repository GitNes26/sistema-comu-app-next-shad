// Búsqueda tolerante: ignora mayúsculas, acentos y espacios repetidos.
// Todo buscador, filtro o selector del cliente pasa por aquí para que «Jose» encuentre
// «José» y «ministerio» encuentre «Ministerio». Los buscadores de servidor dependen de
// la intercalación de MySQL (utf8mb4 *_ci / *_ai_ci), que ya es insensible a ambas cosas.

/** Minúsculas, sin acentos (ni diéresis, ni la tilde de la ñ) y con espacios simples. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** ¿`haystack` contiene `needle` ignorando mayúsculas y acentos? Vacío siempre coincide. */
export function matchesSearch(haystack: unknown, needle: unknown): boolean {
  const n = normalizeSearch(needle)
  if (!n) return true
  return normalizeSearch(haystack).includes(n)
}

/** ¿Coinciden todas las palabras de la búsqueda (en cualquier orden)? */
export function matchesAllWords(haystack: unknown, needle: unknown): boolean {
  const words = normalizeSearch(needle).split(" ").filter(Boolean)
  if (words.length === 0) return true
  const h = normalizeSearch(haystack)
  return words.every((w) => h.includes(w))
}

/** Filtro para `cmdk` (Command): 1 si coincide, 0 si no; también revisa las palabras clave. */
export function commandFilter(value: string, search: string, keywords?: string[]): number {
  return matchesAllWords([value, ...(keywords ?? [])].join(" "), search) ? 1 : 0
}
