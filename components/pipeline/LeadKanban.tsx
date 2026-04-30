"use client"

import React, { useState, useCallback, useMemo, useTransition } from "react"
import { Plus } from "lucide-react"
import { useI18n } from "@/lib/i18n/config"
import { LEAD_STATUSES, PRIORITIES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import type { Lead, LeadStatus, Priority } from "@/lib/types"
import type { LeadsByStatus } from "@/app/actions/leads"
import {
  createLead,
  updateLead,
  updateLeadStatus,
  type CreateLeadInput,
  type UpdateLeadInput,
} from "@/app/actions/leads"
import { KanbanBoard, type KanbanColumnData } from "./KanbanBoard"
import { KanbanCard } from "./KanbanCard"
import { PipelineFilters } from "./PipelineFilters"
import { Button, Dialog, Input, Select } from "@/components/ui"
import { CONTACT_SOURCES } from "@/lib/constants"
import type { ContactSource } from "@/lib/types"

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
  phone: string | null
  avatar_url: string | null
}

interface LeadKanbanProps {
  initialLeads: LeadsByStatus
  teamMembers: TeamMemberOption[]
  contacts: ContactOption[]
}

export function LeadKanban({
  initialLeads,
  teamMembers,
  contacts,
}: LeadKanbanProps) {
  const { t, locale } = useI18n()
  const [, startTransition] = useTransition()
  const [leads, setLeads] = useState<LeadsByStatus>(initialLeads)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  // Filters
  const [filterAssignedTo, setFilterAssignedTo] = useState("")
  const [filterPriority, setFilterPriority] = useState("")
  const [filterSearch, setFilterSearch] = useState("")

  // Apply filters
  const filteredLeads = useMemo(() => {
    const result: LeadsByStatus = {}
    for (const [status, items] of Object.entries(leads)) {
      result[status] = items.filter((lead) => {
        if (filterAssignedTo && lead.assigned_to !== filterAssignedTo) return false
        if (filterPriority && lead.priority !== filterPriority) return false
        if (filterSearch) {
          const search = filterSearch.toLowerCase()
          const contactName = lead.contact
            ? `${lead.contact.first_name} ${lead.contact.last_name}`.toLowerCase()
            : ""
          if (
            !lead.title.toLowerCase().includes(search) &&
            !contactName.includes(search)
          ) {
            return false
          }
        }
        return true
      })
    }
    return result
  }, [leads, filterAssignedTo, filterPriority, filterSearch])

  // Build columns for KanbanBoard
  const columns: KanbanColumnData<Lead>[] = useMemo(() => {
    return LEAD_STATUSES.map((status) => {
      const items = filteredLeads[status.value] || []
      const totalValue = items.reduce(
        (sum, lead) => sum + (lead.estimated_value || 0),
        0
      )
      return {
        id: status.value,
        title: status.label[locale],
        color: status.color,
        items,
        sumLabel: totalValue > 0 ? formatCurrency(totalValue) : undefined,
      }
    })
  }, [filteredLeads, locale])

  // Handle drag-and-drop
  const handleCardMove = useCallback(
    (cardId: string, newColumnId: string, newPosition: number) => {
      // Optimistic update
      setLeads((prev) => {
        const next = { ...prev }
        // Deep clone arrays
        for (const key of Object.keys(next)) {
          next[key] = [...next[key]]
        }

        // Find and remove the card from its current column
        let movedLead: Lead | null = null
        for (const [status, items] of Object.entries(next)) {
          const idx = items.findIndex((l) => l.id === cardId)
          if (idx !== -1) {
            movedLead = { ...items[idx] }
            next[status] = items.filter((_, i) => i !== idx)
            break
          }
        }

        if (!movedLead) return prev

        // Update the lead status
        movedLead.status = newColumnId as LeadStatus
        movedLead.position = newPosition

        // Insert into the new column at the specified position
        const targetItems = next[newColumnId] || []
        targetItems.splice(newPosition, 0, movedLead)
        next[newColumnId] = targetItems

        return next
      })

      // Server-side update
      startTransition(async () => {
        await updateLeadStatus(cardId, newColumnId as LeadStatus, newPosition)
      })
    },
    []
  )

  // Create lead handler
  const handleCreateLead = useCallback(
    async (data: CreateLeadInput) => {
      const result = await createLead(data)
      if (result.data) {
        setLeads((prev) => {
          const next = { ...prev }
          next["new"] = [...(next["new"] || []), result.data!]
          return next
        })
        setShowCreateDialog(false)
      }
      return result
    },
    []
  )

  const handleUpdateLead = useCallback(
    async (id: string, data: UpdateLeadInput) => {
      const result = await updateLead(id, data)
      if (result.data) {
        setLeads((prev) => {
          const next = { ...prev }
          for (const status of Object.keys(next)) {
            next[status] = next[status].map((l) =>
              l.id === id ? (result.data as Lead) : l
            )
          }
          return next
        })
        setEditingLead(null)
      }
      return result
    },
    []
  )

  const renderCard = useCallback(
    (lead: Lead, dragHandle: { ref: (el: HTMLElement | null) => void; listeners: Record<string, React.EventHandler<React.SyntheticEvent>> | undefined }) => (
      <KanbanCard lead={lead} locale={locale} onEdit={() => setEditingLead(lead)} dragHandle={dragHandle} />
    ),
    [locale]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: filters + add button */}
      <div className="flex items-center gap-3 flex-wrap">
        <PipelineFilters
          teamMembers={teamMembers}
          assignedTo={filterAssignedTo}
          onAssignedToChange={setFilterAssignedTo}
          priority={filterPriority}
          onPriorityChange={setFilterPriority}
          search={filterSearch}
          onSearchChange={setFilterSearch}
        />
        <div className="ml-auto">
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4" />
            {t.leads.newLead}
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <KanbanBoard
        columns={columns}
        onCardMove={handleCardMove}
        onCardClick={setEditingLead}
        renderCard={renderCard}
      />

      {/* Create lead dialog */}
      <CreateLeadDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateLead}
        contacts={contacts}
        teamMembers={teamMembers}
      />

      {/* Edit lead dialog */}
      {editingLead && (
        <EditLeadDialog
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSubmit={(data) => handleUpdateLead(editingLead.id, data)}
          teamMembers={teamMembers}
        />
      )}
    </div>
  )
}

/* ------ Edit Lead Dialog ------ */

function EditLeadDialog({
  lead,
  onClose,
  onSubmit,
  teamMembers,
}: {
  lead: Lead
  onClose: () => void
  onSubmit: (data: UpdateLeadInput) => Promise<{ data: Lead | null; error: string | null }>
  teamMembers: TeamMemberOption[]
}) {
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(lead.title)
  const [priority, setPriority] = useState<Priority>(lead.priority)
  const [estimatedValue, setEstimatedValue] = useState(
    lead.estimated_value != null ? String(lead.estimated_value) : ""
  )
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to || "")
  const [source, setSource] = useState<string>(lead.source || "")
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    lead.expected_close_date ? lead.expected_close_date.slice(0, 10) : ""
  )
  const [lostReason, setLostReason] = useState(lead.lost_reason || "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError(locale === "es" ? "El título es requerido" : "Title is required")
      return
    }
    setLoading(true)
    setError(null)

    const result = await onSubmit({
      title: title.trim(),
      priority,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      assigned_to: assignedTo || null,
      source: (source as ContactSource) || null,
      expected_close_date: expectedCloseDate || null,
      lost_reason: lostReason || null,
    })

    setLoading(false)
    if (result.error) setError(result.error)
  }

  const memberOptions = [
    { value: "", label: locale === "es" ? "Sin asignar" : "Unassigned" },
    ...teamMembers.map((m) => ({ value: m.id, label: m.full_name })),
  ]

  const priorityOptions = PRIORITIES.map((p) => ({
    value: p.value,
    label: p.label[locale],
  }))

  const sourceOptions = [
    { value: "", label: locale === "es" ? "Sin fuente" : "No source" },
    ...CONTACT_SOURCES.map((s) => ({ value: s.value, label: s.label[locale] })),
  ]

  const contactName = lead.contact
    ? `${lead.contact.first_name} ${lead.contact.last_name}`
    : ""

  return (
    <Dialog
      open
      onClose={onClose}
      title={locale === "es" ? "Editar Lead" : "Edit Lead"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {contactName && (
          <p className="text-sm text-gray-500">
            {locale === "es" ? "Contacto: " : "Contact: "}
            <span className="font-medium text-gray-700">{contactName}</span>
          </p>
        )}

        <Input
          label={locale === "es" ? "Título del Lead" : "Lead Title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.leads.priority}
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
          <Input
            label={t.leads.estimatedValue}
            type="number"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="0"
            min="0"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={locale === "es" ? "Fuente" : "Source"}
            options={sourceOptions}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <Input
            label={locale === "es" ? "Fecha cierre estimada" : "Expected close date"}
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
        </div>

        <Select
          label={locale === "es" ? "Asignar a" : "Assign to"}
          options={memberOptions}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        />

        {(lead.status === "lost") && (
          <Input
            label={locale === "es" ? "Razón de pérdida" : "Lost reason"}
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" loading={loading}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ------ Create Lead Dialog ------ */

function CreateLeadDialog({
  open,
  onClose,
  onSubmit,
  contacts,
  teamMembers,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateLeadInput) => Promise<{ data: Lead | null; error: string | null }>
  contacts: ContactOption[]
  teamMembers: TeamMemberOption[]
}) {
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contactId, setContactId] = useState("")
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [estimatedValue, setEstimatedValue] = useState("")
  const [assignedTo, setAssignedTo] = useState("")

  const resetForm = () => {
    setContactId("")
    setTitle("")
    setPriority("medium")
    setEstimatedValue("")
    setAssignedTo("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactId || !title) {
      setError(locale === "es" ? "Contacto y titulo son requeridos" : "Contact and title are required")
      return
    }

    setLoading(true)
    setError(null)

    const result = await onSubmit({
      contact_id: contactId,
      title,
      priority,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      assigned_to: assignedTo || null,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      resetForm()
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const contactOptions = contacts.map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ""}`,
  }))

  const memberOptions = [
    { value: "", label: locale === "es" ? "Sin asignar" : "Unassigned" },
    ...teamMembers.map((m) => ({ value: m.id, label: m.full_name })),
  ]

  const priorityOptions = PRIORITIES.map((p) => ({
    value: p.value,
    label: p.label[locale],
  }))

  return (
    <Dialog open={open} onClose={handleClose} title={t.leads.newLead}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label={locale === "es" ? "Contacto" : "Contact"}
          options={contactOptions}
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          placeholder={locale === "es" ? "Seleccionar contacto..." : "Select contact..."}
          required
        />

        <Input
          label={locale === "es" ? "Titulo del Lead" : "Lead Title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            locale === "es"
              ? "Ej: Bicicleta de ruta Tarmac"
              : "E.g: Road bike Tarmac"
          }
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.leads.priority}
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />

          <Input
            label={t.leads.estimatedValue}
            type="number"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="0"
            min="0"
          />
        </div>

        <Select
          label={locale === "es" ? "Asignar a" : "Assign to"}
          options={memberOptions}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        />

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" loading={loading}>
            {t.common.create}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
