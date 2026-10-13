import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { BackButton } from "@/components/shared/back-button";

/** Marco común de las páginas legales: barra superior fija con flecha de regreso. */
export function LegalShell({
  backHref,
  backLabel = "Regresar",
  children,
}: {
  backHref: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="safe-area-top sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-2 sm:px-4">
          <BackButton fallback={backHref} label={backLabel} showLabel />
          <Link href="/" aria-label="Inicio" className="ml-auto flex items-center pr-2">
            <Logo size={20} />
          </Link>
        </div>
      </header>
      <main className="safe-area-bottom px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
