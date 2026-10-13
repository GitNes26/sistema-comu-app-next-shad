// Modelo de apariencia (fuente única de tipos, defaults, y mapas CSS).

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEMES)[number];

export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type Density = (typeof DENSITIES)[number];

export const CARD_SIZES = ["sm", "md", "lg"] as const;
export type CardSize = (typeof CARD_SIZES)[number];

export const FONT_FAMILIES = ["poppins", "montserrat", "afacad", "system"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const SIDEBAR_STYLES = ["full", "compact", "icon"] as const;
export type SidebarStyle = (typeof SIDEBAR_STYLES)[number];

// Tono de las superficies neutras (fondo, tarjetas, bordes): cuánto se tiñen
// hacia el matiz primario. "neutral" = blanco/negro puros como antes.
export const SURFACE_TONES = ["neutral", "subtle", "tinted"] as const;
export type SurfaceTone = (typeof SURFACE_TONES)[number];

export interface AppearanceParams {
  primaryHue: number;
  accentHue: number;
  fontFamily: FontFamily;
  fontScale: number;
  density: Density;
  borderRadius: number;
  cardSize: CardSize;
  sidebarStyle: SidebarStyle;
  surfaceTone: SurfaceTone;
}

export const DEFAULT_APPEARANCE: AppearanceParams = {
  primaryHue: 24,
  accentHue: 190,
  fontFamily: "poppins",
  fontScale: 1,
  density: "comfortable",
  borderRadius: 0.75,
  cardSize: "md",
  sidebarStyle: "full",
  surfaceTone: "subtle",
};

export const FONT_VAR: Record<FontFamily, string> = {
  poppins: "var(--font-poppins)",
  montserrat: "var(--font-montserrat)",
  afacad: "var(--font-afacad)",
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const DENSITY_GAP: Record<Density, string> = {
  compact: "0.375rem",
  comfortable: "0.75rem",
  spacious: "1.25rem",
};

export const CARD_WIDTH: Record<CardSize, string> = {
  sm: "220px",
  md: "260px",
  lg: "320px",
};

export const SIDEBAR_WIDTH: Record<SidebarStyle, string> = {
  full: "264px",
  compact: "200px",
  icon: "64px",
};

// Valor efectivo = default → tenant (DB) → override (dispositivo).
export function mergeAppearance(
  tenant: Partial<AppearanceParams> | null | undefined,
  overrides: Partial<AppearanceParams> | undefined
): AppearanceParams {
  return {
    ...DEFAULT_APPEARANCE,
    ...(tenant ?? {}),
    ...(overrides ?? {}),
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Sanitiza una entrada parcial (desde API/JSON) hacia AppearanceParams limpios. */
export function sanitizeAppearance(
  input: Record<string, unknown>
): Partial<AppearanceParams> {
  const out: Partial<AppearanceParams> = {};

  const num = (key: string, min: number, max: number): number | undefined => {
    const v = Number(input[key]);
    return Number.isFinite(v) ? clamp(v, min, max) : undefined;
  };
  const pick = <T extends string>(key: string, values: readonly T[]): T | undefined => {
    const v = input[key];
    return typeof v === "string" && (values as readonly string[]).includes(v)
      ? (v as T)
      : undefined;
  };

  const hue = num("primaryHue", 0, 360);
  if (hue !== undefined) out.primaryHue = hue;
  const acc = num("accentHue", 0, 360);
  if (acc !== undefined) out.accentHue = acc;
  const scale = num("fontScale", 0.7, 1.4);
  if (scale !== undefined) out.fontScale = scale;
  const radius = num("borderRadius", 0, 2);
  if (radius !== undefined) out.borderRadius = radius;

  const font = pick("fontFamily", FONT_FAMILIES);
  if (font) out.fontFamily = font;
  const density = pick("density", DENSITIES);
  if (density) out.density = density;
  const card = pick("cardSize", CARD_SIZES);
  if (card) out.cardSize = card;
  const side = pick("sidebarStyle", SIDEBAR_STYLES);
  if (side) out.sidebarStyle = side;
  const tone = pick("surfaceTone", SURFACE_TONES);
  if (tone) out.surfaceTone = tone;

  return out;
}