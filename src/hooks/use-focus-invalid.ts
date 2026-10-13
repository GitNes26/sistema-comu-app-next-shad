"use client"

import { useCallback } from "react"

/**
 * Focuses the first invalid field in a form when validation fails.
 * Usage: call `focusFirstInvalid(errors)` after validation where `errors`
 * is an object with field names as keys and error messages as values.
 */
export function useFocusInvalid() {
  const escapeSelector = useCallback((value: string) =>
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(value)
      : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"), [])

  const focusElement = useCallback((el: HTMLElement | null) => {
    if (!el) return false
    el.focus({ preventScroll: true })
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    return true
  }, [])

  const findFocusable = useCallback((root: ParentNode, key?: string) => {
    const field = key
      ? root.querySelector<HTMLElement>(`[data-form-field="${escapeSelector(key)}"]`)
      : root
    return field?.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), button:not([disabled]), [role="combobox"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])'
    ) ?? null
  }, [escapeSelector])

  const focusFirstInvalid = useCallback(
    (errors: Record<string, unknown>, formId?: string) => {
      const firstKey = Object.keys(errors)[0]
      if (!firstKey) return

      const form = formId ? document.getElementById(formId) : document.querySelector("form")
      if (!form) return
      const direct = form.querySelector<HTMLElement>(`#${escapeSelector(firstKey)}`)
      focusElement(direct ?? findFocusable(form, firstKey) ?? form.querySelector<HTMLElement>('[aria-invalid="true"]'))
    },
    [escapeSelector, findFocusable, focusElement]
  )

  const focusFirstEnabled = useCallback((formId?: string) => {
    const form = formId ? document.getElementById(formId) : document.querySelector("form")
    if (!form) return
    focusElement(findFocusable(form))
  }, [findFocusable, focusElement])

  return { focusFirstInvalid, focusFirstEnabled }
}
