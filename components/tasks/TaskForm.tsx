"use client"

import React, { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n/config"
import { PRIORITIES } from "@/lib/constants"
import {
  createTask,
  updateTask,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/app/actions/tasks"
import type { Task, Priority } from "@/lib/types"
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui"

interface TeamMemberOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface ContactOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
  avatar_url: string | null
}

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSaved: (task: Task) => void
  task?: Task | null
  teamMembers: TeamMemberOption[]
  contacts: ContactOption[]
}

export function TaskForm({
  open,
  onClose,
  onSaved,
  task,
  teamMembers,
  contacts,
}: TaskFormProps) {
  const { t, locale } = useI18n()
  const isEditing = !!task

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [contactId, setContactId] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [dueDate, setDueDate] = useState("")
  const [assignedTo, setAssignedTo] = useState("")

  // Populate form when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || "")
      setContactId(task.contact_id || "")
      setPriority(task.priority)
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "")
      setAssignedTo(task.assigned_to || "")
    } else {
      resetForm()
    }
  }, [task])

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setContactId("")
    setPriority("medium")
    setDueDate("")
    setAssignedTo("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError(locale === "es" ? "El titulo es requerido" : "Title is required")
      return
    }

    if (!assignedTo) {
      setError(locale === "es" ? "Debes asignar la tarea" : "Task must be assigned")
      return
    }

    setLoading(true)

    try {
      if (isEditing && task) {
        const input: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || null,
          contact_id: contactId || null,
          priority,
          due_date: dueDate || null,
          assigned_to: assignedTo,
        }

        const result = await updateTask(task.id, input)
        if (result.error) {
          setError(result.error)
        } else if (result.data) {
          onSaved(result.data)
          resetForm()
        }
      } else {
        const input: CreateTaskInput = {
          title: title.trim(),
          description: description.trim() || null,
          contact_id: contactId || null,
          assigned_to: assignedTo,
          priority,
          due_date: dueDate || null,
        }

        const result = await createTask(input)
        if (result.error) {
          setError(result.error)
        } else if (result.data) {
          onSaved(result.data)
          resetForm()
        }
      }
    } catch {
      setError(locale === "es" ? "Error inesperado" : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const contactOptions = [
    { value: "", label: locale === "es" ? "Ninguno" : "None" },
    ...contacts.map((c) => ({
      value: c.id,
      label: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ""}`,
    })),
  ]

  const memberOptions = teamMembers.map((m) => ({
    value: m.id,
    label: m.full_name,
  }))

  const priorityOptions = PRIORITIES.map((p) => ({
    value: p.value,
    label: p.label[locale],
  }))

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEditing ? t.tasks.editTask : t.tasks.newTask}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={locale === "es" ? "Titulo" : "Title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            locale === "es"
              ? "Ej: Llamar cliente para seguimiento"
              : "E.g: Follow up with client"
          }
          required
        />

        <Textarea
          label={t.tasks.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            locale === "es"
              ? "Descripcion opcional..."
              : "Optional description..."
          }
          rows={3}
        />

        <Select
          label={locale === "es" ? "Contacto" : "Contact"}
          options={contactOptions}
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.leads.priority}
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />

          <Input
            label={t.tasks.dueDate}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <Select
          label={locale === "es" ? "Asignar a" : "Assign to"}
          options={memberOptions}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder={locale === "es" ? "Seleccionar miembro..." : "Select member..."}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? t.common.save : t.common.create}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
