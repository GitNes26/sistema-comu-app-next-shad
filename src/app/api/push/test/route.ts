import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { persistNotification } from "@/lib/notifications/helpers"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

// POST → te envía una notificación de prueba (bandeja y push) para verificar que llegan.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  const organizationId = effectiveOrgId(session)
  if (!organizationId) return NextResponse.json({ ok: false, error: "Sin iglesia activa" }, { status: 400 })
  const devices = await prisma.pushSubscription.count({ where: { userId: session.user.id } })
  await persistNotification({
    organizationId,
    recipientUserId: session.user.id,
    kind: "test",
    title: "Notificación de prueba",
    body: "Si ves esto, las notificaciones funcionan en este dispositivo.",
    link: "/mi/notificaciones",
  })
  return NextResponse.json({ ok: true, devices, pushConfigured: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) })
}
