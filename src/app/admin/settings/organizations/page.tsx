import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Church } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { OrganizationsManager } from "@/components/admin/settings/organizations-manager";

export const metadata: Metadata = { title: "Iglesias" };

// Gestión global de iglesias. Exclusivo del superadmin (permiso reservado
// organizations.manage).

export default async function OrganizationsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "organizations.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<Church className="size-5" />}
        title="Iglesias"
        description="Crea iglesias con su propietario, entra a operarlas y controla su acceso."
      />
      <OrganizationsManager />
    </div>
  );
}
