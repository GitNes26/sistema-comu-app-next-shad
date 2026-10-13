import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { UsersManager } from "@/components/admin/settings/users-manager";

export const metadata: Metadata = { title: "Usuarios y permisos" };

// FASE 15.4/15.5 — Usuarios, roles y permisos, e invitaciones.

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "users.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<Users className="size-5" />}
        title="Usuarios y permisos"
        description="Gestiona miembros, roles, permisos e invitaciones."
      />
      <UsersManager isSuperadmin={session?.user?.role === "superadmin"} />
    </div>
  );
}
