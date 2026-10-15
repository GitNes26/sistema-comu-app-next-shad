import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { searchCells } from "@/lib/cells/finder"

export const dynamic = "force-dynamic"

const num = (v: string | null) => {
  if (v === null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Pública: hogares de amor (células) cercanos. Solo tipo, colonia, día y hora y una
// distancia aproximada; nunca la dirección exacta ni datos de las personas.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = await prisma.companyProfile.findFirst({ where: { publicSlug: slug, publicEnabled: true }, select: { organizationId: true } })
  if (!profile) return NextResponse.json({ ok: false, error: "Iglesia no encontrada" }, { status: 404 })
  const q = new URL(req.url).searchParams
  const lat = num(q.get("lat"))
  const lng = num(q.get("lng"))
  const result = await searchCells(profile.organizationId, {
    lat: lat !== null && lat >= -90 && lat <= 90 ? lat : null,
    lng: lng !== null && lng >= -180 && lng <= 180 ? lng : null,
    typeId: q.get("type"),
    q: (q.get("q") ?? "").slice(0, 60),
  })
  return NextResponse.json({ ok: true, ...result })
}
