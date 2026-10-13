/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Haptics — Tactile Feedback Wrapper
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Thin wrapper around navigator.vibrate() with named intensity levels.
 *  Gracefully degrades on devices without vibration support.
 *
 *  Vibration patterns (ms):
 *    light   — 8ms   — tap feedback, subtle confirmation
 *    medium  — 15ms  — button press, item added
 *    heavy   — 25ms  — delete, significant action
 *    success — [10, 30, 10] — two-pulse pattern for positive feedback
 *    error   — [20, 50, 20, 50, 20] — triple-pulse for errors
 *
 *  Usage:
 *    import { haptic } from "@/lib/haptics";
 *    haptic.light();    // on tap
 *    haptic.medium();   // on add to cart
 *    haptic.success();  // on sale completed
 */

type HapticPattern = number | number[];

interface HapticLevel {
  /** Single short pulse — lightest feedback */
  light: () => void;
  /** Medium pulse — standard interaction feedback */
  medium: () => void;
  /** Heavy pulse — strong action confirmation */
  heavy: () => void;
  /** Two-pulse pattern — positive action success */
  success: () => void;
  /** Triple-pulse pattern — error or warning */
  error: () => void;
}

/**
 * Check if vibration is supported in the current environment.
 * Returns false on desktop browsers, older mobile browsers, or SSR.
 */
function canVibrate(): boolean {
  if (typeof window === "undefined") return false;
  return "vibrate" in navigator;
}

/**
 * Core vibration function. Pattern can be a single duration (number)
 * or an alternating array of [vibrate, pause, vibrate, ...].
 */
function vibrate(pattern: HapticPattern): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail — some browsers throw on denied permission
  }
}

/**
 * The haptic feedback object.
 * Each method is a no-op when vibration isn't supported.
 */
export const haptic: HapticLevel = {
  light: () => vibrate(8),
  medium: () => vibrate(15),
  heavy: () => vibrate(25),
  success: () => vibrate([10, 30, 10]),
  error: () => vibrate([20, 50, 20, 50, 20]),
};

/**
 * Check if haptic feedback is available on this device.
 * Useful for conditionally showing haptic-related UI hints.
 */
export function isHapticSupported(): boolean {
  return canVibrate();
}
