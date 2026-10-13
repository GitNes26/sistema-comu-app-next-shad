"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { swalError } from "@/lib/swal";
import { notify } from "@/lib/notify";
import { UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";

/**
 * Plumbing compartido para cargar imágenes por archivo o arrastre.
 *
 * Centraliza lo que antes estaba duplicado entre el dialog de imágenes en
 * lote, el dialog de variantes y los formularios CRUD con Attachment:
 * - input de archivo oculto + `openPicker()` (un solo input sirve a N zonas),
 * - estado de arrastre (`dragging`) con handlers listos para onDragOver/
 *   onDragLeave/onDrop,
 * - validación de tipo y tamaño (accept = UPLOAD_IMAGE_ACCEPT, 5 MB),
 * - extracción de un ZIP en el cliente: aplane carpetas, ignora metadatos del
 *   SO (__MACOSX, ._, .) y deduplica por nombre de archivo.
 *
 * Los consumidores deciden qué hacer con cada archivo vía `onFiles`; nada se
 * sube aquí — cada superficie tiene su propio flujo de guardado.
 */

/** Extensiones de imagen aceptadas dentro de un ZIP → content-type. */
export const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Espejo del límite de /api/uploads. */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Tope del archivo ZIP completo. */
export const MAX_ZIP_SIZE = 100 * 1024 * 1024;

const ACCEPTED_TYPES = UPLOAD_IMAGE_ACCEPT.split(",");

export interface ExtractedImage {
  name: string;
  bytes: ArrayBuffer;
  type: string;
}

export interface ZipImportResult {
  images: ExtractedImage[];
  skippedMeta: number;
  skippedDupes: number;
}

/**
 * Extrae las imágenes de un ZIP en el cliente. Aplana la estructura de
 * carpetas (`fotos/abarrotes/arroz.jpg` → `arroz.jpg`): el emparejamiento por
 * nombre funciona igual venga el ZIP del origen que venga.
 */
export async function extractZipImages(file: File): Promise<ZipImportResult> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const images: ExtractedImage[] = [];
  const seen = new Set<string>();
  let skippedMeta = 0;
  let skippedDupes = 0;

  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue;
    const base = entry.name.split("/").pop() ?? "";
    if (!base || base.startsWith("__MACOSX") || base.startsWith("._") || base.startsWith(".")) {
      skippedMeta++;
      continue;
    }
    const ext = base.split(".").pop()?.toLowerCase() ?? "";
    const type = TYPE_BY_EXT[ext];
    if (!type) {
      skippedMeta++;
      continue;
    }
    const key = base.toLowerCase();
    if (seen.has(key)) {
      skippedDupes++;
      continue;
    }
    seen.add(key);
    const bytes = await entry.async("arraybuffer");
    images.push({ name: base, bytes, type });
  }

  return { images, skippedMeta, skippedDupes };
}

export function useImageDropzone(options: {
  /** Recibe cada archivo validado (uno por drop del usuario o del ZIP). */
  onFile: (file: File) => void;
  /** Lote de imágenes extraídas de un ZIP (opcional: activa la importación de archivos). */
  onZipImages?: (images: ExtractedImage[]) => void;
  /** Etiqueta corta para los errores de validación (p. ej. "la variante"). */
  subject?: string;
}) {
  const { onFile, onZipImages, subject = "la imagen" } = options;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const validate = useCallback(
    (file: File): boolean => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        swalError("Formato no permitido", "Solo se permiten JPG, PNG, WEBP y GIF.");
        return false;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        swalError("Imagen muy grande", `${subject[0].toUpperCase()}${subject.slice(1)} excede 5 MB.`);
        return false;
      }
      return true;
    },
    [subject]
  );

  /** Valida y entrega un archivo suelto al consumidor. */
  const acceptFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (validate(file)) onFile(file);
    },
    [onFile, validate]
  );

  /** Abre el picker de archivo único (cualquier zona puede llamarlo). */
  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  /** Abre el picker de ZIP. */
  const openZipPicker = useCallback(() => {
    zipInputRef.current?.click();
  }, []);

  /** Importa un archivo ZIP y entrega las imágenes extraídas al consumidor. */
  const importZip = useCallback(
    async (zipFile: File | null | undefined) => {
      if (!zipFile || !onZipImages) return;
      if (zipFile.size > MAX_ZIP_SIZE) {
        swalError("ZIP muy grande", `El archivo excede ${MAX_ZIP_SIZE / (1024 * 1024)} MB.`);
        return;
      }
      setZipBusy(true);
      try {
        const { images, skippedMeta, skippedDupes } = await extractZipImages(zipFile);
        onZipImages(images);
        if (skippedMeta > 0 || skippedDupes > 0) {
          const parts: string[] = [];
          if (skippedMeta > 0) parts.push(`${skippedMeta} no reconocidos`);
          if (skippedDupes > 0) parts.push(`${skippedDupes} duplicados`);
          notify.success(`ZIP: ${parts.join(" · ")} omitidos`);
        }
      } catch {
        swalError("ZIP inválido", "No se pudo leer el archivo. ¿Es un ZIP válido?");
      } finally {
        setZipBusy(false);
      }
    },
    [onZipImages]
  );

  /** Handlers listos para esparcir sobre cualquier contenedor arrastrable. */
  const dragHandlers = useMemo(
    () => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        const zips = files.filter((f) => /\.zip$/i.test(f.name));
        const images = files.filter((f) => !/\.zip$/i.test(f.name));
        for (const image of images) acceptFile(image);
        for (const zip of zips) void importZip(zip);
      },
    }),
    [acceptFile, importZip]
  );

  /** Elementos <input> ocultos que el consumidor renderiza fuera de su HTML sensible. */
  const inputs = useMemo(
    () => ({
      image: (
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            acceptFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      ),
      zip: (
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => {
            void importZip(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      ),
    }),
    [acceptFile, importZip]
  );

  // Los archivos arrastrados quedan validados y reenviados; el consumidor no
  // necesita hacer cleanup (no creamos object URLs aquí).
  useEffect(() => {
    return () => setDragging(false);
  }, []);

  return {
    dragging,
    zipBusy,
    dragHandlers,
    openPicker,
    openZipPicker,
    importZip,
    acceptFile,
    inputs,
  };
}
