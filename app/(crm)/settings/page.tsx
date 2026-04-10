"use client"

import Link from "next/link"
import { Users, Radio, Tag, UserCircle, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { useI18n } from "@/lib/i18n/config"

const settingsSections = [
  {
    key: "team",
    href: "/settings/team",
    icon: Users,
    titleEs: "Equipo",
    titleEn: "Team",
    descEs: "Gestiona los miembros de tu equipo y sus roles",
    descEn: "Manage team members and their roles",
    color: "#3b82f6",
  },
  {
    key: "channels",
    href: "/settings/channels",
    icon: Radio,
    titleEs: "Canales",
    titleEn: "Channels",
    descEs: "Configura WhatsApp, Facebook, Instagram y otros canales",
    descEn: "Configure WhatsApp, Facebook, Instagram and other channels",
    color: "#22c55e",
  },
  {
    key: "tags",
    href: "/settings/tags",
    icon: Tag,
    titleEs: "Etiquetas",
    titleEn: "Tags",
    descEs: "Crea y administra etiquetas para organizar contactos",
    descEn: "Create and manage tags to organize contacts",
    color: "#f59e0b",
  },
  {
    key: "profile",
    href: "/settings/profile",
    icon: UserCircle,
    titleEs: "Perfil",
    titleEn: "Profile",
    descEs: "Actualiza tu informacion personal y contrasena",
    descEn: "Update your personal information and password",
    color: "#8b5cf6",
  },
]

export default function SettingsPage() {
  const { t, locale } = useI18n()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {locale === "es"
            ? "Administra la configuracion de tu CRM"
            : "Manage your CRM configuration"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.key} href={section.href}>
              <Card className="hover:border-gray-300 hover:shadow-md transition-all cursor-pointer">
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${section.color}15` }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: section.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {locale === "es" ? section.titleEs : section.titleEn}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {locale === "es" ? section.descEs : section.descEn}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
