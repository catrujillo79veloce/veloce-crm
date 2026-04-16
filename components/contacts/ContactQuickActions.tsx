"use client"

import { useState } from "react"
import { Plus, CheckCircle, Pause, Ban } from "lucide-react"
import { Button, Card, CardContent, Select } from "@/components/ui"
import { TaskForm } from "@/components/tasks/TaskForm"
import { updateContactStatus } from "@/app/actions/contacts"
import { useToast } from "@/components/ui"
import { useRouter } from "next/navigation"
import type { Contact, ContactStatus, Task } from "@/lib/types"

interface TeamMemberOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface ContactQuickActionsProps {
  contact: Contact
  teamMembers: TeamMemberOption[]
}

const STATUS_OPTIONS: Array<{
  value: ContactStatus
  label: string
  icon: typeof CheckCircle
  color: string
}> = [
  { value: "active", label: "Activo", icon: CheckCircle, color: "text-green-600" },
  { value: "inactive", label: "Inactivo", icon: Pause, color: "text-gray-500" },
  { value: "do_not_contact", label: "No Contactar", icon: Ban, color: "text-red-600" },
]

export function ContactQuickActions({
  contact,
  teamMembers,
}: ContactQuickActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [status, setStatus] = useState<ContactStatus>(contact.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const contactOption = {
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    avatar_url: contact.avatar_url,
  }

  const handleStatusChange = async (newStatus: ContactStatus) => {
    setUpdatingStatus(true)
    setStatus(newStatus)
    const result = await updateContactStatus(contact.id, newStatus)
    setUpdatingStatus(false)

    if (result.success) {
      toast(
        "success",
        `Estado actualizado: ${
          STATUS_OPTIONS.find((o) => o.value === newStatus)?.label
        }`
      )
      router.refresh()
    } else {
      setStatus(contact.status)
      toast("error", result.error || "No se pudo actualizar el estado")
    }
  }

  const handleTaskSaved = (_task: Task) => {
    setShowTaskForm(false)
    toast("success", "Tarea creada para este cliente")
    router.refresh()
  }

  const currentStatusOption = STATUS_OPTIONS.find((o) => o.value === status)

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Acciones rápidas
          </h3>

          {/* Status change */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">
              Estado del cliente
            </label>
            <div className="flex items-center gap-2">
              {currentStatusOption && (
                <currentStatusOption.icon
                  className={`h-4 w-4 ${currentStatusOption.color} shrink-0`}
                />
              )}
              <Select
                value={status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as ContactStatus)
                }
                disabled={updatingStatus}
                options={STATUS_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                className="flex-1"
              />
            </div>
          </div>

          {/* New task button */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowTaskForm(true)}
          >
            <Plus className="h-4 w-4" />
            Nueva tarea para este cliente
          </Button>
        </CardContent>
      </Card>

      {/* Task form dialog */}
      <TaskForm
        open={showTaskForm}
        onClose={() => setShowTaskForm(false)}
        onSaved={handleTaskSaved}
        task={null}
        teamMembers={teamMembers}
        contacts={[contactOption]}
      />
    </>
  )
}
