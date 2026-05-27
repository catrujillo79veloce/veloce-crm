"use client"

import { useState } from "react"
import { GitMerge } from "lucide-react"
import { Button } from "@/components/ui"
import MergeContactDialog from "./MergeContactDialog"
import type { Contact } from "@/lib/types"

// ---------------------------------------------------------------------------
// Small client-side wrapper so the contact detail (server component) can
// still surface the merge action without becoming client-rendered.
// ---------------------------------------------------------------------------

export default function MergeContactButton({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <GitMerge className="h-4 w-4 text-amber-600" />
        Combinar
      </Button>
      <MergeContactDialog
        keeperContact={contact}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
