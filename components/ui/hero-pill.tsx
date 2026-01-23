import { cn } from "@/lib/utils"

interface HeroPillProps {
  href?: string
  label: string
  announcement?: React.ReactNode
  className?: string
  isExternal?: boolean
  variant?: "blue" | "amber" | "dark" | "emerald" | "red"
  size?: "default" | "sm"
}

const variantStyles = {
  blue: {
    pill: "bg-blue-50 ring-1 ring-blue-200",
    badge: "bg-blue-100 text-blue-700",
    text: "text-blue-700",
  },
  amber: {
    pill: "bg-amber-50 ring-1 ring-amber-200",
    badge: "bg-amber-100 text-amber-700",
    text: "text-amber-700",
  },
  dark: {
    pill: "bg-white/10 ring-1 ring-white/20",
    badge: "bg-blue-500/20 text-blue-400",
    text: "text-blue-400",
  },
  emerald: {
    pill: "bg-emerald-50 ring-1 ring-emerald-200",
    badge: "bg-emerald-500 text-white",
    text: "text-emerald-700",
  },
  red: {
    pill: "bg-red-50 ring-1 ring-red-200",
    badge: "bg-red-500 text-white",
    text: "text-red-700",
  },
}

const sizeStyles = {
  default: {
    text: "text-xs font-medium sm:text-sm",
  },
  sm: {
    text: "text-xs font-normal",
  },
}

export function HeroPill({ 
  href, 
  label, 
  announcement = "🚀",
  className,
  isExternal = false,
  variant = "blue",
  size = "default",
}: HeroPillProps) {
  const styles = variantStyles[variant]
  const textSize = sizeStyles[size]

  // Check if announcement is an icon (React element) vs text/emoji
  const isIconAnnouncement = variant === 'emerald' || variant === 'red'
  
  const content = (
    <>
      <div className={cn(
        "rounded-full flex items-center justify-center shrink-0",
        isIconAnnouncement ? "size-6" : "px-2 py-0.5",
        textSize.text,
        styles.badge
      )}>
        {announcement}
      </div>
      <p className={cn(textSize.text, styles.text)}>
        {label}
      </p>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        className={cn(
          "inline-flex w-fit items-center space-x-2 rounded-full",
          "pl-2 pr-3 py-1 whitespace-nowrap",
          styles.pill,
          className
        )}
      >
        {content}
        <svg
          width="12"
          height="12"
          className="ml-1"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8.78141 5.33312L5.20541 1.75712L6.14808 0.814453L11.3334 5.99979L6.14808 11.1851L5.20541 10.2425L8.78141 6.66645H0.666748V5.33312H8.78141Z"
            fill="currentColor"
            className={styles.text}
          />
        </svg>
      </a>
    )
  }

  return (
    <div
      className={cn(
        "inline-flex w-fit items-center space-x-2 rounded-full",
        "pl-2 pr-4 py-1 whitespace-nowrap",
        styles.pill,
        className
      )}
    >
      {content}
    </div>
  )
}