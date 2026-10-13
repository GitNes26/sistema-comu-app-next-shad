"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Lock, User, ArrowRight, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InputGroupField } from "@/components/base/input-group-field"
import { cn } from "@/lib/utils"

// Selector de iglesia del login (multi-iglesia): tras escribir el identificador,
// quien pertenece a varias iglesias puede elegir a cuál entrar antes de
// autenticarse; la elección viaja en signIn() y define rol, permisos e iglesia
// activa. La lista viene de /api/auth/org-hint, con respuestas neutras cuando el
// identificador no existe o no tiene iglesias.
interface OrgHint {
  id: string
  name: string
  isLast: boolean
}
interface OrgHintResponse {
  lastOrg: { id: string; name: string } | null
  organizations: { id: string; name: string }[]
}

const validationSchema = yup.object({
  identifier: yup
    .string()
    .required("Escribe tu correo, teléfono o código de creyente")
    .min(3, "Demasiado corto"),
  password: yup.string().required("Contraseña requerida").min(6, "Mínimo 6 caracteres"),
})

type LoginValues = yup.InferType<typeof validationSchema>

export function LoginForm({
  callbackUrl,
  error: nextAuthError,
}: {
  callbackUrl?: string | null
  error?: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [orgHint, setOrgHint] = useState<OrgHint[] | null>(null)
  const [pickedOrgId, setPickedOrgId] = useState<string>("")
  const [hintDelay] = useState(() => ({ timer: null as ReturnType<typeof setTimeout> | null }))

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: { identifier: "", password: "" },
  })
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus("identifier"))
    return () => cancelAnimationFrame(frame)
  }, [setFocus])

  /** Busca la lista de iglesias del identificador con debounce; limpia al vaciar. */
  function onIdentifierChange(value: string) {
    if (hintDelay.timer) clearTimeout(hintDelay.timer)
    const v = value.trim()
    if (v.length < 5) {
      setOrgHint(null)
      setPickedOrgId("")
      return
    }
    hintDelay.timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/org-hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: v }),
        })
        if (!res.ok) return
        const data = (await res.json()) as OrgHintResponse
        if (!data.organizations || data.organizations.length < 2) {
          // Una sola iglesia (o ninguna): sin selector.
          setOrgHint(null)
          setPickedOrgId("")
          return
        }
        setOrgHint(data.organizations.map((o) => ({ ...o, isLast: data.lastOrg?.id === o.id })))
        // Preseleccionar la iglesia recordada (sin override del usuario).
        setPickedOrgId(data.lastOrg?.id ?? "")
      } catch {
        // Pista best-effort: sin conexión, el login funciona igual.
      }
    }, 600)
  }

  async function runLogin(identifier: string, password: string) {
    setLoading(true)
    setError(null)
    const res = await signIn("credentials", {
      identifier,
      password,
      organizationId: pickedOrgId || undefined,
      redirect: false,
      callbackUrl: callbackUrl ?? undefined,
    })
    setLoading(false)
    if (res?.error) {
      setError("Credenciales incorrectas o usuario inactivo.")
      return
    }
    if (res?.url) router.push(res.url)
    else router.refresh()
  }

  function onSubmit(values: LoginValues) {
    void runLogin(values.identifier, values.password)
  }

  return (
    <div className="w-full max-w-sm">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-6">
          <h2 className="font-heading text-xl font-semibold tracking-tight">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entra con tu correo, tu teléfono (10 dígitos) o tu código de creyente.
          </p>
        </div>
        <div>
          {(error ?? nextAuthError) && (
            <Alert variant="destructive" className="mb-4 animate-rise-in" role="alert">
              <AlertDescription className="text-sm">
                {error ?? "No se pudo iniciar sesión. Revisa tus credenciales."}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {orgHint && orgHint.length >= 2 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  <Building2 className="mr-1 inline size-3.5" />
                  Entrar a
                </Label>
                <Select value={pickedOrgId || undefined} onValueChange={setPickedOrgId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Iglesia (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgHint.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{o.name}</span>
                          {o.isLast && <span className="text-xs text-success">· última vez</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <InputGroupField
              id="identifier"
              label="Correo, teléfono o código"
              leftIcon={<User className="size-4" />}
              autoComplete="username"
              placeholder="tu correo, teléfono o código de creyente"
              className="h-12 text-base rounded-xl desk:h-11 desk:rounded-xl"
              error={errors.identifier?.message}
              {...register("identifier", {
                onChange: (e) => onIdentifierChange(e.target.value),
              })}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
                <Link href="/auth/forgot" className="text-xs text-primary underline-offset-4 hover:underline">
                  Recuperar o activar cuenta
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={cn(
                    "h-12 pl-11 md:pl-11 desk:pl-11 pr-12 md:pr-12 desk:pr-12 text-base rounded-xl desk:h-11 desk:rounded-xl",
                    errors.password && "border-destructive"
                  )}
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold desk:h-11 desk:rounded-xl desk:text-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> Entrando…
                </>
              ) : (
                <>
                  Entrar <ArrowRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
