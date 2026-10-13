import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { processUploadedImage } from "@/lib/uploads/image-process";
import { uploadedFilePath, uploadedMediaUrl } from "@/lib/uploads/storage";

// Subida de imágenes (Attachment) a almacenamiento local.
// POST /api/uploads (multipart, campo "file"). Las imágenes quedan en
// <UPLOADS_DIR>/<UPLOADS_PROJECT>/<orgId>/ y se sirven mediante /api/media/…
//
// Toda imagen se normaliza antes de guardarse (ver lib/uploads/image-process):
// reescalado a 1024px y recodificación a WebP, para acotar el almacenamiento y
// que el catálogo renderice rápido en tabletas/móviles. Además se genera una
// miniatura de 256px (…-thumb.webp) para las cuadrículas densas. Los GIF pasan
// intactos (sin miniatura) y si el procesador falla se guarda el original.

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json({ ok: false, error: "Enviá el campo «file» con tu imagen" }, { status: 400 });
    }
    file = f;
  } catch {
    return NextResponse.json({ ok: false, error: "Formato de envío inválido" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "La imagen excede 5 MB" }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Solo se permiten JPG, PNG, WEBP y GIF" }, { status: 415 });
  }

  try {
    const processed = await processUploadedImage(
      Buffer.from(await file.arrayBuffer()),
      file.type
    );

    const base = randomUUID();
    const name = `${base}.${processed.ext}`;
    const filePath = uploadedFilePath(organizationId, name);
    if (!filePath) throw new Error("Ruta de almacenamiento inválida");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, processed.buffer);
    const url = uploadedMediaUrl(organizationId, name);

    // Miniatura para cuadrículas densas (POS, ticket, chips): hereda el nombre
    // base, así un thumbnail siempre es reconocible junto a su original.
    let thumbUrl: string | null = null;
    if (processed.thumb) {
      const thumbName = `${base}-thumb.webp`;
      const thumbPath = uploadedFilePath(organizationId, thumbName);
      if (!thumbPath) throw new Error("Ruta de miniatura inválida");
      await writeFile(thumbPath, processed.thumb);
      thumbUrl = uploadedMediaUrl(organizationId, thumbName);
    }

    return NextResponse.json({ ok: true, url, thumbUrl });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la imagen" }, { status: 500 });
  }
}
