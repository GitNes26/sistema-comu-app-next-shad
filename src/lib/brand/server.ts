import { cache } from "react"
import { prisma } from "@/lib/db"

// Identidad de la iglesia para las pantallas sin sesión (acceso, splash, ícono de la app).
// COMU-APP se opera para una sola iglesia: se toma la primera organización y el logo que
// cargó en «Datos de la iglesia».

export const CHURCH_MOTTO = "Familia es lo que somos, comunidad es lo que hacemos"

export interface ChurchBrand {
  name: string
  logoUrl: string | null
}

export const getChurchBrand = cache(async (): Promise<ChurchBrand> => {
  try {
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true, companyProfile: { select: { tradeName: true, logoUrl: true } } },
    })
    return { name: org?.companyProfile?.tradeName ?? org?.name ?? "COMU-APP", logoUrl: org?.companyProfile?.logoUrl ?? null }
  } catch {
    return { name: "COMU-APP", logoUrl: null }
  }
})
