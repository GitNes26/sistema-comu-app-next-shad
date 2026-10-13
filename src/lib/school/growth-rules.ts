// Reglas puras del crecimiento ligado a la escuela y a los encuentros.

export const STAGE_ORDER = ["win", "consolidate", "encounter", "school", "launch", "leadership", "discipleship"] as const
export type Stage = (typeof STAGE_ORDER)[number]
export const stageIndex = (s: Stage) => STAGE_ORDER.indexOf(s)

const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

/** «Lanzamiento» es el segundo encuentro; «Encuentro con Jesús» el primero. */
export function encounterStageForEventKind(kind: string): Stage | null {
  const k = normalize(kind)
  if (k.startsWith("lanzamiento")) return "launch"
  if (k.startsWith("encuentro con jesus") || k === "encuentro") return "encounter"
  return null
}

/** Los tres eventos que dejan una marca en el crecimiento del creyente. */
export type GrowthCheck = "baptism" | "encounter" | "launch"

export function growthCheckForEventKind(kind: string): GrowthCheck | null {
  const k = normalize(kind)
  if (k.startsWith("bautismo") || k.startsWith("bautizo")) return "baptism"
  if (k.startsWith("lanzamiento")) return "launch"
  if (k.startsWith("encuentro con jesus") || k === "encuentro") return "encounter"
  return null
}

export const GROWTH_CHECK_LABEL: Record<GrowthCheck, string> = {
  baptism: "Bautismo en aguas",
  encounter: "Encuentro con Jesús",
  launch: "Lanzamiento",
}

/** Estructura fija de cada evento: descripción y lista de pendientes que se siembran al crearlo. */
export const GROWTH_EVENT_TEMPLATES: Record<GrowthCheck, { description: string; checklist: string[] }> = {
  baptism: {
    description:
      "Evento para quienes aún no se han bautizado en aguas y desean declarar su fe de manera pública. Es el primer paso del camino en la visión. Cada persona puede organizarse con su familia o su célula para un festejo breve.",
    checklist: [
      "Confirmar lugar y horario del bautismo",
      "Ministros que bautizarán",
      "Lista de personas por familia o célula",
      "Toallas, batas y cambio de ropa",
      "Festejo breve (pastel y bebidas)",
      "Registrar la entrada de quienes se bautizaron",
    ],
  },
  encounter: {
    description:
      "Retiro espiritual para encontrarte con Dios. Se recomienda haber declarado tu fe en el bautismo en aguas y es el paso previo a la Escuela de ministerio.",
    checklist: [
      "Confirmar lugar, fechas y transporte",
      "Equipo de ministros y servidores",
      "Alimentos y hospedaje",
      "Material y programa de las clínicas",
      "Lista de asistentes con su acomodo",
      "Registrar la entrada de los asistentes",
    ],
  },
  launch: {
    description:
      "Segundo encuentro con Jesús y graduación de la Escuela de ministerio. Al finalizar se entrega el diploma a quienes completaron sus libros.",
    checklist: [
      "Confirmar lugar y programa de graduación",
      "Diplomas listos (diseño o plantilla configurada)",
      "Lista de graduandos con sus libros aprobados",
      "Equipo de ministros y servidores",
      "Registrar la entrada de los asistentes",
      "Finalizar el evento para marcar el crecimiento y entregar diplomas",
    ],
  },
}
