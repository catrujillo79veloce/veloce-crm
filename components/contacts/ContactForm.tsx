"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { CONTACT_SOURCES, CYCLING_EXPERIENCES } from "@/lib/constants"
import { createContact, updateContact } from "@/app/actions/contacts"
import type { Contact, ContactSource, ContactStatus } from "@/lib/types"

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------

interface ContactFormProps {
  contact?: Contact
  mode: "create" | "edit"
}

// -------------------------------------------------------------------
// Status options
// -------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "do_not_contact", label: "No Contactar" },
]

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function ContactForm({ contact, mode }: ContactFormProps) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [firstName, setFirstName] = useState(contact?.first_name ?? "")
  const [lastName, setLastName] = useState(contact?.last_name ?? "")
  const [email, setEmail] = useState(contact?.email ?? "")
  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [whatsappPhone, setWhatsappPhone] = useState(
    contact?.whatsapp_phone ?? ""
  )
  const [source, setSource] = useState<ContactSource>(
    contact?.source ?? "manual"
  )
  const [city, setCity] = useState(contact?.city ?? "Medellin")
  const [neighborhood, setNeighborhood] = useState(
    contact?.neighborhood ?? ""
  )
  const [cyclingExperience, setCyclingExperience] = useState(
    contact?.cycling_experience ?? ""
  )
  const [bikeType, setBikeType] = useState(contact?.bike_type ?? "")
  const [interests, setInterests] = useState(
    contact?.interests?.join(", ") ?? ""
  )
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<ContactStatus>(
    contact?.status ?? "active"
  )

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!firstName.trim()) errs.first_name = "El nombre es obligatorio"
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Formato de correo invalido"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Source dropdown options
  const sourceOptions = CONTACT_SOURCES.map((s) => ({
    value: s.value,
    label: s.label[locale] ?? s.label.es,
  }))

  const experienceOptions = CYCLING_EXPERIENCES.map((e) => ({
    value: e.value,
    label: e.label[locale] ?? e.label.es,
  }))

  // Submit handler
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const formData = {
      first_name: firstName,
      last_name: lastName,
      email: email || undefined,
      phone: phone || undefined,
      whatsapp_phone: whatsappPhone || undefined,
      source,
      city: city || undefined,
      neighborhood: neighborhood || undefined,
      cycling_experience: cyclingExperience || undefined,
      bike_type: bikeType || undefined,
      interests: interests || undefined,
      notes: notes || undefined,
      status,
    }

    startTransition(async () => {
      if (mode === "create") {
        const result = await createContact(formData)
        if (result.success) {
          toast("success", "Contacto creado exitosamente")
          router.push(`/contacts/${result.id}`)
        } else {
          toast("error", result.error ?? "Error al crear contacto")
        }
      } else {
        const result = await updateContact(contact!.id, formData)
        if (result.success) {
          toast("success", "Contacto actualizado")
          router.push(`/contacts/${contact!.id}`)
        } else {
          toast("error", result.error ?? "Error al actualizar contacto")
        }
      }
    })
  }

  const title =
    mode === "create" ? t.contacts.newContact : t.contacts.editContact

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => router.back()}
          aria-label={t.common.back}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">
              {t.contacts.info}
            </h2>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t.contacts.firstName + " *"}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={errors.first_name}
                placeholder="Juan"
              />
              <Input
                label={t.contacts.lastName}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Perez"
              />
            </div>

            {/* Contact row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t.contacts.email}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="juan@correo.com"
              />
              <Input
                label={t.contacts.phone}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="300 123 4567"
              />
            </div>

            {/* WhatsApp */}
            <Input
              label={t.contacts.whatsapp}
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="300 123 4567"
            />

            {/* Source & Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={t.contacts.source}
                options={sourceOptions}
                value={source}
                onChange={(e) => setSource(e.target.value as ContactSource)}
              />
              <Select
                label={t.contacts.status}
                options={STATUS_OPTIONS}
                value={status}
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t.contacts.city}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Medellin"
              />
              <Input
                label={t.contacts.neighborhood}
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="El Poblado"
              />
            </div>

            {/* Cycling info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={t.contacts.cyclingExperience}
                options={experienceOptions}
                placeholder="Seleccionar..."
                value={cyclingExperience}
                onChange={(e) => setCyclingExperience(e.target.value)}
              />
              <Input
                label={t.contacts.bikeType}
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value)}
                placeholder="Ruta, MTB, Gravel..."
              />
            </div>

            {/* Interests */}
            <Input
              label={t.contacts.interests}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="Ruta, entrenamiento, competencias..."
            />

            {/* Notes (create mode only) */}
            {mode === "create" && (
              <Textarea
                label={t.contacts.notes}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas iniciales sobre el contacto..."
                rows={3}
              />
            )}
          </CardContent>

          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={isPending}>
              {mode === "create" ? t.common.create : t.common.save}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
