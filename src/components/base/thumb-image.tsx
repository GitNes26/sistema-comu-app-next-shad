"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { thumbnailUrl } from "@/lib/uploads";

/**
 * <img> con miniatura: sirve la versión -thumb.webp generada en la subida
 * cuando la URL apunta al almacenamiento local, con degradación elegante a la
 * imagen completa si la miniatura no existe (subidas previas a la variante).
 *
 * Para cuadrículas densas (POS, portal, ticket, chips): una pantalla de
 * catálogo baja de megabytes a decenas de KB sin cambiar el flujo de datos —
 * el par original+thumb se crea en el mismo POST /api/uploads.
 *
 * `layoutId` (opcional) mantiene la transición compartida de framer-motion
 * (tarjeta → detalle del portal) usando la miniatura como fuente.
 */
export function ThumbImage({
  src,
  alt,
  className,
  layoutId,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  layoutId?: string;
}) {
  const thumb = thumbnailUrl(src);
  const [failed, setFailed] = useState(false);
  const effective = thumb && !failed ? thumb : src;

  if (!effective) return null;

  const handleError = () => {
    if (thumb && effective === thumb) setFailed(true);
  };

  if (layoutId) {
    return (
      <motion.img
        layoutId={layoutId}
        src={effective}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onError={handleError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={effective}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
}
