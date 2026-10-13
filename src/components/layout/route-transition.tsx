"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { pageTransition } from "@/lib/animation-tokens";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const depthOf = (path: string) => path.split("/").filter(Boolean).length;

// Transición de rutas con Motion.
// variant="native" (portal): push/pop con dirección según la profundidad de la
// ruta, como una pila de navegación móvil; entre pestañas del mismo nivel, un
// fundido corto. variant="subtle" (panel): solo un fundido con leve ascenso.
export function RouteTransition({
  children,
  variant = "subtle",
}: {
  children: React.ReactNode;
  variant?: "subtle" | "native";
}) {
  const pathname = usePathname();
  const prefersReduced = !!useReducedMotion();
  const prevPath = React.useRef(pathname);
  const direction = React.useRef<0 | 1 | -1>(0);

  if (prevPath.current !== pathname) {
    const delta = depthOf(pathname) - depthOf(prevPath.current);
    direction.current = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    prevPath.current = pathname;
  }

  if (variant === "native" && !prefersReduced) {
    const dir = direction.current;
    return (
      <motion.div
        key={pathname}
        initial={dir === 0 ? { opacity: 0, scale: 0.985 } : { opacity: 0, x: 28 * dir }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: dir === 0 ? 0.2 : 0.32, ease: EASE_OUT_EXPO }}
      >
        {children}
      </motion.div>
    );
  }

  const variants = pageTransition(prefersReduced);
  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: prefersReduced ? 0 : 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
