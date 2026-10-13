"use client";

import { useCallback, useEffect, useRef } from "react";
import { getDeviceTheme, useThemeStore } from "@/stores/theme-store";
import type { AppSettingsParams } from "@/lib/app-settings-defaults";
import type { ThemeMode } from "@/lib/appearance";

const THEMES = ["system", "light", "dark"] as const;

// FASE 3.1/3.7 — Carga los app_settings de la organización en el store
// (solo memoria); el ThemeProvider ya aplica la mezcla en vivo.
export function AppearanceSync({ tenant }: { tenant: AppSettingsParams | null }) {
  const setTenant = useThemeStore((s) => s.setTenant);
  const setTheme = useThemeStore((s) => s.setTheme);
  const lastAppliedRef = useRef<string>("");

  const applyTenant = useCallback((settings: AppSettingsParams | null) => {
    if (!settings) {
      setTenant(null);
      return;
    }

    // Create a fingerprint to avoid re-applying the same values
    const fingerprint = JSON.stringify(settings);
    if (fingerprint === lastAppliedRef.current) return;
    lastAppliedRef.current = fingerprint;

    setTenant({
      primaryHue: settings.primaryHue,
      accentHue: settings.accentHue,
      fontFamily: settings.fontFamily as never,
      fontScale: settings.fontScale,
      density: settings.density as never,
      borderRadius: settings.borderRadius,
      cardSize: settings.cardSize as never,
      sidebarStyle: settings.sidebarStyle as never,
      surfaceTone: settings.surfaceTone as never,
    });

    // El tema elegido en este dispositivo (toggle del encabezado) manda; si no
    // hay, se sigue el tema de la iglesia.
    const deviceTheme = getDeviceTheme();
    if (deviceTheme) {
      setTheme(deviceTheme);
    } else if (settings.theme && (THEMES as readonly string[]).includes(settings.theme)) {
      setTheme(settings.theme as ThemeMode);
    }
  }, [setTenant, setTheme]);

  useEffect(() => {
    applyTenant(tenant);
  }, [applyTenant, tenant]);

  // Sin tenant (p. ej. antes de cargar) también se respeta el tema del dispositivo.
  useEffect(() => {
    const deviceTheme = getDeviceTheme();
    if (deviceTheme) setTheme(deviceTheme);
  }, [setTheme]);

  useEffect(() => {
    let controller: AbortController | null = null;

    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/settings/appearance", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { settings?: AppSettingsParams };
        if (data.settings) applyTenant(data.settings);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[appearance] no se pudo sincronizar la apariencia", error);
        }
      }
    };

    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyTenant]);

  return null;
}
