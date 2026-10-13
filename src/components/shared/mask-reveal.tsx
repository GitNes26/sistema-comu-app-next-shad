"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════
 *  MaskReveal — Clip-path progressive reveal animation
 * ═══════════════════════════════════════════════════════════════
 *
 *  Implements the Masking principle of animation:
 *  "Reveal content by changing the shape of its container."
 *
 *  Presets:
 *    circle  — Expands from center (best for product images)
 *    inset   — Shrinks from edges inward (best for cards/sections)
 *    wipe    — Slides left-to-right (best for banners)
 *    diamond — Rotates in from center (decorative)
 */

export type MaskShape = "circle" | "inset" | "wipe" | "diamond"

interface MaskRevealProps {
  children: React.ReactNode
  /** Animation shape preset */
  shape?: MaskShape
  /** Delay before animation starts (seconds) */
  delay?: number
  /** Duration of the clip-path animation (seconds) */
  duration?: number
  /** Trigger on viewport entry (default true) */
  once?: boolean
  /** Custom className */
  className?: string
}

const clipPaths: Record<MaskShape, { initial: string; animate: string }> = {
  circle: {
    initial: "circle(0% at 50% 50%)",
    animate: "circle(75% at 50% 50%)",
  },
  inset: {
    initial: "inset(10% 10% 10% 10% round 12px)",
    animate: "inset(0% 0% 0% 0% round 0px)",
  },
  wipe: {
    initial: "inset(0% 100% 0% 0%)",
    animate: "inset(0% 0% 0% 0%)",
  },
  diamond: {
    initial: "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)",
    animate: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  },
}

export function MaskReveal({
  children,
  shape = "circle",
  delay = 0,
  duration = 0.6,
  once = true,
  className,
}: MaskRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: "-10% 0px" })
  const { initial, animate } = clipPaths[shape]

  return (
    <motion.div
      ref={ref}
      className={cn("overflow-hidden", className)}
      initial={{ clipPath: initial }}
      animate={isInView ? { clipPath: animate } : { clipPath: initial }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1], // EASE_OUT_EXPONENTIAL
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  MaskRevealImage — Image with clip-path reveal + scale
 * ═══════════════════════════════════════════════════════════════
 *
 *  Combines clip-path mask with a subtle scale animation
 *  for a more dynamic reveal effect. Best for product images,
 *  hero images, and promotional banners.
 */

interface MaskRevealImageProps {
  src: string
  alt: string
  shape?: MaskShape
  delay?: number
  /** Scale range: [from, to] */
  scale?: [number, number]
  className?: string
  imgClassName?: string
}

export function MaskRevealImage({
  src,
  alt,
  shape = "circle",
  delay = 0,
  scale = [1.08, 1],
  className,
  imgClassName,
}: MaskRevealImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" })
  const { initial, animate } = clipPaths[shape]

  return (
    <motion.div
      ref={ref}
      className={cn("overflow-hidden", className)}
      initial={{ clipPath: initial }}
      animate={isInView ? { clipPath: animate } : { clipPath: initial }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={src}
        alt={alt}
        className={cn("w-full h-full object-cover", imgClassName)}
        initial={{ scale: scale[0] }}
        animate={isInView ? { scale: scale[1] } : { scale: scale[0] }}
        transition={{
          duration: 0.8,
          delay: delay + 0.1,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
    </motion.div>
  )
}
