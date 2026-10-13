"use client";

import { signOut } from "next-auth/react";

// Cierre de sesión central. Única vía para salir del sistema: elimina las
// credenciales/cookies de NextAuth y redirige al login.
//
// NOTA: la sesión es JWT (estateless), así que "eliminar credenciales" significa
// borrar las cookies de sesión (`next-auth.session-token` y `next-auth.csrf-token`),
// lo que hace `signOut()` de forma automática.
export function logout(callbackUrl = "/auth/login") {
  // El menú en caché pertenece a esta sesión; no debe verlo el siguiente usuario.
  try {
    sessionStorage.removeItem("comu-app-menu");
  } catch {
    // almacenamiento no disponible
  }
  return signOut({ callbackUrl });
}
