"use client";

import { ErrorBoundaryFallback } from "@/components/shared/error-boundary";

// Error boundary global (raíz, con <html>/<body>).

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <ErrorBoundaryFallback
          title="Error crítico"
          description="El sistema no pudo cargar. Recarga la página."
          reset={reset}
        />
      </body>
    </html>
  );
}
