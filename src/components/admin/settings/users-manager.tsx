"use client";

import { useCallback, useEffect, useState } from "react";
import * as yup from "yup";
import {
  Copy,
  Globe,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
  AlertCircle,
} from "lucide-react";
import { settingsApi } from "@/lib/settings/client";
import type { InvitationRow, OrgUserRow, RoleRow } from "@/lib/settings/server";
import { PERMISSIONS, PERMISSION_MODULE_LABELS } from "@/lib/auth/permission-keys";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { swalConfirm, swalError } from "@/lib/swal";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogComponent } from "@/components/ui/dialog";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { TooltipButton } from "@/components/shared/tooltip-button";
import { cn } from "@/lib/utils";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  leader: "Líder",
  servant: "Servidor",
  believer: "Creyente",
};

type PermItem = (typeof PERMISSIONS)[number];

const MODULES_BY_GROUP = PERMISSIONS.reduce<Record<string, PermItem[]>>((acc, p) => {
  (acc[p.module] ??= []).push(p);
  return acc;
}, {});

export function UsersManager({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [tab, setTab] = useState("users");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="users">Usuarios</TabsTrigger>
        <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
        <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <UsersTab />
      </TabsContent>
      <TabsContent value="roles">
        <RolesTab isSuperadmin={isSuperadmin} />
      </TabsContent>
      <TabsContent value="invitations">
        <InvitationsTab />
      </TabsContent>
    </Tabs>
  );
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<OrgUserRow[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);

  const load = useCallback(() => {
    settingsApi.users().then((d) => setUsers(d.users)).catch(() => undefined);
    settingsApi.roles().then((d) => setRoles(d.roles)).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (u: OrgUserRow, roleId: string) => {
    try {
      await settingsApi.updateUser(u.membershipId, { roleId });
      load();
      notify.success("Rol actualizado");
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const toggleActive = async (u: OrgUserRow, isActive: boolean) => {
    try {
      await settingsApi.updateUser(u.membershipId, { isActive });
      load();
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (u: OrgUserRow) => {
    const ok = await swalConfirm(
      "Quitar usuario",
      `¿Quitar a ${u.fullName} de la organización?`,
      { danger: true }
    );
    if (!ok) return;
    try {
      await settingsApi.removeUser(u.membershipId);
      load();
      notify.info("Usuario quitado");
    } catch (err) {
      swalError("No se pudo quitar", err instanceof Error ? err.message : undefined);
    }
  };

  if (!users) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay usuarios. Invítalos desde la pestaña &quot;Invitaciones&quot;.
        </p>
      )}
      {users.map((u) => (
        <div key={u.membershipId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{u.fullName}</span>
              {u.isEmployee && <Badge variant="secondary">Empleado</Badge>}
              {!u.isActive && <Badge variant="outline">Inactivo</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
          <FormCombobox
            id={`user-role-${u.membershipId}`}
            ariaLabel={`Rol de ${u.fullName}`}
            className="w-40"
            value={u.roleId ?? u.role}
            onChange={(v) => changeRole(u, v)}
            options={roles.map((r) => ({
              value: r.id,
              label: r.name,
              description: r.isSystem ? "Sistema" : r.organizationId ? "Iglesia" : "Global",
            }))}
            searchable
            clearable={false}
          />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <label htmlFor={`user-active-${u.membershipId}`} className="cursor-pointer">Activo</label>
            <Switch id={`user-active-${u.membershipId}`} checked={u.isActive} onCheckedChange={(v) => toggleActive(u, v)} />
          </div>
          <TooltipButton label="Quitar" variant="ghost" size="icon-xs" onClick={() => remove(u)}>
            <UserX className="size-3.5 text-destructive" />
          </TooltipButton>
        </div>
      ))}
    </div>
  );
}

// ── Roles y permisos ─────────────────────────────────────────────────────────

function RolesTab({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [createRole, setCreateRole] = useState<{ copyRoleId?: string } | null>(null);
  // Lo que el plan de la iglesia no incluye no se puede usar aunque el rol lo tenga.
  const { data: session } = useSession();
  const planDenied = new Set<string>(session?.user?.planDenied ?? []);

  const loadRoles = useCallback(() => {
    settingsApi.roles().then((d) => setRoles(d.roles)).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!selectedId) {
      setPerms(new Set());
      return;
    }
    let active = true;
    setPerms(new Set());
    settingsApi
      .rolePermissions(selectedId)
      .then((d) => {
        if (active) setPerms(new Set(d.permissions));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = roles?.find((r) => r.id === selectedId);
  // Los roles de sistema solo los edita el SuperAdmin (el rol superadmin nunca).
  const systemEditable = isSuperadmin && selected?.id !== "system-superadmin";
  const lockedRole = Boolean(selected?.isSystem) && !systemEditable;

  const toggle = (key: string) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (keys: string[]) => {
    setPerms((prev) => {
      const next = new Set(prev);
      const all = keys.every((k) => next.has(k));
      keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const savePerms = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await settingsApi.setRolePermissions(selectedId, Array.from(perms));
      loadRoles();
      notify.success("Permisos guardados");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleScope = async (role: RoleRow) => {
    if (!isSuperadmin) return;
    const newGlobal = role.organizationId !== null; // toggle
    const label = newGlobal ? "global (todas las iglesias)" : `solo ${role.organizationId}`;
    const ok = await swalConfirm(
      "Cambiar alcance del rol",
      `¿Cambiar "${role.name}" a ${label}?`,
      { confirmText: "Cambiar" }
    );
    if (!ok) return;
    try {
      await settingsApi.updateRole(role.id, { global: newGlobal });
      loadRoles();
      notify.success("Alcance actualizado");
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (role: RoleRow) => {
    const ok = await swalConfirm("Eliminar rol", `¿Eliminar el rol "${role.name}"?`, { danger: true });
    if (!ok) return;
    try {
      await settingsApi.deleteRole(role.id);
      if (selectedId === role.id) setSelectedId("");
      loadRoles();
      notify.info("Rol eliminado");
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-1.5">
        {!roles ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  selectedId === r.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <span className="truncate font-medium">{r.name}</span>
                <span className="flex items-center gap-1.5">
                  {r.isSystem && <Badge variant="outline">Sistema</Badge>}
                  {r.organizationId === null && !r.isSystem && (
                    <TooltipButton label="Rol global" variant="ghost" size="icon-xs">
                      <Globe className="size-3 text-info-ink" />
                    </TooltipButton>
                  )}
                  <span className="text-xs text-muted-foreground">{r.permissionCount}</span>
                </span>
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => setCreateRole({})} className="flex-1">
                <Plus className="size-3.5" /> Nuevo
              </Button>
              {selected && !selected.isSystem && (
                <Button size="sm" variant="outline" onClick={() => setCreateRole({ copyRoleId: selected.id })}>
                  <Copy className="size-3.5" /> Duplicar
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border p-4">
        {!selected ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Selecciona un rol para editar sus permisos
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{selected.name}</p>
                  {selected.isSystem && <Badge variant="outline">Sistema</Badge>}
                  {selected.organizationId === null && !selected.isSystem && (
                    <Badge variant="secondary">Global</Badge>
                  )}
                </div>
                {selected.isSystem && (
                  <p className="mt-1 text-xs text-warning-ink">
                    {systemEditable
                      ? "Rol de sistema: tus cambios aplican a todas las iglesias que lo usan."
                      : "Rol de sistema: solo el SuperAdmin puede modificar sus permisos."}
                  </p>
                )}
                {selected.description && (
                  <p className="text-xs text-muted-foreground">{selected.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isSuperadmin && !selected.isSystem && (
                  <TooltipButton
                    label={selected.organizationId === null ? "Hacer de iglesia" : "Hacer global"}
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleScope(selected)}
                  >
                    <Globe className={cn("size-3.5", selected.organizationId === null ? "text-info-ink" : "text-muted-foreground")} />
                  </TooltipButton>
                )}
                {!selected.isSystem && (
                  <TooltipButton label="Eliminar rol" variant="ghost" size="icon-xs" onClick={() => remove(selected)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </TooltipButton>
                )}
              </div>
            </div>

            {planDenied.size > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Los permisos con candado no están incluidos en el plan de la iglesia: nadie puede usarlos aunque el rol los tenga.{" "}
                  <Link href="/admin/settings/my-plan" className="font-semibold underline">Ver mi plan</Link>
                </span>
              </p>
            )}
            <div className="space-y-3">
              {Object.entries(MODULES_BY_GROUP).map(([module, modulePerms]) => {
                const usable = modulePerms.filter((p) => !planDenied.has(p.key));
                const all = usable.length > 0 && usable.every((p) => perms.has(p.key));
                const moduleLocked = usable.length === 0;
                return (
                  <div key={module} className={cn("rounded-lg border p-3", moduleLocked && "bg-muted/40")}>
                    <label htmlFor={`permission-module-${module}`} className="flex cursor-pointer items-center gap-2">
                      <Checkbox id={`permission-module-${module}`} checked={all} disabled={lockedRole || moduleLocked} onCheckedChange={() => toggleModule(usable.map((p) => p.key))} />
                      <span className="text-sm font-medium">{PERMISSION_MODULE_LABELS[module] ?? module}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {moduleLocked ? (
                          <span className="inline-flex items-center gap-1"><Lock className="size-3" /> No incluido en el plan</span>
                        ) : (
                          "Todos"
                        )}
                      </span>
                    </label>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {modulePerms.map((p) => {
                        const locked = planDenied.has(p.key);
                        return (
                          <label htmlFor={`permission-${p.key}`} key={p.key} className={cn("flex items-center gap-2 text-sm", locked ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                            <Checkbox id={`permission-${p.key}`} checked={perms.has(p.key) && !locked} disabled={lockedRole || locked} onCheckedChange={() => toggle(p.key)} />
                            <span className="text-muted-foreground">{p.label}</span>
                            {locked && <Lock className="size-3 text-muted-foreground" aria-label="No incluido en el plan" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {!lockedRole && <Button onClick={savePerms} disabled={saving}>
              <ShieldCheck className="size-4" /> {saving ? "Guardando…" : "Guardar permisos"}
            </Button>}
          </div>
        )}
      </div>
      {createRole && (
        <CreateRoleDialog
          copyRoleId={createRole.copyRoleId}
          onClose={() => setCreateRole(null)}
          onCreated={() => { setCreateRole(null); loadRoles(); }}
        />
      )}
    </div>
  );
}

function CreateRoleDialog({
  copyRoleId,
  onClose,
  onCreated,
}: {
  copyRoleId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("create-role-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await yup.string().trim().required("El nombre del rol es obligatorio").max(80, "Máximo 80 caracteres").validate(name);
      setError(undefined);
    } catch (validationError) {
      const message = validationError instanceof yup.ValidationError ? validationError.message : "Nombre inválido";
      setError(message);
      window.requestAnimationFrame(() => focusFirstInvalid({ "create-role-name": message }, "create-role-form"));
      return;
    }
    setSaving(true);
    try {
      await settingsApi.createRole({ name: name.trim(), copyRoleId: copyRoleId ?? null });
      notify.success("Rol creado");
      onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear el rol");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(next) => !next && onClose()}
      title={copyRoleId ? "Duplicar rol" : "Nuevo rol"}
      description={copyRoleId ? "Crea un rol con los mismos permisos del seleccionado." : "Crea el rol y después ajusta sus permisos."}
      icon={<ShieldCheck className="size-5" />}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="create-role-form" disabled={saving}>{saving ? "Creando…" : "Crear rol"}</Button>
        </>
      }
    >
      <form id="create-role-form" noValidate onSubmit={submit}>
        <InputGroupField
          id="create-role-name"
          label="Nombre del rol"
          required
          placeholder="Ej. Supervisor de piso"
          leftIcon={<ShieldCheck className="size-4" />}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error}
        />
      </form>
    </DialogComponent>
  );
}

// ── Invitaciones ─────────────────────────────────────────────────────────────

function InvitationsTab() {
  const [invitations, setInvitations] = useState<InvitationRow[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  const load = useCallback(() => {
    settingsApi.invitations().then((d) => setInvitations(d.invitations)).catch(() => undefined);
    settingsApi.roles().then((d) => {
      setRoles(d.roles);
      if (d.roles.length > 0) setRole((current) => current || d.roles[0].id);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("invitation-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled]);

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    try {
      await yup.object({
        email: yup.string().trim().lowercase().email("Ingresa un correo válido").required("El correo es obligatorio"),
        role: yup.string().required("Selecciona un rol"),
      }).validate({ email, role }, { abortEarly: false });
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {};
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message;
        setErrors(next);
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`invitation-${key}`, message]));
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "invitation-form"));
      }
      return;
    }
    setSending(true);
    setFormError(undefined);
    try {
      await settingsApi.createInvitation({ email, roleId: role });
      setEmail("");
      load();
      notify.success("Invitación enviada");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear la invitación");
    } finally {
      setSending(false);
    }
  };

  const revoke = async (id: string) => {
    const ok = await swalConfirm("Revocar invitación", "¿Revocar esta invitación?", { danger: true });
    if (!ok) return;
    try {
      await settingsApi.revokeInvitation(id);
      load();
      notify.info("Invitación revocada");
    } catch (err) {
      swalError("No se pudo revocar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-4">
      <form id="invitation-form" noValidate onSubmit={send} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        {formError && <div role="alert" className="w-full flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}
        <div className="min-w-48 flex-1">
          <InputGroupField
            id="invitation-email"
            label="Email"
            type="email"
            placeholder="persona@correo.com"
            leftIcon={<Mail className="size-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
            required
            error={errors.email}
          />
        </div>
        <div className="space-y-1.5">
          <FormCombobox
            id="invitation-role"
            label="Rol"
            value={role}
            onChange={setRole}
            options={roles.map((r) => ({
              value: r.id,
              label: r.name,
              description: r.isSystem ? "Sistema" : r.organizationId ? "Iglesia" : "Global",
            }))}
            searchable
            clearable={false}
            required
            error={errors.role}
          />
        </div>
        <Button type="submit" disabled={sending}>
          <UserPlus className="size-4" /> {sending ? "Enviando…" : "Invitar"}
        </Button>
      </form>

      {!invitations ? (
        <Skeleton className="h-20 w-full" />
      ) : invitations.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay invitaciones pendientes</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="text-xs text-muted-foreground">
                  {roles.find((r) => r.id === i.roleId)?.name ?? ROLE_LABELS[i.role] ?? i.role} · {i.status === "pending" ? "Pendiente" : i.status}
                </p>
              </div>
              {i.status === "pending" && (
                <Button variant="ghost" size="icon-xs" onClick={() => revoke(i.id)} aria-label="Revocar">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
