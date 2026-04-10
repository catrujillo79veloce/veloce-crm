"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { TeamMember } from "@/lib/types"

interface UseCurrentUserReturn {
  user: User | null
  teamMember: TeamMember | null
  loading: boolean
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          setUser(null)
          setTeamMember(null)
          return
        }

        setUser(session.user)

        const { data: member } = await supabase
          .from("crm_team_members")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .single()

        setTeamMember((member as TeamMember) ?? null)
      } catch {
        setUser(null)
        setTeamMember(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setTeamMember(null)
        setLoading(false)
      } else {
        // Re-fetch team member on auth change
        supabase
          .from("crm_team_members")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .single()
          .then(({ data }) => {
            setTeamMember((data as TeamMember) ?? null)
            setLoading(false)
          })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, teamMember, loading }
}
