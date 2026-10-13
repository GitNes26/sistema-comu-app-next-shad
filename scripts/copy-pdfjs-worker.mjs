// Copia al /public lo que el navegador y el generador de PDF necesitan de node_modules:
//  - el worker de pdf.js (visor del libro digital)
//  - la tipografía cursiva de los diplomas (Dancing Script, legible y elegante)
// Se ejecuta tras `npm install`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const files = [
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdfjs/pdf.worker.min.mjs"],
  ["node_modules/@fontsource/dancing-script/files/dancing-script-latin-600-normal.woff", "public/fonts/diploma/dancing-script-600.woff"],
  ["node_modules/@fontsource/dancing-script/files/dancing-script-latin-600-normal.woff2", "public/fonts/diploma/dancing-script-600.woff2"],
]
for (const [from, to] of files) {
  const src = join(root, from)
  if (!existsSync(src)) continue
  const dest = join(root, to)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`copiado ${to}`)
}
