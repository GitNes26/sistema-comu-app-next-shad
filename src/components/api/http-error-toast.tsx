"use client";

import { useEffect } from "react";
import { installForbiddenToast } from "@/lib/api/forbidden-toast";

// Monta una sola vez el interceptor global que muestra un toast cuando un
// endpoint devuelve 403 (usuario autenticado sin permiso).
export function HttpErrorToast() {
  useEffect(() => {
    installForbiddenToast();
  }, []);
  return null;
}