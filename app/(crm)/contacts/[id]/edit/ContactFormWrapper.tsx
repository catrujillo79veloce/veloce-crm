"use client"

import { ContactForm } from "@/components/contacts/ContactForm"
import type { Contact } from "@/lib/types"

interface ContactFormWrapperProps {
  contact: Contact
}

export function ContactFormWrapper({ contact }: ContactFormWrapperProps) {
  return <ContactForm contact={contact} mode="edit" />
}
