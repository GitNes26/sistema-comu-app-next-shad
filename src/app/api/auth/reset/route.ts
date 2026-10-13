import { NextResponse } from "next/server"
import { applyPasswordResetToken } from "@/lib/auth/users"

// Aplicar token de reset y nueva contraseña.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: string
    password?: string
    acceptedLegal?: boolean
  } | null

  const token = body?.token?.trim()
  const password = body?.password

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    )
  }
  if (body?.acceptedLegal !== true) {
    return NextResponse.json({ error: "Debes aceptar los términos y el aviso de privacidad" }, { status: 400 })
  }

  const result = await applyPasswordResetToken(token, password, true)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
