import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { homeForSession } from "@/lib/auth/redirect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata: Metadata = { title: "Cuenta sin iglesia" };

// Una cuenta sin iglesia asignada no puede operar: las altas las hace el
// superadmin (iglesia nueva) o el administrador de la iglesia (invitación).
export default async function NoChurchPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  if (session.user.scope === "superadmin" || session.user.activeOrganizationId || session.user.organizationId) {
    redirect(homeForSession(session));
  }

  return (
    <AuthShell backHref="/auth/login">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Tu cuenta aún no tiene iglesia</CardTitle>
          <CardDescription>
            Pide al administrador de tu iglesia que active tu acceso. En cuanto lo haga podrás
            entrar a tu espacio personal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignOutButton />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
