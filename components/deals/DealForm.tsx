"use client"

import React, { useState, useTransition } from "react"
import { Dialog, Button, Input, Select } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { DEAL_STAGES } from "@/lib/constants"
import { createDeal, updateDeal } from "@/app/actions/deals"
import type { Deal, DealStage } from "@/lib/types"

interface DealFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  deal?: Deal | null
}

export function DealForm({ open, onClose, onSuccess, deal }: DealFormProps) {
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(deal?.title || "")
  const [contactId, setContactId] = useState(deal?.contact_id || "")
  const [stage, setStage] = useState<DealStage>(deal?.stage || "qualification")
  const [amount, setAmount] = useState(deal?.amount?.toString() || "")
  const [probability, setProbability] = useState(
    deal?.probability?.toString() || "0"
  )
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    deal?.expected_close_date || ""
  )

  const isEditing = !!deal

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast("error", locale === "es" ? "El titulo es requerido" : "Title is required")
      return
    }

    if (!contactId.trim()) {
      toast(
        "error",
        locale === "es"
          ? "El contacto es requerido"
          : "Contact is required"
      )
      return
    }

    startTransition(async () => {
      const formData = {
        title: title.trim(),
        contact_id: contactId,
        stage,
        amount: amount ? parseFloat(amount) : null,
        probability: parseInt(probability) || 0,
        expected_close_date: expectedCloseDate || null,
      }

      const result = isEditing
        ? await updateDeal(deal.id, formData)
        : await createDeal(formData)

      if (result.success) {
        toast(
          "success",
          isEditing
            ? locale === "es"
              ? "Venta actualizada"
              : "Deal updated"
            : locale === "es"
              ? "Venta creada"
              : "Deal created"
        )
        onSuccess()
      } else {
        toast("error", result.error || "Error")
      }
    })
  }

  const stageOptions = DEAL_STAGES.map((s) => ({
    value: s.value,
    label: s.label[locale],
  }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? t.deals.editDeal : t.deals.newDeal}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={locale === "es" ? "Titulo" : "Title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            locale === "es"
              ? "Ej: Bicicleta Ruta Specialized"
              : "E.g.: Specialized Road Bike"
          }
          required
        />

        <Input
          label={locale === "es" ? "ID del Contacto" : "Contact ID"}
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          placeholder={locale === "es" ? "UUID del contacto" : "Contact UUID"}
          required
        />

        <Select
          label={t.deals.stage}
          options={stageOptions}
          value={stage}
          onChange={(e) => setStage(e.target.value as DealStage)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`${t.deals.amount} (COP)`}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min="0"
          />

          <Input
            label={`${t.deals.probability} (%)`}
            type="number"
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            min="0"
            max="100"
          />
        </div>

        <Input
          label={
            locale === "es" ? "Fecha de cierre esperada" : "Expected close date"
          }
          type="date"
          value={expectedCloseDate}
          onChange={(e) => setExpectedCloseDate(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            {t.common.cancel}
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? t.common.save : t.common.create}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
