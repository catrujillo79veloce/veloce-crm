import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null, currency = "COP"): string {
  if (amount === null) return "$0"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date, locale = "es"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString(locale === "es" ? "es-CO" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(date: string | Date, locale = "es"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString(locale === "es" ? "es-CO" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatRelativeTime(date: string | Date, locale = "es"): string {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (locale === "es") {
    if (minutes < 1) return "ahora"
    if (minutes < 60) return `hace ${minutes}m`
    if (hours < 24) return `hace ${hours}h`
    if (days < 7) return `hace ${days}d`
    return formatDate(d, locale)
  }

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(d, locale)
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "")
  if (cleaned.startsWith("3") && cleaned.length === 10) {
    cleaned = "+57" + cleaned
  } else if (cleaned.startsWith("57") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned
  }
  return cleaned
}

export function getInitials(firstName: string, lastName?: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || ""
  const l = lastName?.charAt(0)?.toUpperCase() || ""
  return f + l || "?"
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600 bg-green-50"
  if (score >= 40) return "text-yellow-600 bg-yellow-50"
  return "text-red-600 bg-red-50"
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}
