"use client"

import { HandHeart } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

// Estado vacío de «Mis ministerios». Vive en un componente de cliente porque el ícono es
// una función: una página de servidor no puede pasársela a otro componente de cliente.
export function NoMinistries() {
  return <EmptyState icon={HandHeart} title="Aún no sirves en un ministerio" description="Cuando te integren a uno, aparecerá aquí con sus reuniones y su lista." />
}
