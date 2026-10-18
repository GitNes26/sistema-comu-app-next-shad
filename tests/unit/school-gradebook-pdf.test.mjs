import test from "node:test"
import assert from "node:assert/strict"
import { renderGradebookPdf } from "../../src/lib/school/gradebook-pdf.ts"

const row = (i, extra = {}) => ({
  enrollmentId: `e${i}`,
  memberId: `m${i}`,
  name: `Alumno ${i}`,
  status: "enrolled",
  attendance: { 1: "present", 2: i % 2 ? "absent" : "excused", 3: "present" },
  tasks: {},
  exercises: {},
  tasksAvg: 8.5,
  exercisesAvg: 9,
  finalGrade: 8.8,
  passed: i % 3 === 0 ? true : null,
  points: 40,
  balance: 0,
  ...extra,
})

test("la lista de asistencia del grupo se genera en PDF, también con muchos alumnos", async () => {
  const book = {
    group: { id: "g1", name: "Grupo A", status: "open", courseId: "c1", courseName: "¿Quién es Jesús?", schoolKind: "ministry", weeks: 8, tasksCount: 7, exercisesCount: 7, passScore: 7, pointsToPass: 30, teacherName: "Maestro Uno", assistantName: null, startDate: "2026-10-04", endDate: "2026-11-29", capacity: 30 },
    sessions: [{ week: 1, date: "2026-10-04", topic: null }, { week: 2, date: "2026-10-11", topic: null }],
    assessments: [],
    rows: Array.from({ length: 45 }, (_, i) => row(i + 1)),
    requests: [],
    pendingReviews: 0,
    access: { canManage: true, canTeach: true },
  }
  const pdf = await renderGradebookPdf(book, { organizationName: "Comunidad Torreón", logo: null })
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-")
  const universityPdf = await renderGradebookPdf({ ...book, group: { ...book.group, schoolKind: "university", weeks: 16 }, rows: [] }, { organizationName: "Comunidad Torreón", logo: null })
  assert.equal(universityPdf.subarray(0, 5).toString(), "%PDF-")
})
