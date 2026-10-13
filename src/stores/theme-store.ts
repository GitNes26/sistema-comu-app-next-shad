import { create } from "zustand";
import type {
  ThemeMode,
  AppearanceParams,
} from "@/lib/appearance";

interface ThemeState {
  // La iglesia es la fuente de verdad; los overrides solo sirven como vista previa.
  theme: ThemeMode;
  overrides: Partial<AppearanceParams>;
  // Preferencias del tenant (desde app_settings de la organización; no persistidas)
  tenant: Partial<AppearanceParams> | null;

  setTheme: (theme: ThemeMode) => void;
  setAppearanceOverride: (patch: Partial<AppearanceParams>) => void;
  resetAppearanceOverrides: () => void;
  setTenant: (tenant: Partial<AppearanceParams> | null) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
      theme: "system",
      overrides: {},
      tenant: null,

      setTheme: (theme) => set({ theme }),
      setAppearanceOverride: (patch) =>
        set((s) => ({ overrides: { ...s.overrides, ...patch } })),
      resetAppearanceOverrides: () => set({ overrides: {} }),
      setTenant: (tenant) => set({ tenant }),
}));

// Preferencia de tema del dispositivo (toggle del encabezado). Tiene prioridad
// sobre el tema de la iglesia en este equipo/teléfono; "Guardar para la
// iglesia" en Apariencia la limpia para volver a seguir a la iglesia.
const DEVICE_THEME_KEY = "comu-app-device-theme";

export function getDeviceTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(DEVICE_THEME_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

export function setDeviceTheme(theme: ThemeMode | null): void {
  try {
    if (theme) localStorage.setItem(DEVICE_THEME_KEY, theme);
    else localStorage.removeItem(DEVICE_THEME_KEY);
  } catch {
    // almacenamiento no disponible (modo privado): el tema vive solo en la sesión
  }
}
