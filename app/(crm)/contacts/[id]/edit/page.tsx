import { notFound } from "next/navigation"
import { getContact } from "@/app/actions/contacts"
import { ContactFormWrapper } from "./ContactFormWrapper"

interface EditContactPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: EditContactPageProps) {
  const contact = await getContact(params.id)
  if (!contact) return { title: "Contacto no encontrado" }
  return {
    title: `Editar ${contact.first_name} ${contact.last_name} | Veloce CRM`,
  }
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const contact = await getContact(params.id)
  if (!contact) notFound()

  return <ContactFormWrapper contact={contact} />
}
