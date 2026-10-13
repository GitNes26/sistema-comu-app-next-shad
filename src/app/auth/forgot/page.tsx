import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar acceso o activar cuenta" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell backHref="/auth/login"
      footerLinks={
        <>
          <a href="/auth/login" className="hover:text-foreground hover:underline">
            Volver al inicio de sesión
          </a>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
