import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Routes that must be reachable without a CRM session.
//
// Everything else under /api/ is CRM-internal and now requires an ACTIVE TEAM
// MEMBER, not merely a logged-in Supabase user. Signup is open and the same
// Supabase project backs the public athlete app, so "has an account" is not a
// meaningful authorization signal — it previously let any registered user hit
// 22 internal endpoints (push subscriptions, media upload, contact search…).
// ---------------------------------------------------------------------------
const PUBLIC_API_PREFIXES = [
  "/api/webhooks/", // Meta — authenticated by x-hub-signature-256
  "/api/cron/", // Vercel Cron — authenticated by CRON_SECRET bearer
]

const PUBLIC_API_PATHS = [
  "/api/lead-form/submit", // public lead capture form
  "/api/health", // authenticates itself (CRON_SECRET bearer or team session)
]

// PWA assets + public pages that never require a session.
const PUBLIC_ASSET_PATHS = ["/sw.js", "/manifest.webmanifest"]

const PUBLIC_PAGES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
]

function isPublicApi(path: string): boolean {
  return (
    PUBLIC_API_PATHS.includes(path) ||
    PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))
  )
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public, unauthenticated surfaces: skip the session round-trip entirely.
  // Meta webhooks in particular should not pay for an auth lookup they never use.
  if (
    isPublicApi(path) ||
    PUBLIC_ASSET_PATHS.includes(path) ||
    path.startsWith("/icons/") ||
    path === "/lead-form" ||
    path === "/veloce" ||
    path.startsWith("/veloce/")
  ) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isApi = path.startsWith("/api/")

  // Public pages
  if (!isApi && PUBLIC_PAGES.includes(path)) {
    if (user && (path === "/login" || path === "/signup")) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protected — require auth
  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Verify the user is an active CRM team member
  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id, role, is_active")
    .eq("auth_user_id", user.id)
    .single()

  if (!member || !member.is_active) {
    if (isApi) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
