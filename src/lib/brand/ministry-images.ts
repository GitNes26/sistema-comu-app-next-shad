import { normalizeSearch } from "@/lib/search"

// Imágenes de marca de los ministerios y eventos de la iglesia (public/images).
//
// Convención de archivos: «<nombre>_dark.png» es la versión OSCURA y sirve en tema CLARO;
// «<nombre>.png» sin sufijo es la versión CLARA y sirve en tema OSCURO. Las imágenes a color
// que no tienen pareja (Comunidad Kids, Mesa de Amor…) funcionan igual en ambos temas.

export interface BrandImage {
  /** Imagen para el tema claro. */
  forLight: string
  /** Imagen para el tema oscuro (la misma si no hay pareja). */
  forDark: string
  /** true = la imagen viene en pareja claro/oscuro; false = imagen única. */
  paired: boolean
  /**
   * Base sobre la que se ve bien una imagen única (no cambia con el tema): «light» para imágenes de
   * trazo oscuro o a color, «dark» para imágenes de trazo claro. Las parejas no necesitan base.
   */
  surface: "light" | "dark" | "none"
}

const single = (file: string, surface: "light" | "dark" = "light"): BrandImage => ({ forLight: `/images/${file}.png`, forDark: `/images/${file}.png`, paired: false, surface })
const pair = (name: string): BrandImage => ({ forLight: `/images/${name}_dark.png`, forDark: `/images/${name}.png`, paired: true, surface: "none" })

/** Marca de la iglesia (Mismo Sentir): ícono, logotipo y logotipo completo, cada uno con su pareja claro/oscuro. */
export const CHURCH_BRAND = {
  icon: pair("icon"),
  logo: pair("logo"),
  logoFull: pair("logo_completo"),
  mark: pair("ms"),
  wordmark: pair("ms_letras"),
} as const

// El primer patrón que coincide gana (del más específico al más general). Se compara contra el
// nombre normalizado (sin acentos ni mayúsculas).
const RULES: { test: RegExp; image: BrandImage }[] = [
  { test: /\b(babies|bebes?|maternal)\b/, image: single("comunidad_babies") },
  { test: /\b(kids|ninos?|infantil)\b/, image: single("comunidad_kids") },
  { test: /\bencuentro (con )?jesus\b/, image: single("encuentro_con_jesus", "dark") },
  { test: /\blanzamiento\b/, image: single("lanzamiento") },
  { test: /\bescuela de ministerio\b|\bescuela ministerial\b/, image: single("escuela_de_ministerio") },
  { test: /\b(intercesion|intercesores|oracion)\b/, image: single("intercesion") },
  { test: /\b(mesas? de amor|hogares? de amor)\b/, image: single("mesa_de_amor") },
  { test: /\bprimicias\b/, image: pair("primicias") },
  { test: /\btalleres?\b/, image: single("talleres") },
]

/** Imagen de marca que corresponde a un ministerio o evento por su nombre (y tipo); null si no hay. */
export function brandImageFor(...names: (string | null | undefined)[]): BrandImage | null {
  for (const n of names) {
    const text = normalizeSearch(n)
    if (!text) continue
    for (const r of RULES) if (r.test.test(text)) return r.image
  }
  return null
}
