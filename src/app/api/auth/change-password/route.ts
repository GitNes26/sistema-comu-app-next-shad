import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { changePassword, issuePasswordChangeCode } from "@/lib/auth/users"
import { mailConfigured, sendPasswordChangeCode } from "@/lib/auth/mail"

// Cambio de contraseña (sesión obligatoria).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    oldPassword?: string
    newPassword?: string
    code?: string
    action?: "request-code"
  } | null

  if (body?.action === "request-code") {
    if (!mailConfigured()) return NextResponse.json({ error: "El correo no está configurado" }, { status: 503 })
    const issued = await issuePasswordChangeCode(session.user.id)
    if (!issued) return NextResponse.json({ error: "Usuario no disponible" }, { status: 400 })
    await sendPasswordChangeCode(issued.email, issued.code)
    return NextResponse.json({ ok: true, maskedEmail: issued.email.replace(/(^.).*(@.*$)/, "$1***$2") })
  }

  const oldPassword = body?.oldPassword
  const newPassword = body?.newPassword
  const code = body?.code

  if (!oldPassword || !newPassword || !code || newPassword.length < 8) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    )
  }
  if (oldPassword === newPassword) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente" },
      { status: 400 }
    )
  }

  const result = await changePassword(session.user.id, oldPassword, newPassword, code)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "No se pudo cambiar" },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true })
}
