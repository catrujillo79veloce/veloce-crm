"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPush } from "@/lib/push/send"
import { revalidatePath } from "next/cache"
import type { Interaction } from "@/lib/types"

// ---------------------------------------------------------------------------
// Conversation collaboration:
//   - assignConversation(contactId, teamMemberId): owner of all chats with X
//   - addInternalNote(contactId, body, mentions[]): inline team note inside
//     the conversation thread, never sent to the customer; mentions get a push.
// ---------------------------------------------------------------------------

export async function assignConversation(
  contactId: string,
  teamMemberId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_contacts")
    .update({ assigned_to: teamMemberId, updated_at: new Date().toISOString() })
    .eq("id", contactId)

  if (error) {
    console.error("assignConversation error:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/inbox")
  return { success: true }
}

export async function addInternalNote(
  contactId: string,
  body: string,
  mentionedMemberIds: string[] = []
): Promise<{ success: boolean; error?: string; interaction?: Interaction }> {
  const trimmed = body.trim()
  if (!trimmed) return { success: false, error: "La nota está vacía" }

  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "No autorizado" }

  const { data: author } = await supabase
    .from("crm_team_members")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .single()
  if (!author) return { success: false, error: "Miembro no encontrado" }

  const dedupedMentions = Array.from(new Set(mentionedMemberIds)).filter(
    (id) => id && id !== author.id
  )

  const { data, error } = await supabase
    .from("crm_interactions")
    .insert({
      contact_id: contactId,
      type: "note",
      direction: "internal",
      body: trimmed,
      team_member_id: author.id,
      channel_metadata:
        dedupedMentions.length > 0 ? { mentions: dedupedMentions } : null,
      occurred_at: new Date().toISOString(),
    })
    .select(
      `
      *,
      team_member:crm_team_members!crm_interactions_team_member_id_fkey(id, full_name, avatar_url)
    `
    )
    .single()

  if (error) {
    console.error("addInternalNote error:", error)
    return { success: false, error: error.message }
  }

  if (dedupedMentions.length > 0) {
    await notifyMentions({
      contactId,
      mentionedMemberIds: dedupedMentions,
      authorName: author.full_name,
      preview: trimmed.slice(0, 120),
    })
  }

  revalidatePath("/inbox")

  const row = data as unknown as Interaction & {
    team_member?: { id: string; full_name: string; avatar_url: string | null }
  }
  return { success: true, interaction: row }
}

// ---------------------------------------------------------------------------
// Mention push — best-effort; never fails the note write
// ---------------------------------------------------------------------------

async function notifyMentions({
  contactId,
  mentionedMemberIds,
  authorName,
  preview,
}: {
  contactId: string
  mentionedMemberIds: string[]
  authorName: string
  preview: string
}) {
  try {
    const admin = createAdminClient()

    const [{ data: members }, { data: contact }] = await Promise.all([
      admin
        .from("crm_team_members")
        .select("id, auth_user_id, full_name")
        .in("id", mentionedMemberIds),
      admin
        .from("crm_contacts")
        .select("first_name, last_name")
        .eq("id", contactId)
        .single(),
    ])

    if (!members || members.length === 0) return

    const contactName = contact
      ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
      : "un contacto"

    await Promise.all(
      members
        .filter((m) => m.auth_user_id)
        .map((m) =>
          sendPush(
            {
              title: `${authorName} te mencionó`,
              body: `En la conversación con ${contactName}: ${preview}`,
              url: `/inbox?contact=${contactId}`,
              tag: `mention-${contactId}`,
            },
            m.auth_user_id as string
          )
        )
    )
  } catch (e) {
    // Notifications are best-effort
    console.error("notifyMentions error:", e)
  }
}
