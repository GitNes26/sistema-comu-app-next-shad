import { prisma } from "@/lib/db"
import { fireAndForget, notifyMembers } from "@/lib/notifications/church"
import { THEOLOGY_CREDENTIALS } from "@/lib/school/points"

// Credenciales del trayecto (Certificado, Asociado, Diplomado, Licenciatura…). Se otorgan
// al aprobar un curso del programa universitario; una por persona y curso.

async function nextSerial(organizationId: string, year: number) {
  const count = await prisma.credential.count({ where: { organizationId, serial: { startsWith: `CRD-${year}-` } } })
  return `CRD-${year}-${String(count + 1).padStart(4, "0")}`
}

/** Nombre de la credencial de un curso: la propia o, si no la tiene, la del año del trayecto. */
export function credentialNameFor(course: { credential: string | null; year: number | null }): string | null {
  if (course.credential?.trim()) return course.credential.trim()
  if (course.year && course.year >= 1 && course.year <= THEOLOGY_CREDENTIALS.length) return THEOLOGY_CREDENTIALS[course.year - 1]
  return null
}

export async function issueCredential(
  organizationId: string,
  input: { memberId: string; schoolId: string; course: { id: string; credential: string | null; year: number | null }; points: number | null }
) {
  const name = credentialNameFor(input.course)
  if (!name) return null
  const existing = await prisma.credential.findUnique({ where: { memberId_courseId: { memberId: input.memberId, courseId: input.course.id } } })
  if (existing) return existing
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.credential.create({
        data: {
          organizationId,
          schoolId: input.schoolId,
          courseId: input.course.id,
          memberId: input.memberId,
          year: input.course.year,
          name,
          points: input.points,
          serial: await nextSerial(organizationId, year),
        },
      })
      fireAndForget(
        notifyMembers(organizationId, [input.memberId], {
          kind: "growth",
          severity: "success",
          title: `Obtuviste: ${name}`,
          body: "Tu credencial ya aparece en tu trayecto.",
          link: "/mi/escuela",
        })
      )
      return row
    } catch (err) {
      if (!(typeof err === "object" && err && (err as { code?: string }).code === "P2002")) throw err
    }
  }
  return null
}
