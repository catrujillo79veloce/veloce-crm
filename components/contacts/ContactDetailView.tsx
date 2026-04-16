"use client"

import {
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "@/components/ui"
import { ContactInfoPanel } from "./ContactInfoPanel"
import { ContactTimeline } from "./ContactTimeline"
import { ContactDeals } from "./ContactDeals"
import { ContactLeads } from "./ContactLeads"
import { ContactNotes } from "./ContactNotes"
import { ContactQuickActions } from "./ContactQuickActions"
import { useI18n } from "@/lib/i18n/config"
import type { Contact, Interaction, Deal, Lead, Note } from "@/lib/types"

interface TeamMemberOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface ContactDetailViewProps {
  contact: Contact
  interactions: Interaction[]
  interactionCount: number
  deals: Deal[]
  leads: Lead[]
  notes: Note[]
  teamMembers: TeamMemberOption[]
}

export function ContactDetailView({
  contact,
  interactions,
  interactionCount,
  deals,
  leads,
  notes,
  teamMembers,
}: ContactDetailViewProps) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column - info panel + quick actions */}
      <div className="lg:col-span-1 space-y-4">
        <ContactInfoPanel contact={contact} />
        <ContactQuickActions contact={contact} teamMembers={teamMembers} />
      </div>

      {/* Right column - tabs */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Tabs defaultValue="timeline">
            <TabList className="px-4">
              <Tab value="timeline">
                {t.contacts.timeline} ({interactionCount})
              </Tab>
              <Tab value="deals">
                Ventas ({deals.length})
              </Tab>
              <Tab value="leads">
                Leads ({leads.length})
              </Tab>
              <Tab value="notes">
                {t.contacts.notes} ({notes.length})
              </Tab>
            </TabList>

            <div className="px-4 pb-4">
              <TabPanel value="timeline">
                <ContactTimeline
                  contactId={contact.id}
                  initialInteractions={interactions}
                  totalCount={interactionCount}
                />
              </TabPanel>
              <TabPanel value="deals">
                <ContactDeals deals={deals} />
              </TabPanel>
              <TabPanel value="leads">
                <ContactLeads leads={leads} />
              </TabPanel>
              <TabPanel value="notes">
                <ContactNotes
                  contactId={contact.id}
                  initialNotes={notes}
                />
              </TabPanel>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
