import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileForm } from "@/components/portal/profile-form"

export const metadata: Metadata = { title: "Mi perfil" }

export default function MyProfilePage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">Mantén al día tus datos de contacto.</p>
      </div>
      <ProfileForm />
    </div>
  )
}
