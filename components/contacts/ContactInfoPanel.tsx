"use client"

import Link from "next/link"
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Bike,
  Award,
  Edit2,
} from "lucide-react"
import { Avatar, Badge, Button, Card, CardContent } from "@/components/ui"
import { ChannelBadge } from "./ChannelBadge"
import { useI18n } from "@/lib/i18n/config"
import { CYCLING_EXPERIENCES } from "@/lib/constants"
import type { Contact } from "@/lib/types"

interface ContactInfoPanelProps {
  contact: Contact
}

export function ContactInfoPanel({ contact }: ContactInfoPanelProps) {
  const { t, locale } = useI18n()

  const experienceLabel =
    CYCLING_EXPERIENCES.find((e) => e.value === contact.cycling_experience)
      ?.label[locale] ?? contact.cycling_experience

  return (
    <Card>
      <CardContent className="space-y-5">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center text-center">
          <Avatar
            src={contact.avatar_url}
            firstName={contact.first_name}
            lastName={contact.last_name}
            size="lg"
          />
          <h2 className="mt-3 text-lg font-semibold text-gray-900">
            {contact.first_name} {contact.last_name}
          </h2>
          <div className="mt-1">
            <ChannelBadge source={contact.source} />
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-3 text-sm">
          {contact.phone && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <Phone className="h-4 w-4 text-gray-400 shrink-0" />
              <a
                href={`tel:${contact.phone}`}
                className="hover:text-veloce-600 transition-colors"
              >
                {contact.phone}
              </a>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                className="hover:text-veloce-600 transition-colors truncate"
              >
                {contact.email}
              </a>
            </div>
          )}
          {contact.whatsapp_phone && (
            <div className="flex items-center gap-2.5 text-gray-600">
              <MessageCircle className="h-4 w-4 text-green-500 shrink-0" />
              <a
                href={`https://wa.me/${contact.whatsapp_phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-600 transition-colors"
              >
                {contact.whatsapp_phone}
              </a>
            </div>
          )}
        </div>

        {/* Divider */}
        <hr className="border-gray-100" />

        {/* Location */}
        {(contact.city || contact.neighborhood) && (
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Ubicacion
            </h3>
            <div className="flex items-center gap-2.5 text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
              <span>
                {[contact.neighborhood, contact.city]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          </div>
        )}

        {/* Cycling */}
        {(contact.cycling_experience || contact.bike_type) && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-2 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Ciclismo
              </h3>
              {contact.cycling_experience && (
                <div className="flex items-center gap-2.5 text-gray-600">
                  <Award className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{experienceLabel}</span>
                </div>
              )}
              {contact.bike_type && (
                <div className="flex items-center gap-2.5 text-gray-600">
                  <Bike className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{contact.bike_type}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t.contacts.tags}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <Badge key={tag.id} color={tag.color}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Edit button */}
        <div className="pt-1">
          <Link href={`/contacts/${contact.id}/edit`} className="block">
            <Button variant="secondary" className="w-full">
              <Edit2 className="h-4 w-4" />
              {t.common.edit}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
