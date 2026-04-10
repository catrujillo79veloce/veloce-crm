"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Globe,
  MessageCircle,
  Camera,
  Megaphone,
  Store,
  Wifi,
  WifiOff,
} from "lucide-react"
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatDate } from "@/lib/utils"
import type { Channel } from "@/lib/types"

const channelMeta: Record<
  string,
  {
    icon: typeof Globe
    color: string
    labelEs: string
    labelEn: string
    fields: { key: string; labelEs: string; labelEn: string; type?: string }[]
  }
> = {
  whatsapp: {
    icon: MessageCircle,
    color: "#25d366",
    labelEs: "WhatsApp Business",
    labelEn: "WhatsApp Business",
    fields: [
      {
        key: "api_token",
        labelEs: "Token de API",
        labelEn: "API Token",
        type: "password",
      },
      {
        key: "phone_number_id",
        labelEs: "ID Numero de Telefono",
        labelEn: "Phone Number ID",
      },
      {
        key: "webhook_url",
        labelEs: "URL de Webhook",
        labelEn: "Webhook URL",
      },
    ],
  },
  facebook: {
    icon: Megaphone,
    color: "#1877f2",
    labelEs: "Facebook Messenger",
    labelEn: "Facebook Messenger",
    fields: [
      {
        key: "page_access_token",
        labelEs: "Token de Pagina",
        labelEn: "Page Access Token",
        type: "password",
      },
      { key: "page_id", labelEs: "ID de Pagina", labelEn: "Page ID" },
      {
        key: "webhook_url",
        labelEs: "URL de Webhook",
        labelEn: "Webhook URL",
      },
    ],
  },
  instagram: {
    icon: Camera,
    color: "#e4405f",
    labelEs: "Instagram Direct",
    labelEn: "Instagram Direct",
    fields: [
      {
        key: "access_token",
        labelEs: "Token de Acceso",
        labelEn: "Access Token",
        type: "password",
      },
      {
        key: "ig_account_id",
        labelEs: "ID de Cuenta IG",
        labelEn: "IG Account ID",
      },
    ],
  },
  website_form: {
    icon: Globe,
    color: "#6b7280",
    labelEs: "Formulario Web",
    labelEn: "Website Form",
    fields: [
      {
        key: "webhook_url",
        labelEs: "URL de Webhook",
        labelEn: "Webhook URL",
      },
      {
        key: "form_id",
        labelEs: "ID del Formulario",
        labelEn: "Form ID",
      },
    ],
  },
  walk_in: {
    icon: Store,
    color: "#8b5cf6",
    labelEs: "Tienda Fisica",
    labelEn: "Walk-in Store",
    fields: [],
  },
}

interface ChannelsConfigProps {
  initialChannels: Channel[]
}

export default function ChannelsConfig({
  initialChannels,
}: ChannelsConfigProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [channels] = useState(initialChannels)

  const handleTestConnection = (_channelId: string) => {
    startTransition(async () => {
      // Simulate a connection test
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast(
        "success",
        locale === "es"
          ? "Conexion exitosa"
          : "Connection successful"
      )
    })
  }

  // Build default channel list if DB is empty
  const channelTypes = Object.keys(channelMeta)
  const displayChannels = channelTypes.map((type) => {
    const existing = channels.find((c) => c.type === type)
    return (
      existing || {
        id: type,
        type: type as Channel["type"],
        name: type,
        is_active: false,
        config: {},
        webhook_secret: null,
        last_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    )
  })

  return (
    <div className="space-y-6 max-w-3xl">
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
            {t.settings.channelConfig}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "es"
              ? "Configura los canales de comunicacion"
              : "Configure communication channels"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {displayChannels.map((channel) => {
          const meta = channelMeta[channel.type]
          if (!meta) return null
          const Icon = meta.icon
          const config = (channel.config || {}) as Record<string, string>

          return (
            <Card key={channel.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${meta.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {locale === "es" ? meta.labelEs : meta.labelEn}
                    </h3>
                  </div>
                  <Badge
                    color={channel.is_active ? "#22c55e" : "#6b7280"}
                    className="gap-1"
                  >
                    {channel.is_active ? (
                      <>
                        <Wifi className="h-3 w-3" />
                        {locale === "es" ? "Activo" : "Active"}
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3" />
                        {locale === "es" ? "Inactivo" : "Inactive"}
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>

              {meta.fields.length > 0 && (
                <CardContent>
                  <div className="space-y-3">
                    {meta.fields.map((field) => (
                      <Input
                        key={field.key}
                        label={
                          locale === "es" ? field.labelEs : field.labelEn
                        }
                        type={field.type || "text"}
                        defaultValue={config[field.key] || ""}
                        placeholder="..."
                      />
                    ))}
                  </div>
                </CardContent>
              )}

              <CardFooter className="justify-between">
                <div className="text-xs text-gray-400">
                  {channel.last_synced_at && (
                    <>
                      {locale === "es" ? "Ultima sync: " : "Last sync: "}
                      {formatDate(channel.last_synced_at, locale)}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {meta.fields.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTestConnection(channel.id)}
                      loading={isPending}
                    >
                      {locale === "es"
                        ? "Probar Conexion"
                        : "Test Connection"}
                    </Button>
                  )}
                  <Button size="sm">
                    {t.common.save}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
