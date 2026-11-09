#!/usr/bin/env node
/**
 * generate-icons.mjs — genera los íconos de la app a partir del logo de marca.
 *
 * Convención de nombres (igual que en public/images y public/icons):
 *   - «icon.png» / «icon.ico»        → versión CLARA: se usa con tema oscuro.
 *   - «icon_dark.png» / «icon_dark.ico» → versión OSCURA: se usa con tema claro.
 *
 * Salida (public/icons y public/favicon.ico):
 *   favicon-32.png / favicon-32-dark.png   pestaña del navegador (según el tema)
 *   icon-192.png / icon-512.png            PWA y notificaciones (logo claro sobre fondo de marca)
 *   icon-maskable-512.png                  PWA maskable (zona segura del 80 %)
 *   apple-touch-icon.png                   pantalla de inicio de iOS
 *   ../favicon.ico                         copia de icons/icon.ico en la raíz pública
 *
 * Uso:  node scripts/generate-icons.mjs
 */
import { copyFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const IMAGES = join(ROOT, "public", "images")
const ICONS = join(ROOT, "public", "icons")
const BRAND_BG = "#0f172a"

const light = join(IMAGES, "icon.png") // logo claro (para fondos oscuros)
const dark = join(IMAGES, "icon_dark.png") // logo oscuro (para fondos claros)

/** Logo centrado en un cuadrado; `padding` es la fracción de margen a cada lado. */
async function square(src, size, { background, padding = 0.08 }) {
  const inner = Math.round(size * (1 - padding * 2))
  const logo = await sharp(src).trim().resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
}

await (await square(dark, 32, { padding: 0.04 })).toFile(join(ICONS, "favicon-32.png"))
await (await square(light, 32, { padding: 0.04 })).toFile(join(ICONS, "favicon-32-dark.png"))
await (await square(light, 192, { background: BRAND_BG, padding: 0.14 })).toFile(join(ICONS, "icon-192.png"))
await (await square(light, 512, { background: BRAND_BG, padding: 0.14 })).toFile(join(ICONS, "icon-512.png"))
await (await square(light, 512, { background: BRAND_BG, padding: 0.24 })).toFile(join(ICONS, "icon-maskable-512.png"))
await (await square(light, 180, { background: BRAND_BG, padding: 0.14 })).toFile(join(ICONS, "apple-touch-icon.png"))
copyFileSync(join(ICONS, "icon.ico"), join(ROOT, "public", "favicon.ico"))
console.log("Íconos generados en public/icons y public/favicon.ico")
