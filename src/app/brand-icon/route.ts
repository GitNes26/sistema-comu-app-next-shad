import { readFile } from "node:fs/promises"
import path from "node:path"
import { loadLogoPng } from "@/lib/documents/branding"
import { getChurchBrand } from "@/lib/brand/server"

export const dynamic = "force-dynamic"

// Ícono de la app (pestaña, PWA, pantalla de inicio): el logo que la iglesia cargó; si aún
// no lo ha cargado, el ícono de marca incluido en el proyecto.
export async function GET() {
  const brand = await getChurchBrand()
  const logo = await loadLogoPng(brand.logoUrl, 512)
  const body = logo?.buffer ?? (await readFile(path.join(process.cwd(), "public", "images", "icon_dark.png")))
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  })
}
