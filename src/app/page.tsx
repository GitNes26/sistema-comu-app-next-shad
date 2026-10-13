import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { homeForSession } from "@/lib/auth/redirect"

// La entrada del sistema no tiene página pública: lleva al acceso o, con sesión,
// a «Mi espacio» (creyente) o al panel (quien opera la iglesia).
export default async function HomePage() {
  const session = await getServerSession(authOptions)
  redirect(session?.user ? homeForSession(session) : "/auth/login")
}
