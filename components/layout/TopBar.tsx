"use client"

import { usePathname } from "next/navigation"
import { Search, Bell, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"

const routeLabels: Record<string, { labelKey: keyof typeof import("@/lib/i18n/es.json")["nav"] }> = {
  "/dashboard": { labelKey: "dashboard" },
  "/contacts": { labelKey: "contacts" },
  "/leads": { labelKey: "leads" },
  "/deals": { labelKey: "deals" },
  "/inbox": { labelKey: "inbox" },
  "/tasks": { labelKey: "tasks" },
  "/products": { labelKey: "products" },
  "/analytics": { labelKey: "analytics" },
  "/settings": { labelKey: "settings" },
}

interface TopBarProps {
  userName?: string
  avatarUrl?: string | null
}

export default function TopBar({ userName = "Usuario", avatarUrl }: TopBarProps) {
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()

  const currentRoute = Object.keys(routeLabels).find((route) =>
    pathname.startsWith(route)
  )
  const currentLabel = currentRoute
    ? t.nav[routeLabels[currentRoute].labelKey]
    : "Dashboard"

  const toggleLocale = () => {
    setLocale(locale === "es" ? "en" : "es")
  }

  return (
    <header className="flex items-center h-16 bg-white border-b border-gray-200 px-4 md:px-6 flex-shrink-0">
      {/* Left: Breadcrumb */}
      <div className="flex items-center min-w-0 flex-shrink-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm">
            <li className="text-gray-400 hidden sm:block">
              {t.app.name}
            </li>
            <li className="text-gray-300 hidden sm:block" aria-hidden="true">/</li>
            <li className="font-semibold text-gray-900">{currentLabel}</li>
          </ol>
        </nav>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            size={16}
          />
          <input
            type="search"
            placeholder={
              locale === "es"
                ? "Buscar contactos, leads, ventas..."
                : "Search contacts, leads, deals..."
            }
            className={cn(
              "w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg",
              "placeholder:text-gray-400 text-gray-900",
              "focus:outline-none focus:ring-2 focus:ring-veloce-500/20 focus:border-veloce-500",
              "transition-colors"
            )}
            aria-label="Global search"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Language toggle */}
        <button
          onClick={toggleLocale}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors",
            "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
          aria-label={`Switch to ${locale === "es" ? "English" : "Spanish"}`}
          title={locale === "es" ? "Switch to English" : "Cambiar a Espanol"}
        >
          <Globe size={16} />
          <span className="uppercase">{locale === "es" ? "EN" : "ES"}</span>
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User avatar */}
        <div className="hidden md:flex items-center ml-1">
          <div className="w-8 h-8 rounded-full bg-veloce-100 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-veloce-700">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
