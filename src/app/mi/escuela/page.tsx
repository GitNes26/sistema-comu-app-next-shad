import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SchoolPortal } from "@/components/school/school-portal"

export const metadata: Metadata = { title: "Mi escuela" }

// Portal educativo: lo propio (mi libro, mis grupos) sale de la relación; el
// catálogo es para todos y permite solicitar inscripción.
export default function MySchoolPage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mi escuela</h1>
        <p className="text-sm text-muted-foreground">Escuela de ministerio y Universidad Teológica.</p>
      </div>
      <SchoolPortal adminHref="/admin/school" />
    </div>
  )
}
