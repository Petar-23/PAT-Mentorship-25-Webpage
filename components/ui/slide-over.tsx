"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const SlideOver = DialogPrimitive.Root
const SlideOverTrigger = DialogPrimitive.Trigger
const SlideOverClose = DialogPrimitive.Close
const SlideOverPortal = DialogPrimitive.Portal

const SlideOverOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Normaler Overlay-Hintergrund (ohne Glas/Blur)
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
SlideOverOverlay.displayName = DialogPrimitive.Overlay.displayName

const slideOverContentVariants = cva(
  // Solider Drawer-Background (nicht transparent), unabhängig von Theme-Variablen
  "fixed z-50 flex h-[100dvh] flex-col bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200",
  {
    variants: {
      side: {
        left:
          "inset-y-0 left-0 w-[90vw] max-w-sm border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 w-[90vw] max-w-sm border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

type SlideOverContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
  VariantProps<typeof slideOverContentVariants> & {
    title?: string
  }

const SlideOverContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SlideOverContentProps
>(({ side, title = "Dialog", className, children, ...props }, ref) => (
  <SlideOverPortal>
    <SlideOverOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(slideOverContentVariants({ side }), className)}
      {...props}
    >
      {/* A11y: Radix DialogContent erwartet immer einen DialogTitle */}
      <DialogPrimitive.Title className="sr-only">
        {title}
      </DialogPrimitive.Title>
      {children}
    </DialogPrimitive.Content>
  </SlideOverPortal>
))
SlideOverContent.displayName = DialogPrimitive.Content.displayName

export { SlideOver, SlideOverTrigger, SlideOverClose, SlideOverPortal, SlideOverOverlay, SlideOverContent }


