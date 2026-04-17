"use client"

import { useState, useTransition } from "react"
import {
  Plus,
  CheckCircle,
  Pause,
  Ban,
  DollarSign,
  StickyNote,
  Tag as TagIcon,
  X,
} from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  Input,
  Select,
  Textarea,
} from "@/components/ui"
import { TaskForm } from "@/components/tasks/TaskForm"
import { updateContactStatus, createNote } from "@/app/actions/contacts"
import { createDeal } from "@/app/actions/deals"
import { tagContact, untagContact, createTag } from "@/app/actions/tags"
import { useToast } from "@/components/ui"
import { useRouter } from "next/navigation"
import type { Contact, ContactStatus, Task, Tag } from "@/lib/types"

interface TeamMemberOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface ContactQuickActionsProps {
  contact: Contact
  teamMembers: TeamMemberOption[]
  allTags: Tag[]
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

const TAG_COLORS = ["gray", "blue", "green", "yellow", "red", "purple", "pink"]

export function ContactQuickActions({
  contact,
  teamMembers,
  allTags,
}: ContactQuickActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()

  // Status
  const [status, setStatus] = useState<ContactStatus>(contact.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Task
  const [showTaskForm, setShowTaskForm] = useState(false)

  // Deal
  const [showDealDialog, setShowDealDialog] = useState(false)
  const [dealTitle, setDealTitle] = useState(
    `Venta a ${contact.first_name} ${contact.last_name}`
  )
  const [dealAmount, setDealAmount] = useState("")
  const [dealAssigned, setDealAssigned] = useState("")
  const [creatingDeal, setCreatingDeal] = useState(false)

  // Note
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  // Tags
  const currentTags = contact.tags ?? []
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("blue")

  const contactOption = {
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    avatar_url: contact.avatar_url,
  }

  // -------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------
  const handleStatusChange = async (newStatus: ContactStatus) => {
    setUpdatingStatus(true)
    setStatus(newStatus)
    const result = await updateContactStatus(contact.id, newStatus)
    setUpdatingStatus(false)

    if (result.success) {
      toast(
        "success",
        `Estado: ${STATUS_OPTIONS.find((o) => o.value === newStatus)?.label}`
      )
      router.refresh()
    } else {
      setStatus(contact.status)
      toast("error", result.error || "No se pudo actualizar el estado")
    }
  }

  // -------------------------------------------------------------------
  // Task
  // -------------------------------------------------------------------
  const handleTaskSaved = (_task: Task) => {
    setShowTaskForm(false)
    toast("success", "Tarea creada")
    router.refresh()
  }

  // -------------------------------------------------------------------
  // Deal
  // -------------------------------------------------------------------
  const handleCreateDeal = async () => {
    if (!dealTitle.trim()) {
      toast("error", "Pon un título para el deal")
      return
    }

    setCreatingDeal(true)
    const result = await createDeal({
      title: dealTitle,
      contact_id: contact.id,
      stage: "qualification",
      amount: dealAmount ? parseFloat(dealAmount) : null,
      assigned_to: dealAssigned || null,
    })
    setCreatingDeal(false)

    if (result.success) {
      toast("success", "Deal creado")
      setShowDealDialog(false)
      setDealTitle(`Venta a ${contact.first_name} ${contact.last_name}`)
      setDealAmount("")
      setDealAssigned("")
      router.refresh()
    } else {
      toast("error", result.error || "No se pudo crear el deal")
    }
  }

  // -------------------------------------------------------------------
  // Note
  // -------------------------------------------------------------------
  const handleSaveNote = async () => {
    if (!noteText.trim()) return

    setSavingNote(true)
    const result = await createNote(contact.id, noteText.trim())
    setSavingNote(false)

    if (result.success) {
      toast("success", "Nota agregada")
      setNoteText("")
      router.refresh()
    } else {
      toast("error", result.error || "No se pudo guardar la nota")
    }
  }

  // -------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------
  const handleToggleTag = (tagId: string) => {
    const isTagged = currentTags.some((t) => t.id === tagId)
    startTransition(async () => {
      const result = isTagged
        ? await untagContact(contact.id, tagId)
        : await tagContact(contact.id, tagId)

      if (result.success) {
        toast("success", isTagged ? "Tag removido" : "Tag agregado")
        router.refresh()
      } else {
        toast("error", result.error || "Error con el tag")
      }
    })
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const result = await createTag(newTagName.trim(), newTagColor)
    if (result.success && result.tag) {
      toast("success", "Tag creado")
      // Auto-assign to this contact
      await tagContact(contact.id, result.tag.id)
      setNewTagName("")
      setShowTagDialog(false)
      router.refresh()
    } else {
      toast("error", result.error || "No se pudo crear el tag")
    }
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

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <TagIcon className="h-3 w-3" />
              Etiquetas
            </label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const active = currentTags.some((t) => t.id === tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      active
                        ? "bg-veloce-50 border-veloce-300 text-veloce-700"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {active ? "✓ " : "+ "}
                    {tag.name}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setShowTagDialog(true)}
                className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
              >
                + Nuevo
              </button>
            </div>
          </div>

          {/* Quick note */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              Nota rápida
            </label>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: Cliente prefiere llamada en la tarde..."
              rows={2}
              disabled={savingNote}
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleSaveNote}
              disabled={!noteText.trim() || savingNote}
            >
              {savingNote ? "Guardando..." : "Guardar nota"}
            </Button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTaskForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Tarea
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDealDialog(true)}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Deal
            </Button>
          </div>
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

      {/* Deal dialog */}
      <Dialog
        open={showDealDialog}
        onClose={() => setShowDealDialog(false)}
        title="Crear deal para este cliente"
      >
        <div className="space-y-4">
          <Input
            label="Título del deal"
            value={dealTitle}
            onChange={(e) => setDealTitle(e.target.value)}
            placeholder="Ej: Venta Orbea Orca M30"
          />
          <Input
            label="Monto estimado (COP)"
            type="number"
            value={dealAmount}
            onChange={(e) => setDealAmount(e.target.value)}
            placeholder="Ej: 8500000"
          />
          <Select
            label="Asignar a"
            value={dealAssigned}
            onChange={(e) => setDealAssigned(e.target.value)}
            options={[
              { value: "", label: "Sin asignar" },
              ...teamMembers.map((m) => ({ value: m.id, label: m.full_name })),
            ]}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowDealDialog(false)}
              disabled={creatingDeal}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateDeal} disabled={creatingDeal}>
              {creatingDeal ? "Creando..." : "Crear deal"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* New tag dialog */}
      <Dialog
        open={showTagDialog}
        onClose={() => setShowTagDialog(false)}
        title="Nueva etiqueta"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ej: VIP, Taller, Ruta, Montaña..."
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="flex gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    newTagColor === c ? "border-gray-900" : "border-gray-200"
                  }`}
                  style={{
                    backgroundColor: {
                      gray: "#9ca3af",
                      blue: "#3b82f6",
                      green: "#10b981",
                      yellow: "#f59e0b",
                      red: "#ef4444",
                      purple: "#8b5cf6",
                      pink: "#ec4899",
                    }[c],
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowTagDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
              Crear y asignar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
