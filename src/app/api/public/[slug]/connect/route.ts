import { NextResponse } from "next/server"
import { CrudError } from "@/lib/crud/types"
import { submitConnection } from "@/lib/connect/server"

export const dynamic = "force-dynamic"

// Pública y sin sesión: una persona deja su tarjeta de conexión («Soy nuevo»,
// «Grupo en casa»…). La iglesia sale del `slug`; el cuerpo nunca elige la iglesia.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") throw new CrudError("Solicitud inválida", 400)
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local"
    return NextResponse.json(await submitConnection(slug, ip, body), { status: 201 })
  } catch (err) {
    if (err instanceof CrudError) return NextResponse.json({ ok: false, error: err.message, field: err.field ?? null }, { status: err.status })
    console.error("[public-connect]", err)
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 })
  }
}
