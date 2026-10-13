import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Menu } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { MenusManager } from "@/components/admin/settings/menus-manager";

export const metadata: Metadata = { title: "Gestión de menú" };

// CRUD del menú dinámico (desde admin).

export default async function AdminMenusPage() {
  const session = await getServerSession(authOptions);
  // Menú global: exclusivo del superadministrador.
  if (session?.user?.role !== "superadmin" || !hasPermission(session, "organizations.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<Menu className="size-5" />}
        title="Gestión de menú"
        description="Organiza secciones e ítems del menú lateral y la barra inferior."
      />
      <MenusManager />
    </div>
  );
}
