"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface InfoTooltipProps {
  text: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
  iconClassName?: string
}

export function InfoTooltip({
  text,
  side = "top",
  align = "center",
  className,
  iconClassName,
}: InfoTooltipProps) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      role="presentation"
    >
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild aria-label="Más información">
            <span tabIndex={0} className="inline-flex cursor-help">
              <Info
                className={cn(
                  "size-3.5 text-muted-foreground/70 transition-colors hover:text-foreground",
                  iconClassName
                )}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side={side} align={align}>
            {text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  )
}