"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fallback de error reutilizable para error boundaries.

export function ErrorBoundaryFallback({
  title = "Algo salió mal",
  description = "Ocurrió un error inesperado. Inténtalo de nuevo.",
  reset,
}: {
  title?: string;
  description?: string;
  reset?: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {reset && (
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
      )}
    </div>
  );
}
