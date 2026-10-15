// Parámetros de apariencia por organización y sus valores por defecto.
// Módulo puro (sin Prisma): lo importan componentes de cliente y el servidor.

export type AppSettingsParams = {
  theme: string;
  primaryHue: number;
  accentHue: number;
  fontFamily: string;
  fontScale: number;
  density: string;
  borderRadius: number;
  cardSize: string;
  sidebarStyle: string;
  surfaceTone: string;
};

export const DEFAULT_APP_SETTINGS: AppSettingsParams = {
  theme: "system",
  primaryHue: 245,
  accentHue: 215,
  fontFamily: "poppins",
  fontScale: 1,
  density: "comfortable",
  borderRadius: 0.75,
  cardSize: "md",
  sidebarStyle: "full",
  surfaceTone: "subtle",
};
