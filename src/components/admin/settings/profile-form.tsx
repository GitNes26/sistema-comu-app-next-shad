"use client";

import { useEffect, useState } from "react";
import * as yup from "yup";
import Link from "next/link";
import { AlertCircle, KeyRound, Mail, Phone, Save, User } from "lucide-react";
import { settingsApi, type MyProfileView } from "@/lib/settings/client";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { Attachment } from "@/components/base/attachment";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

export function ProfileForm() {
  const [form, setForm] = useState<MyProfileView | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  useEffect(() => {
    settingsApi
      .profile()
      .then((d) => setForm(d.profile))
      .catch(() => undefined);
  }, []);

  const ready = Boolean(form);
  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("profile-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled, ready]);

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!form) return;
    try {
      await yup.object({
        fullName: yup.string().trim().required("El nombre es obligatorio").max(160, "Máximo 160 caracteres"),
        email: yup.string().trim().required("El correo es obligatorio").email("Ingresa un correo válido"),
        phone: yup.string().test("phone", "El teléfono debe tener 10 dígitos", (value) => !value || /^\d{10}$/.test(value)),
      }).validate(form, { abortEarly: false });
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {};
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message;
        setErrors(next);
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`profile-${key}`, message]));
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "profile-form"));
      }
      return;
    }
    setSaving(true);
    setFormError(undefined);
    try {
      const res = await settingsApi.updateProfile({
        fullName: form.fullName,
        phone: form.phone || null,
        email: form.email,
        avatarUrl: form.avatarUrl,
      });
      setForm(res.profile);
      notify.success("Perfil actualizado");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <form id="profile-form" noValidate onSubmit={save} className="space-y-4">
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </div>
      )}
      <InputGroupField
        id="profile-fullName"
        label="Nombre"
        leftIcon={<User className="size-4" />}
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        required
        error={errors.fullName}
      />
      <InputGroupField
        id="profile-email"
        label="Email"
        helper="Se guarda en minúsculas."
        type="email"
        leftIcon={<Mail className="size-4" />}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
        required
        error={errors.email}
      />
      <InputGroupField
        id="profile-phone"
        label="Teléfono"
        helper="Solo 10 dígitos."
        inputMode="numeric"
        leftIcon={<Phone className="size-4" />}
        value={form.phone ?? ""}
        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
        error={errors.phone}
      />
      <Attachment
        label="Avatar"
        helper="Tu foto de perfil."
        value={form.avatarUrl ?? ""}
        onChange={(url) => setForm({ ...form, avatarUrl: url ?? "" })}
        upload={uploadFile}
        accept={UPLOAD_IMAGE_ACCEPT}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          <Save className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/auth/change-password">
            <KeyRound className="size-4" /> Cambiar contraseña
          </Link>
        </Button>
      </div>
    </form>
  );
}
