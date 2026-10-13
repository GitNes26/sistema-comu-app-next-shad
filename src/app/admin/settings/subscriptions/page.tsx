import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { SubscriptionsManager } from "@/components/admin/settings/subscriptions-manager";

export const metadata: Metadata = { title: "Control de suscripciones" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "organizations.manage")) redirect("/admin");
  return <SubscriptionsManager />;
}
