"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/logout";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void logout()}
    >
      <LogOut /> Cerrar sesión
    </Button>
  );
}