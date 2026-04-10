import { getLeads, getTeamMembers, getContacts } from "@/app/actions/leads"
import { LeadKanban } from "@/components/pipeline/LeadKanban"

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const [leadsByStatus, teamMembers, contacts] = await Promise.all([
    getLeads(),
    getTeamMembers(),
    getContacts(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <LeadKanban
        initialLeads={leadsByStatus}
        teamMembers={teamMembers}
        contacts={contacts}
      />
    </div>
  )
}
