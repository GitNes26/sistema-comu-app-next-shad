"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { OverlayBackGuard } from "@/hooks/use-overlay-back"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/35 duration-200 supports-backdrop-filter:backdrop-blur-[2px] dark:bg-black/55 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function isInteractionInsideNestedLayer(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="dropdown-menu-content"]'
    )
  )
}

/** ¿El diálogo debe permanecer abierto ante una interacción externa?
 * - SweetAlert abierto encima (validaciones/errores): clic en su botón no cierra el form.
 * - Interacción dentro de otro diálogo/popover/menú anidado. */
function shouldKeepDialogOpen(event: Event): boolean {
  if (
    typeof document !== "undefined" &&
    document.body.classList.contains("swal2-shown")
  ) {
    return true
  }
  return isInteractionInsideNestedLayer(event.target)
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onInteractOutside={(e) => {
          if (shouldKeepDialogOpen(e)) e.preventDefault()
        }}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-e3 ring-1 ring-foreground/10 duration-200 ease-(--ease-out-expo) outline-none sm:max-w-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-150",
          // Teléfono: bottom sheet nativo (entra desde abajo, pegado al borde)
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:pt-6 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:duration-300 max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=closed]:slide-out-to-bottom-full",
          className
        )}
        {...props}
      >
        <OverlayBackGuard />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Cerrar</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 max-sm:-mb-[max(1rem,env(safe-area-inset-bottom))] max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Cerrar</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-tight font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

type DialogComponentSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full" | "auto"

const DIALOG_SIZE_CLASSES: Record<DialogComponentSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  full: "sm:max-w-[calc(100vw-2rem)]",
  auto: "",
}

type DialogComponentProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  size?: DialogComponentSize
  className?: string
  bodyClassName?: string
  footerClassName?: string
  footer?: React.ReactNode
  showCloseButton?: boolean
  children?: React.ReactNode
  /** Selector estable para guías inmersivas (data-guide). */
  dataGuide?: string
}

function DialogComponent({
  open,
  onOpenChange,
  title,
  description,
  icon,
  size = "2xl",
  className,
  bodyClassName,
  footerClassName,
  footer,
  showCloseButton,
  children,
  dataGuide,
}: DialogComponentProps) {
  const sizeClass = DIALOG_SIZE_CLASSES[size]
  const handleEnter: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing || event.repeat) return
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])')) return
    if (target.closest('form, [role="combobox"], [role="listbox"], [cmdk-root], [data-slot="popover-content"]')) return
    const dialog = event.currentTarget
    const action = [...dialog.querySelectorAll<HTMLButtonElement>('[data-slot="dialog-footer"] button')]
      .reverse()
      .find((button) => !button.disabled)
    if (!action) return
    event.preventDefault()
    action.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(sizeClass, className)}
        onKeyDown={handleEnter}
        // Un formulario portaled conserva la jerarquía de eventos de React.
        // Cada diálogo detiene aquí su submit para no enviar formularios de
        // diálogos padres, incluidos los flujos personalizados futuros.
        onSubmit={(event) => event.stopPropagation()}
        showCloseButton={showCloseButton}
        data-guide={dataGuide}
      >
        {title || description ? (
          <DialogHeader>
            {title ? (
              <DialogTitle className="flex items-center gap-2">
                {icon}
                {title}
              </DialogTitle>
            ) : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        ) : null}
        {children ? <DialogBody className={bodyClassName}>{children}</DialogBody> : null}
        {footer ? <DialogFooter className={footerClassName}>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogComponent,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
