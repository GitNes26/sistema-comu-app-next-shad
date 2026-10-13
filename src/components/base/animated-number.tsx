"use client"

import { useEffect, useRef } from "react"
import { animate } from "framer-motion"

import { cn } from "@/lib/utils"
import { EASE_OUT_EXPONENTIAL } from "@/lib/animation-tokens"

export interface AnimatedNumberProps {
  value: number
  format?: (value: number) => string
  duration?: number
  delay?: number
  className?: string
}

export function AnimatedNumber({
  value,
  format,
  duration = 0.6,
  delay = 0,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const fromRef = useRef(0)
  const formatRef = useRef(format)

  useEffect(() => {
    formatRef.current = format
  }, [format])

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration,
      delay,
      ease: [...EASE_OUT_EXPONENTIAL] as [number, number, number, number],
      onUpdate(value) {
        fromRef.current = value
        if (ref.current) {
          ref.current.textContent = formatRef.current
            ? formatRef.current(value)
            : Math.round(value).toLocaleString("es-MX")
        }
      },
      onComplete() {
        fromRef.current = value
      },
    })
    return () => controls.stop()
  }, [value, duration, delay])

  return <span ref={ref} className={cn(className)} />
}