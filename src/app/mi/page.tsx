import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { getMySpace } from "@/lib/mi/server"
import { MySpaceView } from "@/components/mi/my-space"

export const metadata: Metadata = { title: "Mi espacio" }

// «Mi espacio»: lo propio del creyente (camino en la visión, bautismos, datos de
// su iglesia). Todo se resuelve por la sesión; no recibe ids por parámetro.
export default async function MiPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const organizationId = effectiveOrgId(session)
  if (!organizationId) redirect(session.user.scope === "superadmin" ? "/admin/settings/organizations" : "/auth/onboarding")

  const space = await getMySpace(session.user.id, organizationId)
  return <MySpaceView space={space} firstName={session.user.name?.split(" ")[0] ?? null} />
}
