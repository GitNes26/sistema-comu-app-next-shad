import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Reuniones recurrentes públicas de la iglesia del usuario («Tu semana en casa»).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const slots = await prisma.gatheringSeries.findMany({
      where: { organizationId: ctx.actor.organizationId, isActive: true, isPublic: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true, modality: true, description: true },
    })
    return NextResponse.json({ ok: true, slots })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
