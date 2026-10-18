"use client"

import { useState } from "react"
import { setDeviceTheme, useThemeStore } from "@/stores/theme-store"
import {
  mergeAppearance,
  THEMES,
  DENSITIES,
  CARD_SIZES,
  FONT_FAMILIES,
  SIDEBAR_STYLES,
  SURFACE_TONES,
  type SurfaceTone,
  type ThemeMode,
  type Density,
  type CardSize,
  type FontFamily,
  type SidebarStyle,
} from "@/lib/appearance"
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings-defaults"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Check,
  Loader2,
  Monitor,
  Moon,
  Layers,
  Palette,
  Save,
  Sun,
} from "lucide-react"
import { cn } from "@/lib/utils"

const THEME_LABELS: Record<
  ThemeMode,
  { label: string; icon: React.ReactNode }
> = {
  system: { label: "Sistema", icon: <Monitor /> },
  light: { label: "Claro", icon: <Sun /> },
  dark: { label: "Oscuro", icon: <Moon /> },
}

const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compacto",
  comfortable: "Cómodo",
  spacious: "Espacioso",
}

const CARD_LABELS: Record<CardSize, string> = {
  sm: "Pequeñas",
  md: "Medianas",
  lg: "Grandes",
}

const FONT_LABELS: Record<FontFamily, string> = {
  poppins: "Poppins",
  montserrat: "Montserrat",
  afacad: "Afacad",
  system: "Sistema",
}

const SIDEBAR_LABELS: Record<SidebarStyle, string> = {
  full: "Completa",
  compact: "Compacta",
  icon: "Iconos",
}

const SURFACE_LABELS: Record<SurfaceTone, { label: string; helper: string }> = {
  neutral: { label: "Neutro", helper: "Blanco y negro puros" },
  subtle: { label: "Sutil", helper: "Un matiz casi imperceptible" },
  tinted: { label: "Marcado", helper: "El color de la marca se siente" },
}

// Rampas mínimas para la muestra (lienzo, tarjeta, borde) — mismas cifras
// que appearance-apply, reducidas a lo que la miniatura necesita.
const SURFACE_PREVIEW: Record<SurfaceTone, { light: [number, number][]; dark: [number, number][] }> = {
  neutral: { light: [[1, 0], [1, 0], [0.922, 0]], dark: [[0.145, 0], [0.205, 0], [0.3, 0]] },
  subtle: { light: [[0.984, 0.003], [1, 0], [0.912, 0.008]], dark: [[0.155, 0.006], [0.198, 0.008], [0.295, 0.01]] },
  tinted: { light: [[0.972, 0.011], [0.995, 0.003], [0.895, 0.02]], dark: [[0.168, 0.018], [0.212, 0.022], [0.31, 0.026]] },
}

function SurfaceTonePicker({
  value,
  hue,
  onChange,
}: {
  value: SurfaceTone
  hue: number
  onChange: (v: SurfaceTone) => void
}) {
  const h = hue === 360 ? 250 : hue
  const chromaOn = hue !== 360
  const col = ([l, c]: [number, number]) => `oklch(${l} ${chromaOn ? c : 0} ${h})`
  return (
    <div role="radiogroup" aria-label="Tono de fondo" className="grid grid-cols-3 gap-2">
      {SURFACE_TONES.map((tone) => {
        const active = tone === value
        const p = SURFACE_PREVIEW[tone]
        return (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tone)}
            className={cn(
              "press group flex flex-col gap-2 rounded-xl border p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/25"
            )}
          >
            <span className="grid h-16 grid-cols-2 overflow-hidden rounded-lg border" style={{ borderColor: col(p.light[2]) }}>
              {[p.light, p.dark].map((ramp, i) => (
                <span key={i} className="relative block" style={{ background: col(ramp[0]) }}>
                  <span
                    className="absolute inset-x-2 top-2 bottom-2 rounded-md border"
                    style={{ background: col(ramp[1]), borderColor: col(ramp[2]) }}
                  />
                </span>
              ))}
            </span>
            <span className="px-0.5">
              <span className="flex items-center gap-1 text-sm font-medium">
                {SURFACE_LABELS[tone].label}
                {active && <Check className="size-3.5 text-primary" />}
              </span>
              <span className="block text-xs leading-snug text-muted-foreground">
                {SURFACE_LABELS[tone].helper}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const COLOR_PRESETS = [
  { label: "Comunidad (marca)", primary: 245, accent: 215 },
  { label: "Esmeralda", primary: 160, accent: 210 },
  { label: "Turquesa", primary: 180, accent: 35 },
  { label: "Cian", primary: 195, accent: 15 },
  { label: "Azul", primary: 220, accent: 280 },
  { label: "Índigo", primary: 245, accent: 165 },
  { label: "Violeta", primary: 270, accent: 330 },
  { label: "Magenta", primary: 305, accent: 185 },
  { label: "Rosa", primary: 330, accent: 20 },
  { label: "Coral", primary: 12, accent: 205 },
  { label: "Naranja", primary: 25, accent: 200 },
  { label: "Ámbar", primary: 45, accent: 260 },
  { label: "Amarillo", primary: 90, accent: 225 },
  { label: "Lima", primary: 105, accent: 285 },
  { label: "Rojo", primary: 0, accent: 220 },
  { label: "Gris", primary: 360, accent: 360 },
]

function Swatch({ hue }: { hue: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="size-5 rounded-md border"
        style={{ background: hue === 360 ? "var(--muted-foreground)" : `oklch(0.55 0.14 ${hue})` }}
      />
      <span className="font-mono text-xs text-muted-foreground">{hue}°</span>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T
  options: readonly T[]
  labels:
    Record<T, string> | Record<T, { label: string; icon: React.ReactNode }>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const item = labels[opt]
        const isString = typeof item === "string"
        const label = isString
          ? (item as string)
          : (item as { label: string }).label
        const icon = !isString ? (item as { icon: React.ReactNode }).icon : null
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors desk:h-8 [&_svg]:size-4",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {icon}
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function AppearanceSettingsForm() {
  const theme = useThemeStore((s) => s.theme)
  const tenant = useThemeStore((s) => s.tenant)
  const overrides = useThemeStore((s) => s.overrides)
  const setTheme = useThemeStore((s) => s.setTheme)
  const setOverride = useThemeStore((s) => s.setAppearanceOverride)
  const resetOverrides = useThemeStore((s) => s.resetAppearanceOverrides)
  const setTenant = useThemeStore((s) => s.setTenant)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const appearance = mergeAppearance(tenant, overrides)

  function applyLocal(patch: Partial<typeof appearance>) {
    setOverride(patch)
  }

  async function saveForCompany() {
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/settings/appearance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, ...appearance }),
    })
    const data = (await res.json().catch(() => null)) as {
      settings?: typeof DEFAULT_APP_SETTINGS
    } | null
    setSaving(false)
    if (!res.ok) return
    setTenant({
      primaryHue: data!.settings!.primaryHue,
      accentHue: data!.settings!.accentHue,
      fontFamily: data!.settings!.fontFamily as never,
      fontScale: data!.settings!.fontScale,
      density: data!.settings!.density as never,
      borderRadius: data!.settings!.borderRadius,
      cardSize: data!.settings!.cardSize as never,
      sidebarStyle: data!.settings!.sidebarStyle as never,
      surfaceTone: data!.settings!.surfaceTone as never,
    })
    // Sync theme mode from API response
    if (data?.settings?.theme && (THEMES as readonly string[]).includes(data.settings.theme)) {
      setTheme(data.settings.theme as ThemeMode)
    }
    resetOverrides()
    // Guardar para la iglesia: este dispositivo vuelve a seguir el tema de la iglesia.
    setDeviceTheme(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function resetCompany() {
    setSaving(true)
    const res = await fetch("/api/settings/appearance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_APP_SETTINGS),
    })
    setSaving(false)
    if (!res.ok) return
    setTenant({ ...DEFAULT_APP_SETTINGS } as never)
    setTheme(DEFAULT_APP_SETTINGS.theme as ThemeMode)
    resetOverrides()
  }

  return (
    <div className="mx-auto w-full space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apariencia</h1>
          <p className="text-sm text-muted-foreground">
            Tema y estilo del sistema para toda la iglesia. Los cambios se
            aplican al instante.
          </p>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <Check /> Guardado
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="size-4" /> Tema
          </CardTitle>
          <CardDescription>
            Claro, oscuro o siguiendo el sistema del dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            value={theme}
            options={THEMES}
            labels={THEME_LABELS}
            onChange={setTheme}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4" /> Tono de fondo
          </CardTitle>
          <CardDescription>
            Cuánto se tiñen el fondo, las tarjetas y los bordes con tu color
            primario. Sutil reduce la fatiga visual en jornadas largas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SurfaceTonePicker
            value={appearance.surfaceTone}
            hue={appearance.primaryHue}
            onChange={(v) => applyLocal({ surfaceTone: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" /> Colores
          </CardTitle>
          <CardDescription>
            El tono primario para botones/acciones y el de acento para
            resaltados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label3 helper="Selección rápida de paleta">Preestablecidos</Label3>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyLocal({ primaryHue: preset.primary, accentHue: preset.accent })}
                  className="group flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium desk:min-h-0 desk:px-2.5 transition-colors hover:border-primary/40"
                  title={preset.label}
                >
                  <span
                    className="size-4 rounded-full border"
                    style={{ background: preset.primary === 360 ? "var(--muted-foreground)" : `oklch(0.55 0.14 ${preset.primary})` }}
                  />
                  <span
                    className="size-4 rounded-full border"
                    style={{ background: preset.accent === 360 ? "var(--muted)" : `oklch(0.55 0.10 ${preset.accent})` }}
                  />
                  <span className="hidden sm:inline text-muted-foreground group-hover:text-foreground">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label3 helper="Verde, azul, naranja…">Color primario</Label3>
              <Swatch hue={appearance.primaryHue} />
            </div>
            <Slider
              aria-label="Color primario: rojo, amarillo, verde, azul, violeta o gris"
              className="[&_[data-slot=slider-track]]:bg-[linear-gradient(90deg,#dc2626_0%,#eab308_17%,#16a34a_33%,#0891b2_50%,#2563eb_62%,#7c3aed_75%,#db2777_88%,#6b7280_100%)] [&_[data-slot=slider-range]]:bg-transparent"
              min={0}
              max={360}
              step={1}
              value={[appearance.primaryHue]}
              onValueChange={(v) => applyLocal({ primaryHue: v[0] })}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label3 helper="Usado en acentos y estados seleccionados">
                Color de acento
              </Label3>
              <Swatch hue={appearance.accentHue} />
            </div>
            <Slider
              aria-label="Color de acento: rojo, amarillo, verde, azul, violeta o gris"
              className="[&_[data-slot=slider-track]]:bg-[linear-gradient(90deg,#dc2626_0%,#eab308_17%,#16a34a_33%,#0891b2_50%,#2563eb_62%,#7c3aed_75%,#db2777_88%,#6b7280_100%)] [&_[data-slot=slider-range]]:bg-transparent"
              min={0}
              max={360}
              step={1}
              value={[appearance.accentHue]}
              onValueChange={(v) => applyLocal({ accentHue: v[0] })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipografía y escala</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label3>Tipografía</Label3>
            <Segmented
              value={appearance.fontFamily}
              options={FONT_FAMILIES}
              labels={FONT_LABELS}
              onChange={(v) => applyLocal({ fontFamily: v })}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label3>Escala de texto</Label3>
              <span className="font-mono text-xs text-muted-foreground">
                {appearance.fontScale.toFixed(2)}×
              </span>
            </div>
            <Slider
              min={0.85}
              max={1.3}
              step={0.05}
              value={[appearance.fontScale]}
              onValueChange={(v) =>
                applyLocal({ fontScale: Number(v[0].toFixed(2)) })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Espacio y densidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label3>Densidad</Label3>
            <Segmented
              value={appearance.density}
              options={DENSITIES}
              labels={DENSITY_LABELS}
              onChange={(v) => applyLocal({ density: v })}
            />
          </div>
          <div className="space-y-3">
            <Label3>Radio de bordes</Label3>
            <div className="flex items-center gap-3">
              <Slider
                min={0}
                max={2}
                step={0.125}
                value={[appearance.borderRadius]}
                onValueChange={(v) => applyLocal({ borderRadius: v[0] })}
              />
              <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                {appearance.borderRadius.toFixed(2)}rem
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarjetas y navegación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label3>Tamaño de tarjetas de catálogo</Label3>
            <Segmented
              value={appearance.cardSize}
              options={CARD_SIZES}
              labels={CARD_LABELS}
              onChange={(v) => applyLocal({ cardSize: v })}
            />
          </div>
          <div className="space-y-3">
            <Label3>Estilo de barra lateral</Label3>
            <Segmented
              value={appearance.sidebarStyle}
              options={SIDEBAR_STYLES}
              labels={SIDEBAR_LABELS}
              onChange={(v) => applyLocal({ sidebarStyle: v })}
            />
          </div>
        </CardContent>
      </Card>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void saveForCompany()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar para la iglesia
        </Button>
        <Button
          variant="outline"
          onClick={() => void resetCompany()}
          disabled={saving}
        >
          Restablecer valores de la iglesia
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        La iglesia es la fuente de verdad. La vista previa se aplica en este
        dispositivo y se conserva al guardar para la organización activa.
      </p>
    </div>
  )
}

function Label3({
  children,
  helper,
}: {
  children: React.ReactNode
  helper?: string
}) {
  return (
    <div>
      <p className="text-sm font-medium">{children}</p>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}
