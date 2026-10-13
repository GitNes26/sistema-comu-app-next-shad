import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { NotificationsCenter } from "@/components/admin/notifications/notifications-center";

export const metadata: Metadata = { title: "Notificaciones" };

// Centro de notificaciones.

export default function AdminNotificationsPage() {
  return <NotificationsCenter icon={<BellRing className="size-5" />} />;
}