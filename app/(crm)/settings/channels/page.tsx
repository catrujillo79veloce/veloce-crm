import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Channel } from "@/lib/types"
import ChannelsConfig from "./ChannelsConfig"

async function getChannels(): Promise<Channel[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("crm_channels")
    .select("*")
    .order("type")

  if (error) {
    console.error("Error fetching channels:", error)
    return []
  }

  return (data as Channel[]) || []
}

export default async function ChannelsSettingsPage() {
  const channels = await getChannels()
  return <ChannelsConfig initialChannels={channels} />
}
