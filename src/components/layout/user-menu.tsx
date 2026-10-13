"use client";

import * as React from "react";
import Link from "next/link";
import {
  KeyRound,
  LogOut,
  Settings2,
  HeartHandshake,
  UserRound,
  ChevronsUpDown,
} from "lucide-react";
import type { AppRole } from "@/lib/auth/permissions";
import { COARSE_ROLE_LABELS } from "@/components/shared/role-badge";
import { logout } from "@/lib/auth/logout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface UserMenuUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: AppRole | "superadmin" | null;
  /** Nombre del rol resuelto (Role.name de la membresía), p.ej. "Tesorero". */
  roleName?: string | null;
  scope?: "superadmin" | "app" | "portal" | null;
  organizationId?: string | null;
  activeOrganizationId?: string | null;
}

function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email || "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source[0]?.toUpperCase() ?? "?";
}

// Dropdown de usuario: perfil, cambiar contraseña, cerrar sesión.
export function UserMenu({ user }: { user: UserMenuUser }) {
  const role =
    user.roleName?.trim() ||
    (user.role ? (COARSE_ROLE_LABELS[user.role] ?? user.role) : undefined);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 rounded-full px-1.5 data-[state=open]:bg-accent"
          aria-label="Menú de usuario"
        >
          <Avatar className="size-7">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium lg:block">
            {user.name ?? "Usuario"}
          </span>
          <ChevronsUpDown className="hidden size-3.5 text-muted-foreground lg:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-60"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{user.name ?? "Usuario"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          {role && (
            <Badge variant="outline" className="mt-1 w-fit text-[0.65rem]">
              {role}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/admin/profile">
              <UserRound className="size-4" />
              Mi perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/auth/change-password">
              <KeyRound className="size-4" />
              Cambiar contraseña
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/settings">
              <Settings2 className="size-4" />
              Preferencias
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/mi">
              <HeartHandshake className="size-4" />
              Mi espacio
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void logout()}
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
