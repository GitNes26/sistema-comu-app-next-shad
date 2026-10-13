"use client"

import { useState } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { CheckCircle2, KeyRound, Loader2, Lock, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputGroupField } from "@/components/base/input-group-field"

const schema = yup.object({
  oldPassword: yup.string().required("Contraseña actual requerida"),
  newPassword: yup
    .string()
    .required("Contraseña requerida")
    .min(8, "Mínimo 8 caracteres"),
  confirm: yup
    .string()
    .oneOf([yup.ref("newPassword")], "Las contraseñas no coinciden")
    .required("Confirma tu contraseña"),
  code: yup.string().matches(/^\d{6}$/, "Ingresa los 6 dígitos").required("Código requerido"),
})

type Values = yup.InferType<typeof schema>

export function ChangePasswordForm({ returnHref = "/auth/login" }: { returnHref?: string }) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" })
  const [codeSentTo, setCodeSentTo] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: yupResolver(schema) })

  async function onSubmit(values: Values) {
    setStatus({ kind: "loading" })
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
        code: values.code,
      }),
    })
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    if (!res.ok) {
      setStatus({
        kind: "error",
        message: data?.error ?? "No se pudo cambiar la contraseña",
      })
      return
    }
    reset()
    setStatus({ kind: "ok" })
    window.setTimeout(() => void signOut({ callbackUrl: returnHref.includes("portal") ? "/portal/auth/login" : "/auth/login" }), 1200)
  }

  return (
    <section className="w-full max-w-sm animate-rise-in">
      <header className="mb-6 space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Cambiar contraseña
        </h2>
      </header>
      <div className="space-y-4">
        {status.kind === "ok" && (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertDescription>
              Contraseña actualizada correctamente.
            </AlertDescription>
          </Alert>
        )}
        {status.kind === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <InputGroupField
            id="oldPassword"
            label="Contraseña actual"
            type="password"
            leftIcon={<Lock className="size-4" />}
            autoComplete="current-password"
            error={errors.oldPassword?.message}
            {...register("oldPassword")}
          />

          <InputGroupField
            id="newPassword"
            label="Nueva contraseña"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <InputGroupField
            id="confirm"
            label="Confirmar contraseña"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register("confirm")}
          />

          <div className="space-y-2">
            <InputGroupField
              id="code"
              label="Código de verificación"
              leftIcon={<MailCheck className="size-4" />}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              error={errors.code?.message}
              {...register("code")}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                setStatus({ kind: "loading" })
                const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request-code" }) })
                const data = await response.json().catch(() => ({})) as { error?: string; maskedEmail?: string }
                if (!response.ok) setStatus({ kind: "error", message: data.error ?? "No se pudo enviar el código" })
                else { setCodeSentTo(data.maskedEmail ?? "tu correo"); setStatus({ kind: "idle" }) }
              }}
              disabled={status.kind === "loading"}
            >
              <MailCheck className="size-4" /> {codeSentTo ? "Reenviar código" : "Enviar código a mi correo"}
            </Button>
            {codeSentTo && <p className="text-xs text-muted-foreground">Código enviado a {codeSentTo}. Vence en 10 minutos.</p>}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Lock />
            )}
            Actualizar contraseña
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href={returnHref} className="underline underline-offset-4">
            {returnHref === "/portal/profile" ? "Volver a mi perfil" : "Volver al inicio de sesión"}
          </Link>
        </p>
      </div>
    </section>
  )
}
