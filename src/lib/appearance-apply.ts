// Aplicación de la apariencia al DOM (solo cliente).
import {
  mergeAppearance,
  FONT_VAR,
  DENSITY_GAP,
  CARD_WIDTH,
  SIDEBAR_WIDTH,
  type ThemeMode,
  type AppearanceParams,
  type Density,
  type SurfaceTone,
} from "@/lib/appearance";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function oklch(lightness: number, chroma: number, hue: number, alpha?: number): string {
  const h = ` ${hue}`;
  return alpha === undefined ? `oklch(${lightness} ${chroma} ${h})` : `oklch(${lightness} ${chroma} ${h} / ${alpha})`;
}

type Surface = [lightness: number, chroma: number];
type SurfaceRamp = Record<
  | "background" | "card" | "popover" | "muted" | "border" | "input"
  | "sidebar" | "sidebarAccent" | "sunken" | "foreground" | "mutedForeground",
  Surface
>;

// Rampas de superficies neutras. La luminosidad define la capa (lienzo → tarjeta
// → popover) y el croma, cuánto se tiñen hacia el matiz primario según el
// "tono de fondo" elegido en Apariencia. Neutral conserva blanco/negro puros.
const LIGHT_RAMPS: Record<SurfaceTone, SurfaceRamp> = {
  neutral: {
    background: [1, 0], card: [1, 0], popover: [1, 0], muted: [0.97, 0],
    border: [0.922, 0], input: [0.922, 0], sidebar: [0.985, 0], sidebarAccent: [0.955, 0],
    sunken: [0.975, 0], foreground: [0.145, 0], mutedForeground: [0.52, 0],
  },
  subtle: {
    background: [0.984, 0.003], card: [1, 0], popover: [1, 0], muted: [0.962, 0.006],
    border: [0.912, 0.008], input: [0.9, 0.009], sidebar: [0.974, 0.005], sidebarAccent: [0.94, 0.012],
    sunken: [0.968, 0.006], foreground: [0.17, 0.012], mutedForeground: [0.5, 0.014],
  },
  tinted: {
    background: [0.972, 0.011], card: [0.995, 0.003], popover: [0.998, 0.002], muted: [0.945, 0.016],
    border: [0.895, 0.02], input: [0.88, 0.022], sidebar: [0.955, 0.016], sidebarAccent: [0.915, 0.03],
    sunken: [0.955, 0.016], foreground: [0.19, 0.022], mutedForeground: [0.49, 0.024],
  },
};

const DARK_RAMPS: Record<SurfaceTone, SurfaceRamp> = {
  neutral: {
    background: [0.145, 0], card: [0.205, 0], popover: [0.225, 0], muted: [0.269, 0],
    border: [0.3, 0], input: [0.34, 0], sidebar: [0.175, 0], sidebarAccent: [0.26, 0],
    sunken: [0.12, 0], foreground: [0.985, 0], mutedForeground: [0.72, 0],
  },
  subtle: {
    background: [0.155, 0.006], card: [0.198, 0.008], popover: [0.222, 0.009], muted: [0.262, 0.01],
    border: [0.295, 0.01], input: [0.335, 0.012], sidebar: [0.172, 0.008], sidebarAccent: [0.255, 0.014],
    sunken: [0.13, 0.006], foreground: [0.975, 0.004], mutedForeground: [0.72, 0.012],
  },
  tinted: {
    background: [0.168, 0.018], card: [0.212, 0.022], popover: [0.235, 0.024], muted: [0.278, 0.026],
    border: [0.31, 0.026], input: [0.35, 0.028], sidebar: [0.185, 0.022], sidebarAccent: [0.27, 0.034],
    sunken: [0.14, 0.016], foreground: [0.97, 0.008], mutedForeground: [0.73, 0.022],
  },
};

function writeSurfaces(css: CSSStyleDeclaration, ramp: SurfaceRamp, hue: number, neutralHue: boolean) {
  const c = (s: Surface) => oklch(s[0], neutralHue ? 0 : s[1], hue);
  css.setProperty("--background", c(ramp.background));
  css.setProperty("--foreground", c(ramp.foreground));
  css.setProperty("--card", c(ramp.card));
  css.setProperty("--card-foreground", c(ramp.foreground));
  css.setProperty("--popover", c(ramp.popover));
  css.setProperty("--popover-foreground", c(ramp.foreground));
  css.setProperty("--muted", c(ramp.muted));
  css.setProperty("--muted-foreground", c(ramp.mutedForeground));
  css.setProperty("--secondary", c(ramp.muted));
  css.setProperty("--secondary-foreground", c(ramp.foreground));
  css.setProperty("--border", c(ramp.border));
  css.setProperty("--input", c(ramp.input));
  css.setProperty("--surface-sunken", c(ramp.sunken));
  css.setProperty("--sidebar", c(ramp.sidebar));
  css.setProperty("--sidebar-foreground", c(ramp.foreground));
  css.setProperty("--sidebar-accent", c(ramp.sidebarAccent));
  css.setProperty("--sidebar-accent-foreground", c(ramp.foreground));
  css.setProperty("--sidebar-border", c(ramp.border));
}

/** Color del chrome del navegador/PWA (barra de estado) acorde al lienzo. */
function syncThemeColor(root: HTMLElement) {
  const bg = getComputedStyle(root).getPropertyValue("--background").trim();
  if (!bg) return;
  root.style.background = "var(--background)";
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  meta.forEach((m) => m.setAttribute("content", bg));
}

/** Calcula el valor efectivo y lo escribe como CSS custom properties (+ clases). */
export function applyAppearanceToDom(
  theme: ThemeMode,
  tenant: Partial<AppearanceParams> | null,
  overrides: Partial<AppearanceParams> | undefined
): void {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(theme);
  const effective = mergeAppearance(tenant, overrides);
  const isDark = resolved === "dark";
  const density: Density = effective.density;

  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-theme", resolved);

  const css = root.style;
  const hue = effective.primaryHue;
  const acc = effective.accentHue;
  const primaryChroma = hue === 360 ? 0.02 : 0.14;
  const accentChroma = acc === 360 ? 0.015 : 0.1;
  const tone = effective.surfaceTone;
  const ramp = isDark ? DARK_RAMPS[tone] : LIGHT_RAMPS[tone];
  writeSurfaces(css, ramp, hue === 360 ? 250 : hue, hue === 360);

  if (isDark) {
    css.setProperty("--primary", oklch(0.68, primaryChroma, hue === 360 ? 250 : hue));
    css.setProperty("--primary-foreground", "oklch(0.16 0 0)");
    css.setProperty("--ring", oklch(0.68, primaryChroma, hue === 360 ? 250 : hue, 0.4));
    css.setProperty("--accent", oklch(0.3, accentChroma, acc === 360 ? 250 : acc));
    css.setProperty("--accent-foreground", oklch(0.95, acc === 360 ? 0.01 : 0.08, acc === 360 ? 250 : acc));
    css.setProperty("--sidebar-primary", oklch(0.68, primaryChroma, hue === 360 ? 250 : hue));
    css.setProperty("--sidebar-primary-foreground", "oklch(0.16 0 0)");
    css.setProperty("--sidebar-ring", oklch(0.68, primaryChroma, hue === 360 ? 250 : hue, 0.4));
  } else {
    css.setProperty("--primary", oklch(0.52, primaryChroma, hue === 360 ? 250 : hue));
    css.setProperty("--primary-foreground", "oklch(0.99 0 0)");
    css.setProperty("--ring", oklch(0.52, primaryChroma, hue === 360 ? 250 : hue, 0.4));
    css.setProperty("--accent", oklch(0.95, acc === 360 ? 0.01 : 0.08, acc === 360 ? 250 : acc));
    css.setProperty("--accent-foreground", oklch(0.3, accentChroma, acc === 360 ? 250 : acc));
    css.setProperty("--sidebar-primary", oklch(0.52, primaryChroma, hue === 360 ? 250 : hue));
    css.setProperty("--sidebar-primary-foreground", "oklch(0.99 0 0)");
    css.setProperty("--sidebar-ring", oklch(0.52, primaryChroma, hue === 360 ? 250 : hue, 0.4));
  }

  css.setProperty("--primary-hue", String(hue));
  css.setProperty("--accent-hue", String(acc));
  css.setProperty("--font-family", FONT_VAR[effective.fontFamily]);
  css.setProperty("--font-scale", String(effective.fontScale));
  css.setProperty("--density-gap", DENSITY_GAP[density]);
  css.setProperty("--card-min-width", CARD_WIDTH[effective.cardSize]);
  css.setProperty("--card-max-width", CARD_WIDTH[effective.cardSize]);
  css.setProperty("--sidebar-width", SIDEBAR_WIDTH[effective.sidebarStyle]);
  css.setProperty("--radius", `${Math.min(Math.max(effective.borderRadius, 0), 2)}rem`);

  root.setAttribute("data-surface", tone);
  syncThemeColor(root);

  root.setAttribute(
    "data-appearance",
    JSON.stringify({ ...effective, density })
  );
}
