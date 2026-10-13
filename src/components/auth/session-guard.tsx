"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Guard de sesión en vivo (solo admin y portal, no POS).
// Si la sesión se invalida/expira mientras el usuario está en la página,
// lo redirige al login respetando la ruta de origen (callbackUrl).
export function SessionGuard({
  loginPath,
  children,
}: {
  loginPath: string;
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    router.replace(`${loginPath}?callbackUrl=${encodeURIComponent(pathname)}`);
  }, [status, loginPath, pathname, router]);

  return <>{children}</>;
}
