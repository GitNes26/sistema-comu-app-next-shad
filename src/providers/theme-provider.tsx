"use client";

import * as React from "react";
import { useThemeStore } from "@/stores/theme-store";
import { applyAppearanceToDom, resolveTheme } from "@/lib/appearance-apply";

const MEDIA_DARK = "(prefers-color-scheme: dark)";

// Aplica el tema y la apariencia del tenant en tiempo real (3.7)
// y sincroniza entre pestañas vía el evento storage (3.5).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const overrides = useThemeStore((s) => s.overrides);
  const tenant = useThemeStore((s) => s.tenant);

  React.useEffect(() => {
    applyAppearanceToDom(theme, tenant, overrides);

    if (theme !== "system") return;

    const media = window.matchMedia(MEDIA_DARK);
    const handler = () => applyAppearanceToDom(theme, tenant, overrides);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme, tenant, overrides]);

  return <>{children}</>;
}

export { resolveTheme };
