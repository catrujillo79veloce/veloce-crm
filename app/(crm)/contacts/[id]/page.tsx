import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Phone,
  MessageCircle,
} from "lucide-react"
import {
  getContact,
  getContactInteractions,
  getContactDeals,
  getContactLeads,
  getContactNotes,
} from "@/app/actions/contacts"
import { getTeamMembers } from "@/app/actions/leads"
import { ContactDetailView } from "@/components/contacts/ContactDetailView"
import { Button } from "@/components/ui"

interface ContactDetailPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: ContactDetailPageProps) {
  const contact = await getContact(params.id)
  if (!contact) return { title: "Contacto no encontrado" }
  return {
    title: `${contact.first_name} ${contact.last_name} | Veloce CRM`,
  }
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const [contact, interactionsResult, deals, leads, notes, teamMembers] =
    await Promise.all([
      getContact(params.id),
      getContactInteractions(params.id, 1, 20),
      getContactDeals(params.id),
      getContactLeads(params.id),
      getContactNotes(params.id),
      getTeamMembers(),
    ])

  if (!contact) notFound()

  const waLink = contact.whatsapp_phone
    ? `https://wa.me/${contact.whatsapp_phone.replace(/[^0-9]/g, "")}`
    : null

  const phoneLink = contact.phone ? `tel:${contact.phone}` : null

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/contacts">
            <Button variant="ghost" size="sm" iconOnly aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {contact.first_name} {contact.last_name}
            </h1>
            <p className="text-sm text-gray-500">Detalle del Contacto</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp
              </Button>
            </a>
          )}
          {phoneLink && (
            <a href={phoneLink}>
              <Button variant="secondary" size="sm">
                <Phone className="h-4 w-4 text-blue-600" />
                Llamar
              </Button>
            </a>
          )}
          <Link href={`/contacts/${contact.id}/edit`}>
            <Button variant="secondary" size="sm">
              Editar
            </Button>
          </Link>
        </div>
      </div>

      {/* Body */}
      <ContactDetailView
        contact={contact}
        interactions={interactionsResult.data}
        interactionCount={interactionsResult.count}
        deals={deals}
        leads={leads}
        notes={notes}
        teamMembers={teamMembers}
      />
    </div>
  )
}
