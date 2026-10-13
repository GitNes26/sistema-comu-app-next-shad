import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CompanyForm } from "@/components/admin/settings/company-form";

export const metadata: Metadata = { title: "Datos de la iglesia" };

// Datos de la iglesia.

export default async function CompanySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<Building2 className="size-5" />}
        title="Datos de la iglesia"
        description="Razón social, RFC, contacto y datos de contacto y donativos."
      />
      <CompanyForm />
    </div>
  );
}
