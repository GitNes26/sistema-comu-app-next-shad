import {
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  Crown,
  Flame,
  HeartHandshake,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Etiquetas por nivel de acceso (fallback cuando la membresía no apunta a un rol
// concreto). Coinciden con el nivel efectivo de la app.
export const COARSE_ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  owner: "Propietario",
  admin: "Administrador",
  leader: "Líder",
  servant: "Servidor",
  believer: "Creyente",
};

type RoleVisual = {
  icon: typeof UserRound;
  /** Fondo/color del icono (círculo tintado). */
  accent: string;
};

// Roles de sistema (Role.name) — claves en español, porque es el nombre legible
// que llega desde la BD.
const ROLE_VISUALS: Record<string, RoleVisual> = {
  Propietario: { icon: Crown, accent: "bg-warning/15 text-warning-ink" },
  "Administrador de iglesia": { icon: Shield, accent: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  Pastor: { icon: Flame, accent: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  "Administrativo completo": { icon: BriefcaseBusiness, accent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  Secretaría: { icon: UserRound, accent: "bg-info/15 text-info-ink" },
  Tesorero: { icon: Calculator, accent: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  "Líder de red": { icon: Users, accent: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  "Líder de célula": { icon: HeartHandshake, accent: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  "Líder de ministerio": { icon: Users, accent: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  Maestro: { icon: BookOpen, accent: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  Discípulo: { icon: Flame, accent: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  Creyente: { icon: UserRound, accent: "bg-muted text-muted-foreground" },
  Superadmin: { icon: ShieldCheck, accent: "bg-muted-foreground/15 text-foreground" },
};

// Fallback por nivel efectivo (cuando no hay Role.name resuelto).
const COARSE_VISUALS: Record<string, RoleVisual> = {
  owner: { icon: Crown, accent: "bg-warning/15 text-warning-ink" },
  admin: { icon: Shield, accent: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  leader: { icon: Users, accent: "bg-info/15 text-info-ink" },
  servant: { icon: HeartHandshake, accent: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  superadmin: { icon: ShieldCheck, accent: "bg-muted-foreground/15 text-foreground" },
  believer: { icon: UserRound, accent: "bg-muted text-muted-foreground" },
};

function roleVisual(key: string | null | undefined): RoleVisual {
  if (key) return ROLE_VISUALS[key] ?? COARSE_VISUALS[key] ?? COARSE_VISUALS.believer;
  return COARSE_VISUALS.believer;
}

/**
 * Píldora del rol resuelto para encabezados: icono tintado + nombre del rol
 * («Tesorero», «Líder de célula»…) con su etiqueta completa en el tooltip. Sin
 * Role.name (roleName), cae al nombre del nivel efectivo.
 */
export function RoleBadge({
  roleName,
  role,
  className,
}: {
  /** Nombre legible del rol resuelto (Role.name de la membresía). */
  roleName?: string | null;
  /** Nivel efectivo (AppRole) para icono/fallback. */
  role?: string | null;
  className?: string;
}) {
  const label = roleName?.trim() || COARSE_ROLE_LABELS[role ?? ""] || role || null;
  if (!label) return null;
  const visual = roleVisual(roleName ?? role);
  const Icon = visual.icon;
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-muted py-0.5 pl-1 pr-2 text-xs font-medium text-muted-foreground",
        className
      )}
      title={label}
    >
      <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", visual.accent)}>
        <Icon className="size-2.5" strokeWidth={3} />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
