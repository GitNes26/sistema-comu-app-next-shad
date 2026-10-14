import {
  AlignLeft,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  Car,
  Church,
  CircleDollarSign,
  ClipboardPen,
  Clock,
  CreditCard,
  FileText,
  FileUp,
  Globe,
  HandHeart,
  Hash,
  KeyRound,
  Link2,
  ListFilter,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Percent,
  Phone,
  Plus,
  Search,
  Settings2,
  Tag,
  Ticket,
  Trash2,
  Type,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"
import { normalizeSearch } from "./search"

// Un campo siempre muestra un icono acorde con su dato: dinero → moneda, correo → sobre,
// teléfono → teléfono, fecha → calendario… Se infiere de la etiqueta, el tipo y el
// `inputMode`; el componente puede sobreescribirlo con su propia prop de icono.

type Rule = { test: RegExp; icon: LucideIcon }

// El primer patrón que coincide gana: del más específico al más general.
const RULES: Rule[] = [
  { test: /\b(correo|email|e mail|mail)\b/, icon: Mail },
  { test: /\b(telefono|celular|whatsapp|movil|tel)\b/, icon: Phone },
  { test: /\b(contrasena|password|pin|clave de acceso)\b/, icon: KeyRound },
  { test: /\b(sitio|web|enlace|url|link|liga|pagina)\b/, icon: Link2 },
  { test: /\b(porcentaje|descuento|tasa|interes)\b|%/, icon: Percent },
  {
    test: /\b(precio|costo|monto|importe|sueldo|salario|pago|total|saldo|bono|deduccion|cuota|donativo|diezmo|ofrenda|gasto|ingreso|comision|propina|abono|cargo|percepcion|inscripcion|colegiatura|cobrado|pagar|dinero|efectivo)\b|\$/,
    icon: CircleDollarSign,
  },
  { test: /\b(tarjeta|clabe|cuenta|banco)\b/, icon: CreditCard },
  { test: /\b(fecha y hora|inicia|termina)\b/, icon: CalendarClock },
  { test: /\b(fecha|nacimiento|desde|hasta|vence|vencimiento|dia|periodo|mes|ano)\b/, icon: CalendarDays },
  { test: /\b(hora|horas|horario|duracion|turno|entrada|salida|jornada)\b/, icon: Clock },
  { test: /\b(direccion|calle|colonia|ciudad|estado|domicilio|referencia|lugar|ubicacion|salon|area|destino|sede|cp|postal)\b/, icon: MapPin },
  { test: /\b(descripcion|notas?|comentarios?|mensaje|observaciones?|detalle|resumen|contenido|requisitos?|instrucciones|indicaciones|motivo)\b/, icon: AlignLeft },
  { test: /\b(buscar|busqueda|filtrar)\b/, icon: Search },
  { test: /\b(ministerio|iglesia)\b/, icon: Church },
  { test: /\b(evento|boleto|taller)\b/, icon: Ticket },
  { test: /\b(libro|curso|clase|escuela|leccion|tarea|ejercicio)\b/, icon: BookOpen },
  { test: /\b(vehiculo|camioneta|auto|placa)\b/, icon: Car },
  { test: /\b(celula|red|grupo|equipo|integrantes|servidores)\b/, icon: Users },
  { test: /\b(puesto|cargo laboral|empresa|razon social|rfc)\b/, icon: Building2 },
  {
    test: /\b(persona|servidor|lider|alumno|maestro|director|subdirector|pastor|invitado|responsable|quien|creyente|tutor|chofer|conductor|apellidos?|usuario|empleado|nombre completo|titular|discipula|anfitrion)\b/,
    icon: UserRound,
  },
  { test: /\b(cantidad|numero|folio|codigo|cupo|capacidad|kilometraje|km|odometro|litros|edad|semanas|orden|piso|mesa|asiento|dias|faltas)\b|^#/, icon: Hash },
  { test: /\b(tipo|categoria|estado|frecuencia|clase|nivel|jerarquia|etapa|papel|rol|metodo|forma)\b/, icon: ListFilter },
  { test: /\b(etiqueta|clave|nombre corto)\b/, icon: Tag },
]

/** Icono de un campo a partir de su etiqueta y de lo que se sepa de su tipo. */
export function inferFieldIcon(label?: string | null, hint?: { type?: string; inputMode?: string; name?: string } | null): LucideIcon {
  const type = hint?.type
  if (type === "email") return Mail
  if (type === "tel") return Phone
  if (type === "password") return KeyRound
  if (type === "url") return Globe
  if (type === "search") return Search
  const text = normalizeSearch(`${label ?? ""} ${hint?.name ?? ""}`)
  if (text) {
    for (const r of RULES) if (r.test.test(text)) return r.icon
  }
  if (hint?.inputMode === "tel") return Phone
  if (hint?.inputMode === "email") return Mail
  if (hint?.inputMode === "url") return Globe
  if (type === "number" || hint?.inputMode === "numeric" || hint?.inputMode === "decimal") return Hash
  return Type
}

const DIALOG_ACTIONS: Rule[] = [
  { test: /^(nuevo|nueva|crear|agregar|anadir|alta)\b/, icon: Plus },
  { test: /^(editar|modificar|cambiar|actualizar)\b/, icon: Pencil },
  { test: /^(eliminar|borrar|quitar|cancelar)\b/, icon: Trash2 },
  { test: /^(configurar|ajustes|opciones|diploma)\b/, icon: Settings2 },
  { test: /^(asignar|invitar|integrar)\b/, icon: UserPlus },
  { test: /^(pedir|solicitar|servir|quiero)\b/, icon: HandHeart },
  { test: /^(importar|subir|cargar)\b/, icon: FileUp },
  { test: /^(programar|agendar)\b/, icon: CalendarClock },
  { test: /^(pagar|cobrar|pago|abono)\b/, icon: CreditCard },
  { test: /^(registrar|capturar|anotar|pasar lista)\b/, icon: ClipboardPen },
  { test: /^(detalle|ver|resultado|recibo|reporte)\b/, icon: FileText },
  { test: /^(mensaje|enviar|avisar)\b/, icon: MessageSquare },
]

/** Icono de un diálogo a partir de su título («Nuevo vehículo» → +, «Editar…» → lápiz…). */
export function inferDialogIcon(title?: string | null): LucideIcon {
  const t = normalizeSearch(title)
  if (!t) return FileText
  for (const r of DIALOG_ACTIONS) if (r.test.test(t)) return r.icon
  const byTopic = inferFieldIcon(t)
  return byTopic === Type ? FileText : byTopic
}
