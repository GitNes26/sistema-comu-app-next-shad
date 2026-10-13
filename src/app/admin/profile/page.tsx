import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/admin/settings/profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

// Perfil del usuario.

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="w-full">
      <PageHeader
        icon={<UserRound className="size-5" />}
        title="Mi perfil"
        description="Tu información personal y avatar."
      />
      <ProfileForm />
    </div>
  );
}
