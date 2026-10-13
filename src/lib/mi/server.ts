import { prisma } from "@/lib/db"
import type { $Enums } from "@/generated/prisma/client"
import { listMyMinistries } from "@/lib/ministries/server"

// Datos de «Mi espacio»: SIEMPRE se resuelven por la sesión (usuario + iglesia
// efectiva). El cliente nunca elige a qué creyente consulta.

export interface MyStageEntry {
  stage: $Enums.VisionStage
  changedAt: string
}

export interface MySpace {
  ministries: { id: string; name: string; role: "leader" | "assistant" | "servant" }[]
  member: {
    id: string
    fullName: string
    hierarchy: $Enums.ChurchHierarchy
    visionStage: $Enums.VisionStage
    baptizedWater: boolean
    baptizedWaterAt: string | null
    baptizedFire: boolean
    baptizedFireAt: string | null
    encounterAt: string | null
    launchAt: string | null
    imageUrl: string | null
    locationName: string | null
    discipleOfName: string | null
  } | null
  stages: MyStageEntry[]
  church: {
    name: string
    description: string | null
    logoUrl: string | null
    phone: string | null
    email: string | null
    website: string | null
    address: string | null
    socialLinks: Record<string, string>
    donations: {
      bank: string | null
      holder: string | null
      clabe: string | null
      account: string | null
      card: string | null
      link: string | null
      note: string | null
    } | null
  }
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export async function getMySpace(userId: string, organizationId: string): Promise<MySpace> {
  const [org, profile, member] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId } }),
    prisma.member.findFirst({
      where: { organizationId, userId },
      include: {
        location: { select: { name: true } },
        discipler: { select: { fullName: true } },
        stageLogs: { orderBy: { changedAt: "asc" }, select: { stage: true, changedAt: true } },
      },
    }),
  ])

  const social = (profile?.socialLinks ?? {}) as Record<string, unknown>
  const socialLinks = Object.fromEntries(
    Object.entries(social).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0)
  )

  const ministries = await listMyMinistries(organizationId, userId)

  return {
    ministries: ministries.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    member: member
      ? {
          id: member.id,
          fullName: member.fullName,
          hierarchy: member.hierarchy,
          visionStage: member.visionStage,
          baptizedWater: member.baptizedWater,
          baptizedWaterAt: iso(member.baptizedWaterAt),
          baptizedFire: member.baptizedFire,
          baptizedFireAt: iso(member.baptizedFireAt),
          encounterAt: iso(member.encounterAt),
          launchAt: iso(member.launchAt),
          imageUrl: member.imageUrl,
          locationName: member.location?.name ?? null,
          discipleOfName: member.discipler?.fullName ?? null,
        }
      : null,
    stages: (member?.stageLogs ?? []).map((l) => ({ stage: l.stage, changedAt: l.changedAt.toISOString() })),
    church: {
      name: profile?.tradeName ?? org?.name ?? "Tu iglesia",
      description: profile?.description ?? null,
      logoUrl: profile?.logoUrl ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      website: profile?.website ?? null,
      address: [profile?.address, profile?.city, profile?.state].filter(Boolean).join(", ") || null,
      socialLinks,
      donations: profile?.donationsEnabled
        ? {
            bank: profile.donationBank,
            holder: profile.donationHolder,
            clabe: profile.donationClabe,
            account: profile.donationAccount,
            card: profile.donationCard,
            link: profile.donationLink,
            note: profile.donationNote,
          }
        : null,
    },
  }
}
