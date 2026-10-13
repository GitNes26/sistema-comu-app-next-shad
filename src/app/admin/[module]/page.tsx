import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Briefcase, Construction, HandHeart, MapPin, UserCog, Users } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { CRUD_KEYS, getCrudEntry } from "@/lib/crud/modules";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CrudPage } from "@/components/admin/crud/crud-page";

// Página CRUD genérica del admin: los módulos registrados en CRUD_KEYS renderizan
// el CRUD real; un módulo con página propia vive en su carpeta (/admin/<módulo>).

const MODULE_ICONS: Record<string, React.ReactNode> = {
  members: <Users className="size-5" />,
  ministries: <HandHeart className="size-5" />,
  locations: <MapPin className="size-5" />,
  positions: <Briefcase className="size-5" />,
  employees: <UserCog className="size-5" />,
};

const PLACEHOLDER_TITLES: Record<string, { title: string; description: string; redirect?: string }> = {
  profile: { title: "Mi perfil", description: "Tu información y preferencias." },
};

function Placeholder({ module }: { module: string }) {
  const meta = PLACEHOLDER_TITLES[module] ?? {
    title: module.charAt(0).toUpperCase() + module.slice(1),
    description: "Este módulo está en preparación.",
  };
  return (
    <>
      <PageHeader icon={<Construction className="size-5" />} title={meta.title} description={meta.description} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulo en preparación</CardTitle>
          <CardDescription>
            Este módulo será habilitado próximamente. Mientras tanto, puedes acceder
            a las funcionalidades relacionadas desde otros módulos del panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Próximamente</Badge>
        </CardContent>
      </Card>
    </>
  );
}

async function resolveFlags(module: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope === "portal") {
    return { canManage: false, canDelete: false };
  }
  const entry = getCrudEntry(module);
  if (!entry) return { canManage: false, canDelete: false };
  return {
    canManage: hasPermission(session, entry.permissionManage),
    canDelete: hasPermission(session, entry.permissionDelete ?? entry.permissionManage),
  };
}

export default async function AdminModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;

  if (!CRUD_KEYS.includes(module)) {
    return <Placeholder module={module} />;
  }

  // Sin permiso de ver el módulo no se abre la pantalla (la API también lo rechaza).
  const session = await getServerSession(authOptions);
  const entry = getCrudEntry(module);
  if (!session?.user || !entry || !hasPermission(session, entry.permissionView)) redirect("/admin");

  const { canManage, canDelete } = await resolveFlags(module);

  return (
    <CrudPage
      moduleKey={module}
      canManage={canManage}
      canDelete={canDelete}
      icon={MODULE_ICONS[module]}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module } = await params;
  const entry = getCrudEntry(module);
  return { title: entry?.title ?? PLACEHOLDER_TITLES[module]?.title ?? "Módulo" };
}