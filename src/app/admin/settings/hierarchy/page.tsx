import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Crown } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { HierarchyForm } from "@/components/admin/settings/hierarchy-form";

export const metadata: Metadata = { title: "Jerarquía" };

// Nombres de los niveles de la jerarquía eclesiástica.
export default async function HierarchySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) redirect("/admin");

  return (
    <div className="w-full">
      <PageHeader icon={<Crown className="size-5" />} title="Jerarquía" description="Nombre, descripción y visibilidad de cada nivel: creyente, discípulo, servidor, líder, pastor…" />
      <HierarchyForm />
    </div>
  );
}
