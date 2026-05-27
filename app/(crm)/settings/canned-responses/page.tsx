import { createServerSupabaseClient } from "@/lib/supabase/server"
import CannedResponsesManager from "./CannedResponsesManager"
import type { CannedResponse } from "@/lib/types"

export default async function CannedResponsesPage() {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("crm_canned_responses")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  return (
    <CannedResponsesManager initialItems={(data ?? []) as CannedResponse[]} />
  )
}
