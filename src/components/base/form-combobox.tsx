"use client"

import * as React from "react"
import { Check, ChevronsUpDown, ListFilter, Loader2, Plus, RefreshCw, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command as CommandPrimitive } from "cmdk"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { AlertCircle } from "lucide-react"

export interface ComboboxOption {
  value: string
  label: string
  meta?: string
  disabled?: boolean
  /** Descripción del rol (tooltip). */
  description?: string | null
  /** Cantidad de permisos del rol (tooltip). */
  permissionCount?: number
}

export interface FormComboboxProps {
  options: ComboboxOption[]
  value?: string | null
  onChange?: (value: string) => void
  onClear?: () => void
  onSync?: () => Promise<void> | void
  /** Abre un modal externo (CRUD completo) para crear un nuevo registro. */
  onCreate?: () => void
  id?: string
  label?: string
  ariaLabel?: string
  helper?: React.ReactNode
  infoTooltip?: React.ReactNode | null
  icon?: React.ReactNode
  required?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  loading?: boolean
  clearable?: boolean
  searchable?: boolean
  error?: string
  className?: string
  contentClassName?: string
  /** Renderizado personalizado de cada opción en el dropdown. */
  renderOption?: (option: ComboboxOption) => React.ReactNode
}

export function FormCombobox({
  options,
  value,
  onChange,
  onClear,
  onSync,
  onCreate,
  id,
  label,
  ariaLabel,
  helper,
  infoTooltip,
  icon,
  required,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  disabled,
  loading,
  clearable = true,
  searchable = true,
  error,
  className,
  contentClassName,
  renderOption,
}: FormComboboxProps) {
  const autoId = React.useId().replace(/:/g, "")
  const comboboxId = id ?? `combobox-${autoId}`
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [syncing, setSyncing] = React.useState(false)

  const selected = options.find((o) => o.value === value)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.meta ?? ""}`.toLowerCase().includes(q)
    )
  }, [options, search])

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await onSync?.()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={comboboxId} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {(infoTooltip ?? helper) && <InfoTooltip text={infoTooltip ?? helper} />}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={ariaLabel}
            id={comboboxId}
            aria-expanded={open}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${comboboxId}-error` : undefined}
            disabled={disabled}
            data-slot="form-combobox-trigger"
            className={cn(
              "h-11 w-full justify-between px-3 font-normal desk:h-8",
              error && "border-destructive ring-3 ring-destructive/20",
              !selected && "text-muted-foreground"
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <span className="shrink-0 text-muted-foreground">{icon ?? <ListFilter className="size-4" />}</span>
              {selected ? selected.label : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {loading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {error && (
                <AlertCircle className="size-4 text-destructive" />
              )}
              {clearable && selected && !disabled && (
                <span
                  role="button"
                  aria-label="Limpiar selección"
                  tabIndex={-1}
                  className={cn(
                    "cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors",
                    "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onClear) {
                      onClear()
                    } else {
                      onChange?.("")
                    }
                    setSearch("")
                  }}
                >
                  <X className="size-3.5" />
                </span>
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>

        {open && (
          <PopoverContent
            align="start"
            className={cn("w-full min-w-[--radix-popover-trigger-width] overflow-hidden p-0", contentClassName)}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandPrimitive
              shouldFilter={false}
              value={selected?.value ?? ""}
              className="flex max-h-[min(22rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden"
            >
              {searchable && (
                <div className="border-b p-2">
                  <CommandPrimitive.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder={searchPlaceholder}
                    autoFocus
                    className="flex h-11 w-full items-center rounded-md bg-transparent px-3 text-base outline-none desk:h-8 desk:text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <CommandPrimitive.List className="p-1">
                  {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                      <p className="text-sm text-muted-foreground">{emptyText}</p>
                      {onCreate && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setOpen(false);
                            setSearch("");
                            onCreate();
                          }}
                        >
                          <Plus /> Agregar &ldquo;{search.trim() || "nuevo"}&rdquo;
                        </Button>
                      )}
                    </div>
                  )}

                  <CommandPrimitive.Group>
                    {filtered.map((option) => (
                      <CommandPrimitive.Item
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        onSelect={() => {
                          onChange?.(option.value)
                          setOpen(false)
                          setSearch("")
                        }}
                        className={cn(
                          "flex cursor-default select-none items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[selected='true']:bg-accent data-[selected='true']:text-accent-foreground data-[disabled='true']:pointer-events-none data-[disabled='true']:opacity-50 [&_svg]:pointer-events-none"
                        )}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          {renderOption ? (
                            renderOption(option)
                          ) : (
                            <>
                              <span className="truncate">{option.label}</span>
                              {option.meta && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {option.meta}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        {option.value === value && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                </CommandPrimitive.List>
              </div>

              {(onSync || onCreate) && (
                <div className="flex items-center justify-between gap-2 border-t p-2">
                  {onSync ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => void handleSync()}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Sincronizar
                    </Button>
                  ) : (
                    <span />
                  )}
                  {onCreate && (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        setSearch("");
                        onCreate();
                      }}
                    >
                      <Plus />
                      Agregar
                    </Button>
                  )}
                </div>
              )}
            </CommandPrimitive>
          </PopoverContent>
        )}
      </Popover>

      {error && (
        <p id={`${comboboxId}-error`} role="alert" className="text-xs leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  )
}
