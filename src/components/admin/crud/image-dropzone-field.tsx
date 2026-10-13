"use client";

import { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/uploads";
import { useImageDropzone } from "@/hooks/use-image-dropzone";

/**
 * Campo de imagen con zona de arrastre para formularios CRUD.
 *
 * Misma plumbing que el dialog de imágenes en lote y el de variantes
 * (useImageDropzone): clic o suelta una foto, se sube al momento con el
 * mismo `uploadFile` de /api/uploads y guarda la URL devuelta en el campo.
 * Sin recorte — a diferencia de Attachment, el venue controla el encuadre
 * antes de subir (o quiere la foto tal cual).
 */
export function ImageDropzoneField({
  value,
  onChange,
  widthClass = "h-20 w-20",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Clases Tailwind del cuadro (default 80×80). */
  widthClass?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const dropzone = useImageDropzone({
    subject: "la imagen",
    onFile: (file) => void change(file),
  });

  const change = async (file: File) => {
    setBusy(true);
    setError(undefined);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
      {dropzone.inputs.image}
      <button
        type="button"
        title={value ? "Cambiar imagen (clic o arrastrar)" : "Subir imagen (clic o arrastrar)"}
        onClick={dropzone.openPicker}
        {...dropzone.dragHandlers}
        aria-busy={busy}
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
          widthClass,
          dropzone.dragging && "border-primary bg-primary/5 ring-2 ring-primary/30",
          error && "border-destructive"
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="size-6" />
        )}
      </button>
      {value && !busy && (
        <button
          type="button"
          title="Quitar imagen"
          onClick={remove}
          className="flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        {value ? "Clic o arrastra para cambiar" : "Clic o arrastra una foto aquí"}
      </p>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
