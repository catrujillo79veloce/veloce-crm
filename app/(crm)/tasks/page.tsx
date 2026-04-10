import { getTasks } from "@/app/actions/tasks"
import { getTeamMembers, getContacts } from "@/app/actions/leads"
import { TaskList } from "@/components/tasks/TaskList"

export const dynamic = "force-dynamic"

export default async function TasksPage() {
  const [tasks, teamMembers, contacts] = await Promise.all([
    getTasks(),
    getTeamMembers(),
    getContacts(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <TaskList
        initialTasks={tasks}
        teamMembers={teamMembers}
        contacts={contacts}
      />
    </div>
  )
}
