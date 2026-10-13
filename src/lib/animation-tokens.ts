/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Animation Design System — COMU-APP
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Single source of truth for all motion parameters.
 *  Import from here instead of hardcoding spring/duration/ease values.
 *
 *  Naming convention:
 *    SPRING_*   — Spring configs (type: "spring", stiffness, damping)
 *    EASE_*     — Cubic-bezier arrays for CSS / framer-motion `ease`
 *    DURATION_* — Duration in seconds
 *    STAGGER_*  — Container stagger presets (delay between children)
 *    FADE_*     — Reusable entrance/exit variants (initial → animate)
 *    PAGE_*     — Page-level transition variants for AnimatePresence
 *    LAYOUT_*   — Layout animation shared configs
 */

import type { Transition, Variants } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────
//  1. SPRINGS
// ─────────────────────────────────────────────────────────────────────

/**
 * Snappy spring — badges popping in, notification bell, active indicators.
 * Stiff and responsive; the element settles quickly.
 */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 40,
};

/**
 * Default spring — product cards, interactive buttons, general tap feedback.
 * Balanced between responsive and smooth.
 */
export const SPRING_DEFAULT: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
};

/**
 * Soft spring — navigation drawer slide, larger elements that move slowly.
 * Feels heavier and more deliberate.
 */
export const SPRING_SOFT: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 38,
};

/**
 * Elastic spring — playful micro-interactions like heart toggle, small icon bounces.
 * Slightly bouncy for delight without being cartoonish.
 */
export const SPRING_BOUNCE: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 20,
};

/**
 * Gentle spring — empty state icon, large illustrative elements.
 * Slow and relaxed entrance.
 */
export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
};

/**
 * Layout spring — for `layout` prop on list items that reorder.
 * Smooth repositioning without snap.
 */
export const SPRING_LAYOUT: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 35,
};

// ─────────────────────────────────────────────────────────────────────
//  2. EASING CURVES
// ─────────────────────────────────────────────────────────────────────

/**
 * Out-expo — fast start, slow finish. The workhorse ease for most transitions.
 * Used by AnimatedNumber, login form, reveal animations.
 * Equivalent: cubic-bezier(0.22, 1, 0.36, 1)
 */
export const EASE_OUT_EXPONENTIAL = [0.22, 1, 0.36, 1] as const;

/**
 * Out-quart — slightly less aggressive than expo. Good for page transitions.
 * Equivalent: cubic-bezier(0.25, 1, 0.5, 1)
 */
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

/**
 * Out-quint — the default easing for route transitions.
 * Very smooth deceleration.
 * Equivalent: cubic-bezier(0.22, 1, 0.36, 1) — same as expo in practice.
 */
export const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

/**
 * In-out-cubic — smooth acceleration AND deceleration.
 * Best for looping animations, step illustrations.
 */
export const EASE_IN_OUT_CUBIC = "easeInOut" as const;

// ─────────────────────────────────────────────────────────────────────
//  3. DURATION SCALE
// ─────────────────────────────────────────────────────────────────────

/**
 * Duration presets in seconds. Ordered from fastest to slowest.
 *
 * These are hints — springs override duration. Use these primarily
 * for `transition={{ duration: DURATION_* }}` where springs aren't appropriate
 * (e.g., opacity fades, height transitions).
 */
export const DURATION = {
  /** 0.12s — micro-feedback: button press, toggle flip */
  INSTANT: 0.12,
  /** 0.15s — quick UI responses: sidebar collapse, dialog backdrop */
  FAST: 0.15,
  /** 0.18s — route transitions, overlay appearance */
  NORMAL: 0.18,
  /** 0.25s — content reveals, card entrances */
  SLOW: 0.25,
  /** 0.3s — page-level content fades, larger reveals */
  SLOWER: 0.3,
  /** 0.5s — dramatic reveals, landing page animations */
  DRAMATIC: 0.5,
  /** 0.6s — animated number interpolation (default) */
  COUNT: 0.6,
} as const;

// ─────────────────────────────────────────────────────────────────────
//  4. STAGGER PRESETS
// ─────────────────────────────────────────────────────────────────────

/**
 * Stagger configs for `staggerChildren` in container variants.
 * Each value is the delay (in seconds) between each child's entrance.
 */
export const STAGGER = {
  /** 0.02s — POS grids: tight, fast. Cashiers need speed. */
  TIGHT: 0.02,
  /** 0.03s — Compact lists: loyalty, favorites, notifications */
  COMPACT: 0.03,
  /** 0.04s — Standard lists: orders, search results */
  NORMAL: 0.04,
  /** 0.05s — Medium lists: shopping lists, profile links */
  MEDIUM: 0.05,
  /** 0.06s — Relaxed sections: home sections, combos */
  RELAXED: 0.06,
  /** 0.08s — Slow reveals: order tracking progress, detailed views */
  SLOW: 0.08,
} as const;

// ─────────────────────────────────────────────────────────────────────
//  5. VARIANT PRESETS (reusable patterns)
// ─────────────────────────────────────────────────────────────────────

/**
 * Container + item variants for staggered list entrances.
 * Usage:
 *   <motion.div variants={STAGGER_FADE_UP.container} initial="hidden" animate="show">
 *     {items.map(i => <motion.div key={i} variants={STAGGER_FADE_UP.item}>...</motion.div>)}
 *   </motion.div>
 */
export const STAGGER_FADE_UP = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: STAGGER.RELAXED },
    },
  } satisfies Variants,
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  } satisfies Variants,
};

/**
 * Compact stagger — for dense grids and lists (POS, product catalogs).
 * Faster, tighter, less decorative.
 */
export const STAGGER_COMPACT = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: STAGGER.TIGHT },
    },
  } satisfies Variants,
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: DURATION.FAST } },
  } satisfies Variants,
};

/**
 * Slow stagger — for tracking screens, detailed views, onboarding.
 * Each step gets time to register.
 */
export const STAGGER_SLOW = {
  container: {
    hidden: {},
    show: {
      transition: { staggerChildren: STAGGER.SLOW },
    },
  } satisfies Variants,
  item: {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.SLOWER },
    },
  } satisfies Variants,
};

/**
 * Scale-in variants — elements pop in from slightly smaller.
 * Good for: badges, icons, floating elements.
 */
export const SCALE_IN = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.5 },
} as const;

/**
 * Slide-in variants — for drawer/panel content from left.
 */
export const SLIDE_LEFT = {
  initial: { x: "-100%" },
  animate: { x: 0 },
  exit: { x: "-100%" },
} as const;

/**
 * Fade variants — pure opacity transitions (no movement).
 */
export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

/**
 * Fade-up variants — content fades in while rising slightly.
 * The most common entrance pattern in the portal.
 */
export const FADE_UP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
} as const;

// ─────────────────────────────────────────────────────────────────────
//  6. PAGE TRANSITIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Route transition variants — used by RouteTransition component.
 * Subtle vertical shift + opacity for natural page changes.
 * Respects `prefers-reduced-motion` at the component level.
 */
export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
} as const;

/**
 * Page transition variant that respects reduced motion.
 * Pass `reduced: true` when `useReducedMotion()` returns true.
 */
export const pageTransition = (reduced: boolean) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
  animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
  exit: reduced ? { opacity: 0 } : { opacity: 0, y: -8 },
});

// ─────────────────────────────────────────────────────────────────────
//  7. LAYOUT ANIMATION
// ─────────────────────────────────────────────────────────────────────

/**
 * Shared `layout` transition for elements that reorder (tickets, cart items).
 * Apply as: <motion.div layout transition={LAYOUT_ITEM}>
 */
export const LAYOUT_ITEM: Transition = SPRING_LAYOUT;

/**
 * Layout transition for the bottom tab bar active indicator.
 * Uses a named layoutId for shared animation across tabs.
 */
export const LAYOUT_TAB_INDICATOR: Transition = SPRING_SNAPPY;

// ─────────────────────────────────────────────────────────────────────
//  8. INDIVIDUAL TRANSITION SHORTCUTS
// ─────────────────────────────────────────────────────────────────────

/**
 * Pre-built transition objects for the most common single-property animations.
 * Usage: <motion.div animate={{ opacity: 1 }} transition={TRANSITION_FADE}>
 */
export const TRANSITION_FADE = {
  duration: DURATION.SLOW,
  ease: EASE_OUT_EXPONENTIAL,
} as const;

export const TRANSITION_FADE_FAST = {
  duration: DURATION.FAST,
  ease: EASE_OUT_EXPONENTIAL,
} as const;

export const TRANSITION_HEIGHT = {
  duration: DURATION.SLOW,
  ease: EASE_OUT_QUART,
} as const;

export const TRANSITION_COUNT = {
  duration: DURATION.COUNT,
  ease: EASE_OUT_EXPONENTIAL,
} as const;

// ─────────────────────────────────────────────────────────────────────
//  9. TYPES
// ─────────────────────────────────────────────────────────────────────

export type SpringPreset = typeof SPRING_SNAPPY;
export type EasingCurve = readonly number[];
export type StaggerSpeed = (typeof STAGGER)[keyof typeof STAGGER];
