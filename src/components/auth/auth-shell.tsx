import Link from "next/link";
import { BookOpenText, HandHeart, Home } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BackButton } from "@/components/shared/back-button";
import { HeroBackground } from "@/components/shared/hero-background";
import { CHURCH_MOTTO, getChurchBrand } from "@/lib/brand/server";
import packageJson from "../../../package.json";

// Pantalla de acceso con la marca de la iglesia: panel oscuro con los círculos del logotipo
// (tablet horizontal y escritorio) y formulario a la derecha. En teléfono, una banda de marca
// arriba y el formulario como hoja que sube sobre ella.

const HEADLINE = "¡Bienvenido a casa!";
const POINTS = [
  { icon: Home, text: "Tu camino, tu hogar de amor y tu escuela en un solo lugar" },
  { icon: HandHeart, text: "Avisos, oración y reuniones de tu iglesia" },
  { icon: BookOpenText, text: "Familia es lo que somos, comunidad es lo que hacemos" },
] as const;

export async function AuthShell({
  children,
  footerLinks,
  logoUrl,
  backHref = "/",
}: {
  children: React.ReactNode;
  footerLinks?: React.ReactNode;
  logoUrl?: string | null;
  /** Adónde lleva la flecha de regreso si no hay página previa del sitio. */
  backHref?: string;
}) {
  const brand = await getChurchBrand();
  const logo = logoUrl ?? brand.logoUrl;
  const home = "/";

  return (
    <div className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ── Panel de marca (tablet horizontal / escritorio) ── */}
      <aside className="dark relative hidden overflow-hidden text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <HeroBackground />
        <Link href={home} className="relative flex w-fit items-center gap-3 font-heading text-lg font-semibold tracking-tight">
          <Logo size={34} logoUrl={logo} className="rounded-2xl" />
          {brand.name}
        </Link>

        <div className="relative max-w-md animate-rise-in">
          <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">{HEADLINE}</h1>
          <p className="mt-3 text-base text-muted-foreground italic">{CHURCH_MOTTO}</p>
          <ul className="mt-8 space-y-3">
            {POINTS.slice(0, 2).map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary-foreground">
                  <Icon className="size-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">COMU-APP v{packageJson.version}</p>
      </aside>

      {/* ── Banda de marca (teléfono) ── */}
      <header className="dark relative overflow-hidden text-foreground lg:hidden">
        <HeroBackground />
        <div className="relative px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-14 sm:px-8">
          <nav aria-label="Navegación" className="-ml-2">
            <BackButton fallback={backHref} showLabel />
          </nav>
          <Link href={home} className="mt-3 flex w-fit items-center gap-3 font-heading text-lg font-semibold tracking-tight">
            <Logo size={34} logoUrl={logo} className="rounded-2xl" />
            {brand.name}
          </Link>
          <p className="mt-4 font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">{HEADLINE}</p>
          <p className="mt-1 text-sm text-muted-foreground italic">{CHURCH_MOTTO}</p>
        </div>
      </header>

      {/* ── Formulario ── */}
      <main className="safe-area-bottom relative -mt-8 flex min-h-0 flex-col rounded-t-3xl bg-background px-5 pt-6 pb-8 sm:px-8 lg:mt-0 lg:min-h-dvh lg:rounded-none lg:pt-5">
        <nav aria-label="Navegación" className="-ml-2 hidden lg:block">
          <BackButton fallback={backHref} showLabel />
        </nav>
        <div className="flex flex-1 flex-col items-center justify-center lg:pt-4">
          <div className="flex w-full justify-center">{children}</div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {footerLinks}
          <Link href="/legal/terminos" className="py-1 hover:text-foreground hover:underline">Términos</Link>
          <Link href="/legal/privacidad" className="py-1 hover:text-foreground hover:underline">Privacidad</Link>
          <span className="w-full text-center text-xs text-muted-foreground/70 lg:hidden">
            v{packageJson.version}
          </span>
        </footer>
      </main>
    </div>
  );
}
