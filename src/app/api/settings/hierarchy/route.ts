import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { assertPermission } from "@/lib/auth/server-permissions"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { getHierarchy, saveHierarchy } from "@/lib/org/hierarchy-server"
import { CrudError } from "@/lib/crud/types"

export const dynamic = "force-dynamic"

// GET: nombres de la jerarquía de la iglesia (los usa toda la app). PUT: edición (settings.manage).
export async function GET() {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!session?.user?.id || !organizationId) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  return NextResponse.json({ ok: true, hierarchy: await getHierarchy(organizationId) }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!session?.user?.id || !organizationId) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  try {
    assertPermission(session, "settings.manage")
  } catch {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }
  try {
    const body = (await req.json().catch(() => null)) as { hierarchy?: unknown } | null
    if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
    return NextResponse.json({ ok: true, hierarchy: await saveHierarchy(organizationId, body.hierarchy) })
  } catch (err) {
    if (err instanceof CrudError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
