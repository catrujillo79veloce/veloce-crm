"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Target,
  DollarSign,
  Inbox,
  CheckSquare,
  Package,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"

interface NavItem {
  icon: React.ElementType
  labelKey: keyof typeof import("@/lib/i18n/es.json")["nav"]
  href: string
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/dashboard" },
  { icon: Users, labelKey: "contacts", href: "/contacts" },
  { icon: Target, labelKey: "leads", href: "/leads" },
  { icon: DollarSign, labelKey: "deals", href: "/deals" },
  { icon: Inbox, labelKey: "inbox", href: "/inbox" },
  { icon: CheckSquare, labelKey: "tasks", href: "/tasks" },
  { icon: Package, labelKey: "products", href: "/products" },
  { icon: BarChart3, labelKey: "analytics", href: "/analytics" },
  { icon: Settings, labelKey: "settings", href: "/settings" },
]

interface SidebarProps {
  userName?: string
  userEmail?: string
  avatarUrl?: string | null
}

export default function Sidebar({ userName = "Usuario", userEmail = "", avatarUrl }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { t } = useI18n()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex-shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 border-b border-gray-200 flex-shrink-0",
        collapsed ? "justify-center px-2" : "px-4"
      )}>
        {collapsed ? (
          <span className="text-xl font-bold text-veloce-500">V</span>
        ) : (
          <span className="text-xl font-bold text-veloce-500 tracking-tight">
            Veloce CRM
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" role="navigation" aria-label="Main navigation">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const label = t.nav[item.labelKey]

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-veloce-50 text-veloce-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "flex-shrink-0",
                      active ? "text-veloce-600" : "text-gray-400",
                    )}
                    size={20}
                  />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-2 border-t border-gray-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="ml-2">Colapsar</span>}
        </button>
      </div>

      {/* User section */}
      <div className={cn(
        "flex items-center gap-3 border-t border-gray-200 p-3 flex-shrink-0",
        collapsed && "justify-center"
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-veloce-100 flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-veloce-700">
              {userName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            {userEmail && (
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Cerrar sesion"
            title="Cerrar sesion"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  )
}
