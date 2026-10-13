import { cn } from "@/lib/utils";

// Logotipo reutilizable: muestra el logo de la iglesia si está disponible; si no,
// el ícono de COMU-APP (versión oscura en tema claro y clara en tema oscuro).

export function Logo({
  className,
  size = 24,
  logoUrl,
}: {
  className?: string;
  size?: number;
  logoUrl?: string | null;
}) {
  const boxSize = size + 8;

  if (logoUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background",
          className
        )}
        style={{ width: boxSize, height: boxSize }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="size-full object-contain p-0.5" draggable={false} />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: boxSize, height: boxSize }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/icon_dark.png" alt="" className="size-full object-contain dark:hidden" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/icon.png" alt="" className="hidden size-full object-contain dark:block" draggable={false} />
    </span>
  );
}
