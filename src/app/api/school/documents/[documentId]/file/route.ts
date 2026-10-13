import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"
import { readDocumentFile } from "@/lib/school/documents"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET → el archivo, solo con las páginas que la persona puede ver. Nunca se cachea en público.
export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { documentId } = await params
    const file = await readDocumentFile(ctx.actor, documentId)
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
