"use client"

import { enqueueSnackbar, closeSnackbar, type OptionsObject, type SnackbarKey } from "notistack"

// Avisos normales (guardado, error leve, información, éxito) con notistack.
// SweetAlert2 (`@/lib/swal`) queda SOLO para alertas de gran impacto: confirmar
// acciones destructivas o irreversibles, errores críticos o bloqueos.

type Variant = "success" | "error" | "warning" | "info"

function show(variant: Variant, message: string, options?: OptionsObject): SnackbarKey {
  return enqueueSnackbar(message, { variant, ...options })
}

export const notify = {
  success: (message: string, options?: OptionsObject) => show("success", message, options),
  error: (message: string, options?: OptionsObject) => show("error", message, { autoHideDuration: 5000, ...options }),
  warning: (message: string, options?: OptionsObject) => show("warning", message, { autoHideDuration: 4500, ...options }),
  info: (message: string, options?: OptionsObject) => show("info", message, options),
  close: (key?: SnackbarKey) => closeSnackbar(key),
}
