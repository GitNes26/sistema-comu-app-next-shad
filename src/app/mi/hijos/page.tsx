import { redirect } from "next/navigation"

// Los hijos viven dentro de «Mi familia»; este enlace se conserva para avisos y accesos viejos.
export default function MyKidsRedirect() {
  redirect("/mi/familia#hijos")
}
