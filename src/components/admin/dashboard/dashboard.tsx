"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, Droplets, Flame, GraduationCap, HeartHandshake, Home, KeyRound, MapPin, Mic2, UserCog, UserPlus, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/base/animated-number";
import { VISION_STAGE_OPTIONS, HIERARCHY_OPTIONS } from "@/components/admin/crud/crud-config";
import type { PanelSummary } from "@/lib/panel/server";

// Panel de la iglesia: cifras que cambian decisiones. Los datos llegan del
// servidor (acotados a la iglesia de la sesión); el cliente solo los dibuja.

const STAGE_LABEL = Object.fromEntries(VISION_STAGE_OPTIONS.map((o) => [o.value, o.label]));
// Etiquetas cortas para el eje de la gráfica.
const STAGE_SHORT: Record<string, string> = { encounter: "Encuentro", school: "Escuela" };
const HIERARCHY_LABEL = Object.fromEntries(HIERARCHY_OPTIONS.map((o) => [o.value, o.label]));

function MetricCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          <AnimatedNumber value={value} format={(n) => Math.round(n).toLocaleString("es-MX")} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="press block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function AdminDashboard({
  summary,
  canViewMembers,
  canViewReports = false,
}: {
  summary: PanelSummary;
  canViewMembers: boolean;
  canViewReports?: boolean;
}) {
  const stageData = summary.byStage.map((s) => ({ name: STAGE_SHORT[s.stage] ?? STAGE_LABEL[s.stage] ?? s.stage, value: s.count }));
  const maxStage = Math.max(1, ...stageData.map((s) => s.value));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Creyentes"
          value={summary.totalMembers}
          hint={`${summary.newThisMonth} nuevo(s) este mes`}
          icon={<Users className="size-4" />}
          href={canViewMembers ? "/admin/members" : undefined}
        />
        <MetricCard
          label="Nuevos este mes"
          value={summary.newThisMonth}
          hint="Altas desde el día 1"
          icon={<UserPlus className="size-4" />}
        />
        <MetricCard
          label="Con acceso al sistema"
          value={summary.withAccess}
          hint={`de ${summary.totalMembers} creyentes`}
          icon={<KeyRound className="size-4" />}
        />
        <MetricCard label="Personal" value={summary.employees} hint="Empleados activos" icon={<UserCog className="size-4" />} />
        <MetricCard label="Bautismo en aguas" value={summary.baptizedWater} hint="Fe pública" icon={<Droplets className="size-4" />} />
        <MetricCard label="Bautismo en fuego" value={summary.baptizedFire} hint="Don de lenguas" icon={<Flame className="size-4" />} />
        <MetricCard label="Sedes" value={summary.locations} hint="Activas" icon={<MapPin className="size-4" />} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Última reunión"
          value={summary.ops.lastGathering?.total ?? 0}
          hint={summary.ops.lastGathering ? `Asistencia del ${summary.ops.lastGathering.date.split("-").reverse().join("/")}` : "Aún sin reuniones"}
          icon={<Mic2 className="size-4" />}
          href={canViewReports ? "/admin/reports" : undefined}
        />
        <MetricCard label="Células activas" value={summary.ops.activeCells} hint="Con su reporte en Reportes" icon={<Home className="size-4" />} href={canViewReports ? "/admin/reports" : undefined} />
        <MetricCard label="Eventos próximos" value={summary.ops.upcomingEvents} hint="En los próximos 30 días" icon={<CalendarDays className="size-4" />} />
        <MetricCard label="Seguimientos abiertos" value={summary.ops.openCases} hint="Consolidación" icon={<HeartHandshake className="size-4" />} />
        <MetricCard label="Cursando en la escuela" value={summary.ops.studying} hint="Alumnos inscritos" icon={<GraduationCap className="size-4" />} />
      </div>
      {canViewReports && (
        <Link href="/admin/reports" className="press inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40">
          <BarChart3 className="size-4 text-primary" />
          Ver y exportar reportes en PDF
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Creyentes por etapa de la visión</CardTitle>
            <CardDescription>Dónde va cada persona en el ciclo: Ganar → Discipulado.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.totalMembers === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aún no hay creyentes registrados. Empieza en{" "}
                {canViewMembers ? (
                  <Link href="/admin/members" className="font-medium text-primary underline-offset-4 hover:underline">
                    Creyentes
                  </Link>
                ) : (
                  "Creyentes"
                )}
                .
              </p>
            ) : (
              <div className="h-64 w-full" role="img" aria-label="Gráfica de creyentes por etapa de la visión">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v) => [v as number, "Creyentes"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {stageData.map((s) => (
                        <Cell key={s.name} fill="var(--primary)" fillOpacity={0.35 + 0.65 * (s.value / maxStage)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jerarquía</CardTitle>
            <CardDescription>Pastor, discípulos, líderes y creyentes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.byHierarchy.length === 0 && <li className="text-sm text-muted-foreground">Sin datos todavía.</li>}
              {summary.byHierarchy.map((h) => (
                <li key={h.hierarchy} className="flex items-center justify-between text-sm">
                  <span>{HIERARCHY_LABEL[h.hierarchy] ?? h.hierarchy}</span>
                  <span className="font-heading font-semibold tabular-nums">{h.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
