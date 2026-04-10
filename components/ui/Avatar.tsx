import React from "react"
import { cn, getInitials } from "@/lib/utils"

const sizeStyles = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  firstName?: string
  lastName?: string
  size?: keyof typeof sizeStyles
  alt?: string
}

function Avatar({
  src,
  firstName = "",
  lastName = "",
  size = "md",
  alt,
  className,
  ...props
}: AvatarProps) {
  const initials = getInitials(firstName, lastName)
  const label = alt || `${firstName} ${lastName}`.trim() || "Avatar"

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-veloce-100 font-medium text-veloce-700 overflow-hidden",
        sizeStyles[size],
        className
      )}
      role="img"
      aria-label={label}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

export { Avatar }
