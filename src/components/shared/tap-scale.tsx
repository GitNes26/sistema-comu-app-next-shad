"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { SPRING_DEFAULT } from "@/lib/animation-tokens";
import { haptic } from "@/lib/haptics";

// Micro-interacción: scale on tap (0.97) + haptic feedback.

export function TapScale({
  children,
  className,
  onHaptic,
}: {
  children: ReactNode;
  className?: string;
  /** Override haptic level. "light" by default. Pass null to disable. */
  onHaptic?: "light" | "medium" | "heavy" | null;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={SPRING_DEFAULT}
      onPointerDown={() => {
        if (onHaptic === null) return;
        haptic[onHaptic ?? "light"]();
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
