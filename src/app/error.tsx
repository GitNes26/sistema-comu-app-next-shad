"use client";

import { ErrorBoundaryFallback } from "@/components/shared/error-boundary";

// Error boundary de rutas.

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryFallback reset={reset} />;
}
