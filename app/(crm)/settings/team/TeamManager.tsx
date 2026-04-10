"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Mail,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
import {
  Button,
  Input,
  Select,
  Badge,
  Avatar,
  Card,
} from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import type { TeamMember, UserRole } from "@/lib/types"

const roleConfig: Record<
  UserRole,
  {
    labelEs: string
    labelEn: string
    color: string
    icon: typeof Shield
  }
> = {
  admin: {
    labelEs: "Admin",
    labelEn: "Admin",
    color: "#ef4444",
    icon: ShieldAlert,
  },
  manager: {
    labelEs: "Gerente",
    labelEn: "Manager",
    color: "#f59e0b",
    icon: ShieldCheck,
  },
  sales_rep: {
    labelEs: "Vendedor",
    labelEn: "Sales Rep",
    color: "#3b82f6",
    icon: Shield,
  },
}

interface TeamManagerProps {
  initialMembers: TeamMember[]
}

export default function TeamManager({ initialMembers }: TeamManagerProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("sales_rep")

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()

    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast(
        "error",
        locale === "es"
          ? "Email y nombre son requeridos"
          : "Email and name are required"
      )
      return
    }

    startTransition(async () => {
      // In a real app, this would send an invitation email
      toast(
        "success",
        locale === "es"
          ? `Invitacion enviada a ${inviteEmail}`
          : `Invitation sent to ${inviteEmail}`
      )
      setInviteEmail("")
      setInviteName("")
      setShowInviteForm(false)
    })
  }

  const roleOptions = Object.entries(roleConfig).map(([value, config]) => ({
    value,
    label: locale === "es" ? config.labelEs : config.labelEn,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => router.push("/settings")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t.settings.team}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {initialMembers.length}{" "}
              {locale === "es" ? "miembros" : "members"}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowInviteForm(!showInviteForm)}>
          <UserPlus className="h-4 w-4" />
          {t.settings.inviteMember}
        </Button>
      </div>

      {/* Invite form */}
      {showInviteForm && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            {t.settings.inviteMember}
          </h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={locale === "es" ? "Nombre completo" : "Full name"}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Juan Perez"
                required
              />
              <Input
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="juan@veloce.com"
                required
              />
              <Select
                label={locale === "es" ? "Rol" : "Role"}
                options={roleOptions}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowInviteForm(false)}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" size="sm" loading={isPending}>
                <Mail className="h-3.5 w-3.5" />
                {locale === "es" ? "Enviar Invitacion" : "Send Invitation"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <div className="divide-y divide-gray-100">
          {initialMembers.map((member) => {
            const config = roleConfig[member.role]
            const RoleIcon = config.icon
            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <Avatar
                  src={member.avatar_url}
                  firstName={member.full_name.split(" ")[0]}
                  lastName={member.full_name.split(" ")[1] || ""}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.full_name}
                    </p>
                    {!member.is_active && (
                      <Badge color="#6b7280" className="text-[10px]">
                        {locale === "es" ? "Inactivo" : "Inactive"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {member.email}
                  </p>
                </div>
                <Badge color={config.color}>
                  <RoleIcon className="mr-1 h-3 w-3" />
                  {locale === "es" ? config.labelEs : config.labelEn}
                </Badge>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
