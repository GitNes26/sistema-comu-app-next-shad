"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputGroupField } from "@/components/base/input-group-field"

const schema = yup.object({
  password: yup
    .string()
    .required("Contraseña requerida")
    .min(8, "Mínimo 8 caracteres"),
  confirm: yup
    .string()
    .oneOf([yup.ref("password")], "Las contraseñas no coinciden")
    .required("Confirma tu contraseña"),
  acceptedLegal: yup.boolean().oneOf([true], "Debes aceptar los términos y el aviso de privacidad").required(),
})

type Values = yup.InferType<typeof schema>

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({ resolver: yupResolver(schema) })

  if (!token) {
    return (
      <section className="w-full max-w-sm animate-rise-in">
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              Enlace inválido.{" "}
              <Link
                href="/auth/forgot"
                className="underline underline-offset-4"
              >
                Solicita uno nuevo
              </Link>
              .
            </AlertDescription>
          </Alert>
        </div>
      </section>
    )
  }

  async function onSubmit(values: Values) {
    setStatus({ kind: "loading" })
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password, acceptedLegal: values.acceptedLegal }),
    })
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    if (!res.ok) {
      setStatus({
        kind: "error",
        message: data?.error ?? "No se pudo restablecer",
      })
      return
    }
    setStatus({ kind: "ok" })
  }

  return (
    <section className="w-full max-w-sm animate-rise-in">
      <header className="mb-6 space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Nueva contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Elige una nueva contraseña para tu cuenta.
        </p>
      </header>
      <div className="space-y-4">
        {status.kind === "ok" && (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertDescription className="space-y-1">
              <p>¡Contraseña actualizada!</p>
              <Link
                href="/auth/login"
                className="font-semibold underline underline-offset-4"
              >
                Iniciar sesión
              </Link>
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
            id="password"
            label="Nueva contraseña"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="space-y-2">
            <label htmlFor="acceptedLegal" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-5">
              <Checkbox id="acceptedLegal" checked={watch("acceptedLegal") === true} onCheckedChange={(checked) => setValue("acceptedLegal", checked === true, { shouldValidate: true })} aria-invalid={Boolean(errors.acceptedLegal)} />
              <span>Acepto los <Link href="/legal/terminos" target="_blank" className="font-medium text-primary underline underline-offset-4">Términos de uso</Link>, las <Link href="/legal/comercio" target="_blank" className="font-medium text-primary underline underline-offset-4">Condiciones de compra</Link> y el <Link href="/legal/privacidad" target="_blank" className="font-medium text-primary underline underline-offset-4">Aviso de privacidad</Link>.</span>
            </label>
            {errors.acceptedLegal && <p role="alert" className="text-xs text-destructive">{errors.acceptedLegal.message}</p>}
          </div>

          <InputGroupField
            id="confirm"
            label="Confirmar contraseña"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register("confirm")}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            Guardar contraseña
          </Button>
        </form>
      </div>
    </section>
  )
}
