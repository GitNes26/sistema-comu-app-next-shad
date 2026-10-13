"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, TRANSITION_FADE } from "@/lib/animation-tokens";

// Empty state animado reutilizable.

export function EmptyState({
  icon: Icon,
  illustration: Illustration,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  /** Custom animated SVG illustration. When provided, replaces the icon. */
  illustration?: React.ComponentType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={TRANSITION_FADE}
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
    >
      {Illustration ? (
        <Illustration />
      ) : (
        <motion.span
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING_GENTLE}
        >
          <Icon className="size-12 text-muted-foreground/40" />
        </motion.span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mx-auto max-w-xs text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}
