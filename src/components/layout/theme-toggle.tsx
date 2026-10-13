"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Monitor, Moon, Sun } from "lucide-react"
import { setDeviceTheme, useThemeStore } from "@/stores/theme-store"
import { resolveTheme } from "@/lib/appearance-apply"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ThemeCycle = "light" | "dark" | "system"

const CYCLE: ThemeCycle[] = ["light", "dark", "system"]

const CYCLE_ICONS: Record<ThemeCycle, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const CYCLE_LABELS: Record<ThemeCycle, string> = {
  light: "Tema claro. Cambiar a oscuro",
  dark: "Tema oscuro. Cambiar a automático",
  system: "Tema automático. Cambiar a claro",
}

const CYCLE_TOOLTIPS: Record<ThemeCycle, string> = {
  light: "Claro · toca para oscuro",
  dark: "Oscuro · toca para automático",
  system: "Automático · toca para claro",
}

// Toggle de tema claro → oscuro → automático. La elección se guarda en este
// dispositivo y tiene prioridad sobre el tema de la iglesia.
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const reduce = useReducedMotion()
  const [resolved, setResolved] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    setResolved(resolveTheme(theme))
  }, [theme])

  const current: ThemeCycle =
    theme === "system" ? "system" : resolved === "dark" ? "dark" : "light"

  const cycle = () => {
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
    setDeviceTheme(next)
    setTheme(next)
  }

  const Icon = CYCLE_ICONS[current]

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={CYCLE_LABELS[current]}
            onClick={cycle}
            className={cn("relative overflow-hidden", className)}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={current}
                className="flex items-center justify-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <Icon className="size-5" />
              </motion.span>
            </AnimatePresence>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{CYCLE_TOOLTIPS[current]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
