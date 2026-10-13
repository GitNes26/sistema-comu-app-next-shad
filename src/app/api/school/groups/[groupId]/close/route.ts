import { NextResponse } from "next/server"
import { closeGroup } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST → cierra el grupo: calcula promedios y aprueba o reprueba.
export async function POST(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    return NextResponse.json(await closeGroup(ctx.actor, groupId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
