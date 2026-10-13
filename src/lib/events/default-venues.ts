import type { Layout } from "@/lib/events/rules"

// Áreas iniciales de la iglesia, con un plano de ejemplo que se puede rediseñar:
// Auditorio Principal, Auditorio Menor y Área de Comunidad Kids.

export interface DefaultVenue {
  name: string
  description: string
  kind: "auditorium" | "kids" | "other"
  planWidth: number
  planHeight: number
  layout: Layout
}

export function defaultVenueLayouts(): DefaultVenue[] {
  const colors = ["#2563eb", "#16a34a", "#d97706"]
  return [
    {
      name: "Auditorio Principal",
      description: "Auditorio de las reuniones generales.",
      kind: "auditorium",
      planWidth: 1100,
      planHeight: 640,
      layout: {
        sections: [
          { id: "izq", name: "Izquierda", color: colors[0] },
          { id: "cen", name: "Centro", color: colors[1] },
          { id: "der", name: "Derecha", color: colors[2] },
        ],
        elements: [
          { id: "stage", type: "stage", x: 300, y: 14, w: 500, h: 60, label: "Plataforma" },
          { id: "izq", type: "block", x: 60, y: 120, rows: 12, cols: 8, prefix: "I", sectionId: "izq", label: "Izquierda" },
          { id: "cen", type: "block", x: 400, y: 120, rows: 12, cols: 10, prefix: "C", sectionId: "cen", label: "Centro" },
          { id: "der", type: "block", x: 800, y: 120, rows: 12, cols: 8, prefix: "D", sectionId: "der", label: "Derecha" },
          { id: "door", type: "door", x: 500, y: 600, w: 100, h: 24, label: "Entrada" },
        ],
        blocked: [],
      },
    },
    {
      name: "Auditorio Menor",
      description: "Salón para talleres, cursos y reuniones de ministerio.",
      kind: "auditorium",
      planWidth: 800,
      planHeight: 520,
      layout: {
        sections: [{ id: "uni", name: "General", color: colors[0] }],
        elements: [
          { id: "stage", type: "stage", x: 220, y: 14, w: 360, h: 50, label: "Frente" },
          { id: "gen", type: "block", x: 150, y: 110, rows: 8, cols: 14, prefix: "", sectionId: "uni", label: "General" },
          { id: "door", type: "door", x: 350, y: 480, w: 100, h: 24, label: "Entrada" },
        ],
        blocked: [],
      },
    },
    {
      name: "Área de Comunidad Kids",
      description: "Salones de Comunidad Kids; útil para campamentos y actividades con mesas.",
      kind: "kids",
      planWidth: 800,
      planHeight: 520,
      layout: {
        sections: [{ id: "mesas", name: "Mesas", color: colors[2] }],
        elements: [
          { id: "m1", type: "table", x: 150, y: 150, code: "M1", seats: 6, shape: "round", sectionId: "mesas" },
          { id: "m2", type: "table", x: 400, y: 150, code: "M2", seats: 6, shape: "round", sectionId: "mesas" },
          { id: "m3", type: "table", x: 650, y: 150, code: "M3", seats: 6, shape: "round", sectionId: "mesas" },
          { id: "m4", type: "table", x: 150, y: 370, code: "M4", seats: 6, shape: "round", sectionId: "mesas" },
          { id: "m5", type: "table", x: 400, y: 370, code: "M5", seats: 6, shape: "round", sectionId: "mesas" },
          { id: "m6", type: "table", x: 650, y: 370, code: "M6", seats: 6, shape: "round", sectionId: "mesas" },
          { id: "door", type: "door", x: 350, y: 484, w: 100, h: 24, label: "Entrada" },
        ],
        blocked: [],
      },
    },
  ]
}
