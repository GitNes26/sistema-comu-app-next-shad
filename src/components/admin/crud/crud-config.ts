import type React from "react";
import type { StatusTone } from "@/components/base/status-pill";

// Metadatos de UI para el CRUD genérico del admin (solo lado cliente).
// No importa nada del servidor para poder usarse en componentes "use client".

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "password"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "boolean"
  | "select"
  | "code"
  | "date"
  | "time"
  | "datetime"
  | "multiselect"
  | "image"
  | "gps"
  | "schedule"
  | "address"

export interface SelectOption {
  value: string
  label: string
}

/**
 * Definición de validación Yup simplificada.
 * Cada clave es un método de `yup.StringSchema` o `yup.NumberSchema`.
 * Ejemplo: `{ email: { message: "Correo inválido" }, max: [255, "Máx 255"] }`
 */
export type YupSchemaDef = Record<
  string,
  { message: string } | [number | RegExp, string]
>

export interface CrudField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  /** Leyenda visible debajo del control; `help` permanece en el InfoTooltip. */
  note?: string
  /** Icono Lucide para input/textarea/select (se muestra a la izquierda). */
  icon?: string
  /** Texto descriptivo para boolean (debajo del label). */
  description?: string
  full?: boolean
  options?: SelectOption[]
  /** Módulo CRUD del que se cargan las opciones (p. ej. "categories"). */
  optionsModule?: string
  /** Campo del listado que se usa como valor de la opción. */
  optionValue?: string
  /** Campo del listado que se usa como etiqueta de la opción. */
  optionLabel?: string
  /** Clave de un sub-arreglo dentro de cada fila (p. ej. "variants") para aplanar opciones anidadas. */
  optionNested?: string
  /** Campo del formulario donde se guarda la latitud (para tipo "gps"). */
  latKey?: string
  /** Campo del formulario donde se guarda la longitud (para tipo "gps"). */
  lonKey?: string
  /** Mostrar el campo solo si se cumple la condición. */
  showIf?: (values: Record<string, unknown>) => boolean
  /** Transformar el valor al guardar: "uppercase", "lowercase", "trim". */
  transform?: "uppercase" | "lowercase" | "trim"
  /** Longitud máxima de caracteres (text/textarea). */
  maxLength?: number
  /** Longitud mínima de caracteres (text/textarea). */
  minLength?: number
  /** Definición de validación Yup. Cada clave es un método de Yup StringSchema/NumberSchema. */
  yup?: YupSchemaDef
  /** Valor mínimo numérico (number/money/percent). */
  min?: number
  /** Valor máximo numérico (number/money/percent). */
  max?: number
  /** Imagen: usar zona de arrastre sin recorte (ImageDropzoneField) en vez de Attachment con cropper. */
  dropzone?: boolean
  /** Mensaje de error personalizado para required. */
  requiredMessage?: string
  /** Validaciones adicionales: array de funciones que retornan string | null. */
  validate?: ((
    value: unknown,
    allValues: Record<string, unknown>
  ) => string | null)[]
  /** Valor por defecto explícito (sobreescribe el default vacío). */
  defaultValue?: unknown
}

export interface CrudColumn {
  key: string
  label: string
  type?: "text" | "money" | "percent" | "boolean" | "badge" | "count" | "code" | "datetime" | "points"
  /** Convierte el valor crudo a una etiqueta para los tipos badge/text. */
  displayMap?: Record<string, string>
  /** Tono de la etiqueta por valor (tipo badge): p. ej. { active: "success" }. */
  tones?: Record<string, StatusTone>
}

export interface CrudFilter {
  /** Parámetro de consulta que viaja al servidor (p. ej. "stage"). */
  key: string
  label: string
  options: SelectOption[]
}

export interface CrudUiConfig {
  module: string
  title: string
  description: string
  canDelete?: boolean
  searchPlaceholder?: string
  columns: CrudColumn[]
  fields: CrudField[]
  /** Nombre en singular para títulos: "Editar categoría". */
  singular?: string
  /** Texto del botón de alta: "Nueva categoría" (respeta el género). */
  newLabel?: string
  /** Filtros de listado (selects) que se envían como parámetros de consulta. */
  filters?: CrudFilter[]
  /** Ruta base de la pantalla de detalle: la fila abre `${detailPath}${id}`. */
  detailPath?: string
  /** Columnas que se muestran como línea secundaria bajo el nombre (y salen de la tabla). */
  subtitleKeys?: string[]
  /** Componente renderizado después de los campos del formulario, recibe los valores actuales. */
  afterFields?: (props: { values: Record<string, unknown> }) => React.JSX.Element | null
  beforeFields?: (props: { values: Record<string, unknown> }) => React.JSX.Element | null
}

export const WEEKDAY_OPTIONS: SelectOption[] = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mié" },
  { value: "4", label: "Jue" },
  { value: "5", label: "Vie" },
  { value: "6", label: "Sáb" },
]

export const VISION_STAGE_OPTIONS: SelectOption[] = [
  { value: "win", label: "Ganar" },
  { value: "consolidate", label: "Consolidar" },
  { value: "encounter", label: "Encuentro con Jesús" },
  { value: "school", label: "Escuela de ministerio" },
  { value: "launch", label: "Lanzamiento" },
  { value: "leadership", label: "Liderazgo" },
  { value: "discipleship", label: "Discipulado" },
]

export const HIERARCHY_OPTIONS: SelectOption[] = [
  { value: "believer", label: "Creyente" },
  { value: "leader", label: "Líder" },
  { value: "disciple", label: "Discípulo" },
  { value: "pastor", label: "Pastor" },
]

export const GENDER_OPTIONS: SelectOption[] = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
]

export const MARITAL_OPTIONS: SelectOption[] = [
  { value: "single", label: "Soltero(a)" },
  { value: "married", label: "Casado(a)" },
  { value: "free_union", label: "Unión libre" },
  { value: "separated", label: "Separado(a)" },
  { value: "divorced", label: "Divorciado(a)" },
  { value: "widowed", label: "Viudo(a)" },
]

const PHONE_10: YupSchemaDef = { matches: [/^(?:\d{10})?$/, "Debe contener exactamente 10 dígitos"] }

export const CRUD_UI: Record<string, CrudUiConfig> = {
  ministries: {
    module: "ministries",
    title: "Ministerios",
    singular: "ministerio",
    newLabel: "Nuevo ministerio",
    subtitleKeys: ["parentName"],
    detailPath: "/admin/ministries/",
    description: "Áreas de servicio: líderes, servidores, reuniones y requisiciones de cada una.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre o descripción…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "parentName", label: "Pertenece a" },
      { key: "leaderNames", label: "Líderes" },
      { key: "memberCount", label: "Servidores", type: "count" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", icon: "HandHeart", label: "Nombre", type: "text", required: true, requiredMessage: "Escribe el nombre", maxLength: 120, placeholder: "Ej. Alabanza" },
      { key: "parentId", icon: "GitFork", label: "Pertenece a", type: "select", optionsModule: "ministries", optionValue: "id", optionLabel: "name", help: "Para áreas de un ministerio mayor (p. ej. Audio dentro de Producción)." },
      { key: "description", icon: "FileText", label: "Descripción", type: "textarea", full: true, maxLength: 2000 },
      { key: "requirements", icon: "ListChecks", label: "Requisitos para pertenecer", type: "textarea", full: true, maxLength: 2000 },
      { key: "imageUrl", icon: "Image", label: "Imagen", type: "image" },
      { key: "sortOrder", icon: "ArrowDownUp", label: "Orden", type: "number", defaultValue: 0 },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },

  members: {
    module: "members",
    title: "Creyentes",
    singular: "creyente",
    newLabel: "Nuevo creyente",
    subtitleKeys: ["phone"],
    description: "Padrón de la iglesia: datos, etapa de la visión y bautismos.",
    canDelete: false,
    searchPlaceholder: "Buscar por nombre, teléfono o código…",
    filters: [
      { key: "stage", label: "Etapa", options: VISION_STAGE_OPTIONS },
      { key: "hierarchy", label: "Jerarquía", options: HIERARCHY_OPTIONS },
    ],
    columns: [
      { key: "fullName", label: "Nombre" },
      { key: "phone", label: "Teléfono" },
      { key: "visionStage", label: "Etapa", type: "badge", displayMap: Object.fromEntries(VISION_STAGE_OPTIONS.map((o) => [o.value, o.label])) },
      { key: "hierarchy", label: "Jerarquía", type: "badge", displayMap: Object.fromEntries(HIERARCHY_OPTIONS.map((o) => [o.value, o.label])) },
      { key: "baptizedWater", label: "Agua", type: "boolean" },
      { key: "baptizedFire", label: "Fuego", type: "boolean" },
      { key: "hasAccess", label: "Acceso", type: "boolean" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "fullName", icon: "UserRound", label: "Nombre completo", type: "text", required: true, requiredMessage: "Ingresa el nombre", transform: "trim", maxLength: 150 },
      { key: "phone", icon: "Phone", label: "Teléfono", type: "phone", maxLength: 10, help: "Opcional. Si lo capturas, usa 10 dígitos; sirve para dar seguimiento y para entrar al sistema.", yup: PHONE_10 },
      { key: "email", icon: "Mail", label: "Correo", type: "email", transform: "lowercase", yup: { email: { message: "Ingresa un correo válido" } } },
      { key: "gender", icon: "Users", label: "Género", type: "select", options: GENDER_OPTIONS },
      { key: "birthDate", icon: "Cake", label: "Fecha de nacimiento", type: "date" },
      { key: "maritalStatus", icon: "Heart", label: "Estado civil", type: "select", options: MARITAL_OPTIONS },
      { key: "occupation", icon: "BriefcaseBusiness", label: "Ocupación", type: "text", maxLength: 100 },
      { key: "contactSchedule", icon: "Clock", label: "Horario de contacto", type: "text", maxLength: 100, placeholder: "Ej. Tardes" },
      { key: "address", label: "Domicilio", type: "address", latKey: "latitude", lonKey: "longitude", full: true },
      { key: "locationId", icon: "MapPin", label: "Sede", type: "select", optionsModule: "locations", optionValue: "id", optionLabel: "name" },
      { key: "visionStage", icon: "Footprints", label: "Etapa de la visión", type: "select", options: VISION_STAGE_OPTIONS, defaultValue: "win", help: "Dónde va el creyente en el ciclo: Ganar, Consolidar, Encuentro, Escuela, Lanzamiento, Liderazgo y Discipulado." },
      { key: "hierarchy", icon: "Crown", label: "Jerarquía", type: "select", options: HIERARCHY_OPTIONS, defaultValue: "believer" },
      { key: "discipleOfId", icon: "GitFork", label: "Lo discipula", type: "select", optionsModule: "members", optionValue: "id", optionLabel: "fullName", help: "Persona que le da seguimiento en el discipulado." },
      { key: "firstVisitAt", icon: "CalendarCheck", label: "Primera visita", type: "date" },
      { key: "invitedByName", icon: "UserPlus", label: "Invitado por", type: "text", maxLength: 150 },
      { key: "baptizedWater", icon: "Droplets", label: "Bautismo en aguas", type: "boolean", description: "Fe pública" },
      { key: "baptizedWaterAt", icon: "CalendarDays", label: "Fecha de bautismo en aguas", type: "date", showIf: (v) => Boolean(v.baptizedWater) },
      { key: "baptizedFire", icon: "Flame", label: "Bautismo en fuego", type: "boolean", description: "Don de lenguas" },
      { key: "baptizedFireAt", icon: "CalendarDays", label: "Fecha de bautismo en fuego", type: "date", showIf: (v) => Boolean(v.baptizedFire) },
      { key: "imageUrl", icon: "Image", label: "Foto", type: "image" },
      { key: "notes", icon: "FileText", label: "Notas", type: "textarea", full: true, maxLength: 1000 },
      { key: "isActive", label: "Activo", type: "boolean", description: "Un creyente inactivo conserva su historial pero no aparece en listas de operación." },
    ],
  },

  locations: {
    module: "locations",
    title: "Sedes",
    singular: "sede",
    newLabel: "Nueva sede",
    subtitleKeys: ["address"],
    description: "Sedes o congregaciones de la iglesia.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre, encargado o dirección…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "code", label: "Código", type: "code" },
      { key: "address", label: "Dirección" },
      { key: "phone", label: "Teléfono" },
      { key: "memberCount", label: "Creyentes", type: "count" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", icon: "Church", label: "Nombre", type: "text", required: true, placeholder: "Ej. Sede Centro" },
      { key: "code", icon: "Hash", label: "Código", type: "text", placeholder: "CTR", transform: "uppercase", maxLength: 10, yup: { matches: [/^[A-Z0-9]{0,10}$/, "Solo letras mayúsculas y números, máx. 10"] } },
      { key: "address", label: "Dirección", type: "address", latKey: "latitude", lonKey: "longitude", full: true },
      { key: "managerName", icon: "UserKey", label: "Pastor o encargado", type: "text" },
      { key: "phone", icon: "Phone", label: "Teléfono", type: "phone", maxLength: 10, yup: PHONE_10 },
      { key: "email", icon: "Mail", label: "Correo", type: "email", transform: "lowercase", yup: { email: { message: "Ingresa un correo válido" } } },
      { key: "timezone", icon: "Globe", label: "Zona horaria", type: "text", placeholder: "America/Mexico_City", defaultValue: "America/Mexico_City" },
      { key: "notes", icon: "FileText", label: "Notas", type: "textarea", full: true },
      { key: "imageUrl", icon: "ImagePlus", label: "Imagen", type: "image", full: true },
      { key: "isActive", label: "Activa", type: "boolean" },
    ],
  },

  positions: {
    module: "positions",
    title: "Puestos",
    singular: "puesto",
    newLabel: "Nuevo puesto",
    subtitleKeys: ["description"],
    description: "Responsabilidades del personal (secretaria, tesorero, intendencia…). No son roles de acceso.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "description", label: "Descripción" },
      { key: "employeeCount", label: "Empleados", type: "count" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", icon: "BriefcaseBusiness", label: "Nombre", type: "text", required: true, placeholder: "Ej. Tesorero" },
      { key: "description", label: "Descripción", type: "textarea", icon: "FileText", full: true },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },

  employees: {
    module: "employees",
    title: "Empleados",
    singular: "empleado",
    newLabel: "Nuevo empleado",
    subtitleKeys: ["positionName"],
    description: "Personal que labora en la iglesia, con su puesto y datos de pago.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre o código…",
    columns: [
      { key: "fullName", label: "Nombre" },
      { key: "employeeCode", label: "Código", type: "code" },
      { key: "positionName", label: "Puesto", type: "badge" },
      { key: "locationName", label: "Sede", type: "badge" },
      { key: "phone", label: "Teléfono" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "memberId", icon: "UserRound", label: "Creyente", type: "select", required: true, requiredMessage: "Elige al creyente", optionsModule: "members", optionValue: "id", optionLabel: "fullName", help: "El personal siempre es parte del padrón de creyentes." },
      { key: "employeeCode", icon: "IdCardLanyard", label: "Código de empleado", type: "text", transform: "uppercase", placeholder: "EMP-001", yup: { matches: [/^(?:[A-Z0-9-]+)?$/, "Solo mayúsculas, números y guiones"] } },
      { key: "positionId", icon: "List", label: "Puesto", type: "select", optionsModule: "positions", optionValue: "id", optionLabel: "name" },
      { key: "locationId", icon: "MapPin", label: "Sede", type: "select", optionsModule: "locations", optionValue: "id", optionLabel: "name" },
      { key: "hiredAt", icon: "CalendarCheck", label: "Fecha de ingreso", type: "date" },
      {
        key: "salaryType", icon: "Banknote", label: "Tipo de pago", type: "select",
        options: [
          { value: "", label: "No definido" },
          { value: "hourly", label: "Por hora" },
          { value: "daily", label: "Por día" },
          { value: "weekly", label: "Semanal" },
          { value: "monthly", label: "Mensual" },
        ],
      },
      { key: "salaryAmount", icon: "DollarSign", label: "Monto", type: "money", placeholder: "0.00", min: 0, defaultValue: 0 },
      {
        key: "paymentFrequency", icon: "Calendar", label: "Frecuencia de pago", type: "select", defaultValue: "biweekly",
        options: [
          { value: "weekly", label: "Semanal" },
          { value: "biweekly", label: "Quincenal" },
          { value: "monthly", label: "Mensual" },
        ],
      },
      {
        key: "payMethod", icon: "Wallet", label: "Forma de pago", type: "select", defaultValue: "cash",
        options: [
          { value: "cash", label: "Efectivo" },
          { value: "transfer", label: "Transferencia" },
          { value: "check", label: "Cheque" },
        ],
      },
      { key: "notes", icon: "FileText", label: "Notas", type: "textarea", full: true },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },
}

export function getCrudUi(module: string): CrudUiConfig | undefined {
  return CRUD_UI[module]
}
