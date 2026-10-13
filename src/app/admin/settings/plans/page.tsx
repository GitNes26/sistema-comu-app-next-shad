import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PlansManager } from "@/components/admin/settings/plans-manager";

export const metadata: Metadata = { title: "Planes del sistema" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "organizations.manage")) redirect("/admin");
  return <PlansManager />;
}
