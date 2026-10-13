// Tipo de teclado según el campo (convención de formularios: ver docs/agents/FORMULARIOS_Y_CRUD.md).
// En celulares el teclado depende de `type`/`inputMode`: teléfono → numérico de marcado,
// cantidades → numérico, correo → con @, URL → con «.com» y «/», búsqueda → con «Buscar» y
// botón para borrar (Esc en teclado físico).

export type InputKind = "text" | "tel" | "email" | "url" | "search" | "number"

const RULES: [RegExp, InputKind][] = [
  [/tel[eé]fono|celular|m[oó]vil|whatsapp|\btel\b/i, "tel"],
  [/correo|e-?mail/i, "email"],
  [/sitio web|p[aá]gina web|\burl\b|enlace/i, "url"],
  [/^\s*(buscar|filtrar)/i, "search"],
]

/** Deduce el tipo de campo cuando el formulario no lo indicó (por su etiqueta o texto de ayuda). */
export function inferInputKind(...hints: (string | undefined | null)[]): InputKind | undefined {
  const found = new Set<InputKind>()
  for (const hint of hints) {
    if (!hint) continue
    for (const [re, kind] of RULES) if (re.test(hint)) found.add(kind)
  }
  // «Correo, teléfono o número» acepta varias cosas: no se adivina.
  return found.size === 1 ? [...found][0] : undefined
}

/** `inputMode` que corresponde a un `type` (y a su paso, para cantidades enteras). */
export function inputModeFor(type: string | undefined, step?: string | number): "tel" | "email" | "url" | "search" | "numeric" | "decimal" | undefined {
  switch (type) {
    case "tel":
      return "tel"
    case "email":
      return "email"
    case "url":
      return "url"
    case "search":
      return "search"
    case "number":
      return String(step) === "1" ? "numeric" : "decimal"
    default:
      return undefined
  }
}
