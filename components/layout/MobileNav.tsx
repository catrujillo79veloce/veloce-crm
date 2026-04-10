"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Target,
  Inbox,
  MoreHorizontal,
  DollarSign,
  CheckSquare,
  Package,
  BarChart3,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"

const mainTabs = [
  { icon: LayoutDashboard, labelKey: "dashboard" as const, href: "/dashboard" },
  { icon: Users, labelKey: "contacts" as const, href: "/contacts" },
  { icon: Target, labelKey: "leads" as const, href: "/leads" },
  { icon: Inbox, labelKey: "inbox" as const, href: "/inbox" },
]

const moreTabs = [
  { icon: DollarSign, labelKey: "deals" as const, href: "/deals" },
  { icon: CheckSquare, labelKey: "tasks" as const, href: "/tasks" },
  { icon: Package, labelKey: "products" as const, href: "/products" },
  { icon: BarChart3, labelKey: "analytics" as const, href: "/analytics" },
  { icon: Settings, labelKey: "settings" as const, href: "/settings" },
]

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  const { t, locale } = useI18n()
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const isMoreActive = moreTabs.some((tab) => isActive(tab.href))

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [moreOpen])

  // Close menu on route change
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      {/* More dropdown */}
      {moreOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg animate-in slide-in-from-bottom-2"
        >
          <ul className="grid grid-cols-3 gap-1 p-3">
            {moreTabs.map((tab) => {
              const Icon = tab.icon
              const active = isActive(tab.href)
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs transition-colors",
                      active
                        ? "bg-veloce-50 text-veloce-700"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={20} className={active ? "text-veloce-600" : "text-gray-400"} />
                    <span className="font-medium">{t.nav[tab.labelKey]}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Tab bar */}
      <ul className="flex items-center justify-around h-16 px-1">
        {mainTabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.href)
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 text-xs transition-colors",
                  active ? "text-veloce-600" : "text-gray-500"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={22}
                  className={active ? "text-veloce-600" : "text-gray-400"}
                />
                <span className={cn("font-medium", active && "text-veloce-700")}>
                  {t.nav[tab.labelKey]}
                </span>
              </Link>
            </li>
          )
        })}

        {/* More button */}
        <li className="flex-1">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-xs w-full transition-colors",
              isMoreActive || moreOpen ? "text-veloce-600" : "text-gray-500"
            )}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            aria-label="More navigation options"
          >
            <MoreHorizontal
              size={22}
              className={isMoreActive || moreOpen ? "text-veloce-600" : "text-gray-400"}
            />
            <span className={cn("font-medium", (isMoreActive || moreOpen) && "text-veloce-700")}>
              {locale === "es" ? "Mas" : "More"}
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
