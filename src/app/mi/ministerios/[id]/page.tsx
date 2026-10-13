import type { Metadata } from "next"
import { MinistryWorkspace } from "@/components/ministries/ministry-workspace"

export const metadata: Metadata = { title: "Mi ministerio" }

// Espacio de trabajo desde «Mi espacio»: quien lidera el ministerio lo gestiona sin
// necesitar acceso al panel administrativo (el acceso nace de la relación).
export default async function MyMinistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MinistryWorkspace ministryId={id} backHref="/mi/ministerios" backLabel="Mis ministerios" />
}
