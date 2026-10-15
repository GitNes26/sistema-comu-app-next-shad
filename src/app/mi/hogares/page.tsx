import { redirect } from "next/navigation"

// Antes era una página aparte; el buscador ahora vive en «Mi hogar de amor».
export default function HomesRedirect() {
  redirect("/mi/celulas?buscar=1")
}
