import React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "solid" | "outline"
  color?: string
}

function Badge({
  className,
  variant = "solid",
  color,
  style,
  children,
  ...props
}: BadgeProps) {
  const dynamicStyle: React.CSSProperties = color
    ? variant === "solid"
      ? { backgroundColor: `${color}20`, color, ...style }
      : { borderColor: color, color, ...style }
    : { ...style }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        !color &&
          variant === "solid" &&
          "bg-veloce-50 text-veloce-700",
        !color &&
          variant === "outline" &&
          "border border-veloce-500 text-veloce-700",
        variant === "outline" && "border",
        className
      )}
      style={dynamicStyle}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
