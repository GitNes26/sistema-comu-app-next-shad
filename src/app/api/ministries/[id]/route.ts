import { NextResponse } from "next/server"
import { getWorkspace } from "@/lib/ministries/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Espacio de trabajo de un ministerio (miembros, reuniones y, para quien gestiona, requisiciones).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, workspace: await getWorkspace(ctx.actor, id) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
