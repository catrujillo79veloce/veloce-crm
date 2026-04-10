"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  UserCircle,
  Camera,
  Lock,
  Mail,
  Phone,
} from "lucide-react"
import { Button, Input, Avatar, Card } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"

export default function ProfileSettingsPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const { teamMember } = useCurrentUser()

  const [fullName, setFullName] = useState(teamMember?.full_name || "")
  const [email, setEmail] = useState(teamMember?.email || "")
  const [phone, setPhone] = useState(teamMember?.phone || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      // In a real app, this would call an update profile action
      toast(
        "success",
        locale === "es" ? "Perfil actualizado" : "Profile updated"
      )
    })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast(
        "error",
        locale === "es"
          ? "Las contrasenas no coinciden"
          : "Passwords do not match"
      )
      return
    }

    if (newPassword.length < 8) {
      toast(
        "error",
        locale === "es"
          ? "La contrasena debe tener al menos 8 caracteres"
          : "Password must be at least 8 characters"
      )
      return
    }

    startTransition(async () => {
      // In a real app, this would call a change password action
      toast(
        "success",
        locale === "es"
          ? "Contrasena actualizada"
          : "Password updated"
      )
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
            {t.settings.profile}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "es"
              ? "Actualiza tu informacion personal"
              : "Update your personal information"}
          </p>
        </div>
      </div>

      {/* Avatar section */}
      <Card padding="md">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              src={teamMember?.avatar_url}
              firstName={fullName.split(" ")[0] || "U"}
              lastName={fullName.split(" ")[1] || ""}
              size="lg"
            />
            <button
              type="button"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
              aria-label={
                locale === "es" ? "Cambiar avatar" : "Change avatar"
              }
            >
              <Camera className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {fullName || (locale === "es" ? "Usuario" : "User")}
            </p>
            <p className="text-xs text-gray-500">{email}</p>
            <p className="text-xs text-gray-400 mt-1">
              {locale === "es"
                ? "Haz clic en el icono de camara para cambiar tu avatar"
                : "Click the camera icon to change your avatar"}
            </p>
          </div>
        </div>
      </Card>

      {/* Profile form */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          {locale === "es" ? "Informacion Personal" : "Personal Information"}
        </h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label={locale === "es" ? "Nombre completo" : "Full name"}
            icon={<UserCircle className="h-4 w-4" />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Juan Perez"
          />

          <Input
            label="Email"
            type="email"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@veloce.com"
          />

          <Input
            label={locale === "es" ? "Telefono" : "Phone"}
            icon={<Phone className="h-4 w-4" />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+57 300 123 4567"
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isPending}>
              {t.common.save}
            </Button>
          </div>
        </form>
      </Card>

      {/* Password section */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" />
          {locale === "es" ? "Cambiar Contrasena" : "Change Password"}
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label={
              locale === "es"
                ? "Contrasena actual"
                : "Current password"
            }
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            label={
              locale === "es" ? "Nueva contrasena" : "New password"
            }
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label={
              locale === "es"
                ? "Confirmar contrasena"
                : "Confirm password"
            }
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isPending}>
              {locale === "es"
                ? "Actualizar Contrasena"
                : "Update Password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
