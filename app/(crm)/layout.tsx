import { createServerSupabaseClient } from "@/lib/supabase/server"
import Sidebar from "@/components/layout/Sidebar"
import TopBar from "@/components/layout/TopBar"
import MobileNav from "@/components/layout/MobileNav"

async function getCurrentUser() {
  try {
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: teamMember } = await supabase
      .from("crm_team_members")
      .select("*")
      .eq("auth_user_id", user.id)
      .single()

    return teamMember
  } catch {
    return null
  }
}

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  const userName = user?.full_name || "Usuario"
  const userEmail = user?.email || ""
  const avatarUrl = user?.avatar_url || null

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - desktop only */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar userName={userName} avatarUrl={avatarUrl} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  )
}
