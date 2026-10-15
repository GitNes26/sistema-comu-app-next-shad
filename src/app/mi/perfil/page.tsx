import type { Metadata } from "next"
import { UserRound } from "lucide-react"
import { PageHero } from "@/components/mi/page-hero"
import { ProfileForm } from "@/components/portal/profile-form"

export const metadata: Metadata = { title: "Mi perfil" }

export default function MyProfilePage() {
  return (
    <div className="w-full space-y-5">
      <PageHero icon={UserRound} title="Mi perfil" description="Mantén al día tus datos de contacto." />
      <ProfileForm />
    </div>
  )
}
