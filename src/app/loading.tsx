import { BrandLoader } from "@/components/shared/brand-loader"

// Carga entre pantallas: la marca en lugar de un giro genérico.
export default function Loading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <BrandLoader />
    </div>
  )
}
