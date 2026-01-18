"use client"

import type { CSSProperties } from "react"
import { CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const duration = typeof props.duration === "number" ? props.duration : 6000
        const style = {
          ...(props.style ?? {}),
          ["--toast-duration" as string]: `${duration}ms`,
        } satisfies CSSProperties

        return (
          <Toast key={id} {...props} duration={duration} style={style}>
            <div className="grid gap-1">
              {props.variant === "success" ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-medium text-emerald-700">
                    Erfolgreich
                  </span>
                </div>
              ) : null}
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-200"
            >
              <div className="h-full origin-right bg-neutral-400 animate-toast-progress" />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
