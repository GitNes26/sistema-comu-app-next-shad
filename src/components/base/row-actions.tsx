"use client"

import { Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// Acciones de una fila de listado: una acción principal visible y el resto en
// un menú "⋯". Las destructivas van al final, separadas y en rojo.

export interface RowAction {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
  /** Descripción corta bajo la etiqueta del menú. */
  hint?: string
  "data-guide"?: string
}

export function RowActions({
  name,
  primary,
  items = [],
  busy = false,
  className,
}: {
  /** Nombre del registro para las etiquetas accesibles. */
  name: string
  primary?: RowAction
  items?: RowAction[]
  busy?: boolean
  className?: string
}) {
  const visible = items.filter((a) => !a.hidden)
  const normal = visible.filter((a) => !a.destructive)
  const danger = visible.filter((a) => a.destructive)
  const PrimaryIcon = primary?.icon

  return (
    <div className={cn("flex items-center justify-end gap-1", className)} onClick={(e) => e.stopPropagation()}>
      {primary && !primary.hidden && (
        <Button
          variant="ghost"
          size="sm"
          onClick={primary.onSelect}
          disabled={primary.disabled}
          aria-label={`${primary.label} ${name}`}
          data-guide={primary["data-guide"]}
        >
          {PrimaryIcon && <PrimaryIcon className="size-4" />}
          <span className="hidden xl:inline">{primary.label}</span>
        </Button>
      )}
      {visible.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${name}`}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {normal.map((a) => (
              <ActionItem key={a.label} action={a} />
            ))}
            {danger.length > 0 && normal.length > 0 && <DropdownMenuSeparator />}
            {danger.map((a) => (
              <ActionItem key={a.label} action={a} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function ActionItem({ action }: { action: RowAction }) {
  const Icon = action.icon
  return (
    <DropdownMenuItem
      variant={action.destructive ? "destructive" : "default"}
      disabled={action.disabled}
      onSelect={action.onSelect}
      data-guide={action["data-guide"]}
    >
      {Icon && <Icon className="size-4" />}
      {action.hint ? (
        <span>
          <span className="block">{action.label}</span>
          <span className="block text-xs text-muted-foreground">{action.hint}</span>
        </span>
      ) : (
        action.label
      )}
    </DropdownMenuItem>
  )
}
