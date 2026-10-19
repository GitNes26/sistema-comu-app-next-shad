// Fondo de marca (splash y acceso): pizarra profunda con círculos concéntricos que respiran,
// como el logotipo de la iglesia, y un resplandor del color primario. Sin imágenes.
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 38%, color-mix(in oklab, var(--primary) 26%, #0d1824), #0d1824 72%)" }}
    >
      <svg viewBox="0 0 800 800" className="absolute top-1/2 left-1/2 size-[135vmax] max-w-none -translate-x-1/2 -translate-y-1/2 text-white" fill="none">
        {[70, 130, 200, 280, 370, 470].map((r, i) => (
          <circle
            key={r}
            cx="400"
            cy="400"
            r={r}
            stroke="currentColor"
            strokeOpacity={Math.max(0.03, 0.14 - i * 0.02)}
            strokeWidth={i === 0 ? 2 : 1.2}
            className="brand-ring"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
      </svg>
      <div
        className="absolute top-[38%] left-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />
    </div>
  );
}
