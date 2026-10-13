"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { SPRING_SNAPPY, SPRING_BOUNCE } from "@/lib/animation-tokens"
import { haptic } from "@/lib/haptics"

/**
 * ═══════════════════════════════════════════════════════════════
 *  ExpandableFAB — Cloning principle implementation
 * ═══════════════════════════════════════════════════════════════
 *
 *  A floating action button that "clones" itself into multiple
 *  sub-actions when tapped. Each sub-button fans out with a
 *  staggered spring animation from the center.
 *
 *  Usage:
 *    <ExpandableFAB actions={[
 *      { icon: Scan, label: "Escanear", onClick: () => {} },
 *      { icon: Share2, label: "Compartir", onClick: () => {} },
 *    ]} />
 */

export interface FABAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  /** Optional color class for the action button */
  color?: string
}

interface ExpandableFABProps {
  actions: FABAction[]
  /** Main FAB icon when collapsed (default: Plus) */
  mainIcon?: React.ReactNode
  /** Position class (default: bottom-right) */
  className?: string
  /** Size of the main FAB */
  size?: "sm" | "md" | "lg"
}

export function ExpandableFAB({
  actions,
  mainIcon,
  className,
  size = "md",
}: ExpandableFABProps) {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => {
    haptic.medium()
    setExpanded((prev) => !prev)
  }

  const handleAction = (action: FABAction) => {
    haptic.light()
    setExpanded(false)
    action.onClick()
  }

  const sizeClasses = {
    sm: "size-11",
    md: "size-14",
    lg: "size-16",
  }

  const iconSize = {
    sm: "size-5",
    md: "size-6",
    lg: "size-6",
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col-reverse items-center gap-3",
        className
      )}
    >
      {/* Overlay backdrop */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={toggle}
          />
        )}
      </AnimatePresence>

      {/* Sub-actions — fan out upward */}
      <AnimatePresence>
        {expanded &&
          actions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ scale: 0, y: 20, opacity: 0 }}
              animate={{
                scale: 1,
                y: 0,
                opacity: 1,
              }}
              exit={{ scale: 0, y: 20, opacity: 0 }}
              transition={{
                ...SPRING_SNAPPY,
                delay: (actions.length - 1 - i) * 0.05,
              }}
              type="button"
              onClick={() => handleAction(action)}
              className={cn(
                "group relative flex items-center gap-2 rounded-full bg-background shadow-lg border border-border/60 pr-4 pl-1",
                action.color
              )}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {action.icon}
              </div>
              <span className="text-sm font-medium whitespace-nowrap">
                {action.label}
              </span>
            </motion.button>
          ))}
      </AnimatePresence>

      {/* Main FAB — rotates when expanded */}
      <motion.button
        type="button"
        onClick={toggle}
        className={cn(
          "relative flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30",
          sizeClasses[size]
        )}
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: expanded ? 45 : 0 }}
        transition={SPRING_BOUNCE}
      >
        {expanded ? (
          <X className={iconSize[size]} />
        ) : (
          mainIcon ?? <Plus className={iconSize[size]} />
        )}

        {/* Pulse ring when collapsed */}
        {!expanded && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        )}
      </motion.button>
    </div>
  )
}
