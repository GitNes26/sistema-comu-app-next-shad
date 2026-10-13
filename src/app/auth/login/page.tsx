import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { homeForSession } from "@/lib/auth/redirect"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import packageJson from "../../../../package.json"

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso a COMU-APP.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = await searchParams
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null
  const error = typeof params.error === "string" ? params.error : null

  const session = await getServerSession(authOptions)
  if (session?.user) redirect(homeForSession(session))

  return (
    <AuthShell
      footerLinks={
        <>
          <Link href="/auth/forgot" className="hover:text-foreground hover:underline">
            Recuperar contraseña o activar cuenta
          </Link>
          <span>
            © {new Date().getFullYear()} COMU-APP v{packageJson.version}
          </span>
        </>
      }
    >
      <LoginForm callbackUrl={callbackUrl} error={error} />
    </AuthShell>
  )
}
