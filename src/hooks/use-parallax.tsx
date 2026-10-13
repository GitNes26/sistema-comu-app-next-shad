"use client"

import { useRef } from "react"
import { useScroll, useTransform, type MotionValue } from "framer-motion"

/**
 * ═══════════════════════════════════════════════════════════════
 *  useParallax — Scroll-driven parallax motion values
 * ═══════════════════════════════════════════════════════════════
 *
 *  Implements the Parallax principle of animation:
 *  "Elements moving at different speeds based on scroll position."
 *
 *  Usage:
 *    const { ref, y } = useParallax(0.3)
 *    <div ref={ref}>
 *      <motion.div style={{ y }}>Moves at 30% of scroll speed</motion.div>
 *    </div>
 *
 *  Speed values:
 *    0.1  — Very subtle (background textures)
 *    0.3  — Noticeable but not distracting (banner images)
 *    0.5  — Strong (hero decorative elements)
 *    1.0  — Normal scroll speed (content, no parallax)
 *    >1.0 — Faster than scroll (foreground emphasis)
 */

interface UseParallaxOptions {
  /** Parallax speed factor (default: 0.3). Negative = opposite direction. */
  speed?: number
  /** Offset for when the effect starts/ends (default: ["start end", "end start"]) */
  offset?: [string, string]
  /** Enable/disable the effect (default: true) */
  enabled?: boolean
}

interface UseParallaxReturn {
  /** Ref to attach to the scroll container element */
  ref: React.RefObject<HTMLDivElement | null>
  /** Motion value for vertical translation */
  y: MotionValue<number>
  /** Motion value for vertical rotation (subtle tilt) */
  rotateX: MotionValue<number>
  /** Motion value for opacity based on scroll position */
  opacity: MotionValue<number>
  /** Raw scroll progress (0 → 1) */
  progress: MotionValue<number>
}

export function useParallax(
  speed: number = 0.3,
  options: UseParallaxOptions = {}
): UseParallaxReturn {
  const { offset = ["start end", "end start"], enabled = true } = options
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offset: offset as any,
  })

  // Vertical translation: maps scroll progress to pixel offset
  // speed of 0.3 means the element moves 30% of the scroll distance
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    enabled ? [speed * -100, speed * 100] : [0, 0]
  )

  // Subtle rotation for depth effect (max ±3 degrees)
  const rotateX = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    enabled ? [-speed * 2, 0, speed * 2] : [0, 0, 0]
  )

  // Opacity: fades in as element enters, fades out as it leaves
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    enabled ? [0.3, 1, 1, 0.3] : [1, 1, 1, 1]
  )

  return { ref, y, rotateX, opacity, progress: scrollYProgress }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  useHorizontalParallax — Parallax for horizontally scrolling elements
 * ═══════════════════════════════════════════════════════════════
 *
 *  Tracks horizontal scroll position of a container and returns
 *  a motion value that maps to the scroll offset. Use this for
 *  banner carousels, horizontal product lists, etc.
 *
 *  Usage:
 *    const { ref, x } = useHorizontalParallax(0.15)
 *    <div ref={ref} className="overflow-x-auto flex gap-3">
 *      <motion.div style={{ x }}>Item moves at 15% of scroll</motion.div>
 *    </div>
 */

interface UseHorizontalParallaxOptions {
  /** Parallax speed factor (default: 0.15) */
  speed?: number
  /** Enable/disable the effect (default: true) */
  enabled?: boolean
}

interface UseHorizontalParallaxReturn {
  /** Ref to attach to the horizontally scrolling container */
  ref: React.RefObject<HTMLDivElement | null>
  /** Motion value for horizontal translation */
  x: MotionValue<number>
  /** Raw scroll progress (0 → 1) */
  progress: MotionValue<number>
}

export function useHorizontalParallax(
  speed: number = 0.15,
  options: UseHorizontalParallaxOptions = {}
): UseHorizontalParallaxReturn {
  const { enabled = true } = options
  const ref = useRef<HTMLDivElement>(null)

  const { scrollXProgress } = useScroll({
    target: ref,
    axis: "x",
    offset: ["start start", "end end"],
  })

  // Maps horizontal scroll progress to pixel offset
  const x = useTransform(
    scrollXProgress,
    [0, 1],
    enabled ? [speed * -200, speed * 200] : [0, 0]
  )

  return { ref, x, progress: scrollXProgress }
}
