export type UserRole = "admin" | "manager" | "sales_rep"

export type ContactSource =
  | "website_form"
  | "facebook_lead_ads"
  | "instagram"
  | "whatsapp"
  | "walk_in"
  | "referral"
  | "manual"
  | "cycling_app"

export type ContactStatus = "active" | "inactive" | "do_not_contact" | "merged"

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"

export type DealStage =
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost"

export type Priority = "low" | "medium" | "high" | "urgent"

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"

export type InteractionType =
  | "call"
  | "whatsapp_message"
  | "facebook_message"
  | "instagram_message"
  | "email"
  | "visit_store"
  | "website_form"
  | "note"
  | "meeting"

export type InteractionDirection = "inbound" | "outbound" | "internal"

export type ProductCategory =
  | "road_bike"
  | "mtb"
  | "gravel"
  | "urban"
  | "accessories"
  | "components"
  | "clothing"
  | "indoor_cycling"
  | "service"

export type CyclingExperience = "beginner" | "intermediate" | "advanced" | "pro"

export interface TeamMember {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  whatsapp_phone: string | null
  facebook_id: string | null
  instagram_id: string | null
  document_id: string | null
  date_of_birth: string | null
  gender: string | null
  address: string | null
  city: string
  neighborhood: string | null
  cycling_experience: CyclingExperience | null
  bike_type: string | null
  interests: string[]
  source: ContactSource
  source_detail: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  assigned_to: string | null
  assigned_member?: TeamMember
  cycling_app_profile_id: string | null
  status: ContactStatus
  avatar_url: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
  _lead_count?: number
  _deal_count?: number
}

export interface Lead {
  id: string
  contact_id: string
  contact?: Contact
  title: string
  status: LeadStatus
  priority: Priority
  source: ContactSource | null
  source_detail: string | null
  assigned_to: string | null
  assigned_member?: TeamMember
  estimated_value: number | null
  position: number
  score: number
  last_contacted_at: string | null
  expected_close_date: string | null
  closed_at: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  contact_id: string
  contact?: Contact
  lead_id: string | null
  title: string
  stage: DealStage
  amount: number | null
  currency: string
  probability: number
  assigned_to: string | null
  assigned_member?: TeamMember
  expected_close_date: string | null
  closed_at: string | null
  lost_reason: string | null
  position: number
  created_at: string
  updated_at: string
  products?: DealProduct[]
}

export interface Product {
  id: string
  name: string
  brand: string | null
  category: ProductCategory
  sku: string | null
  price: number
  cost: number | null
  currency: string
  description: string | null
  image_url: string | null
  in_stock: boolean
  stock_quantity: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DealProduct {
  id: string
  deal_id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  discount_percent: number
  total: number
}

export interface Interaction {
  id: string
  contact_id: string
  lead_id: string | null
  deal_id: string | null
  type: InteractionType
  direction: InteractionDirection
  subject: string | null
  body: string | null
  channel_message_id: string | null
  channel_metadata: Record<string, unknown> | null
  team_member_id: string | null
  team_member?: TeamMember
  occurred_at: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  contact_id: string | null
  contact?: Contact
  lead_id: string | null
  deal_id: string | null
  assigned_to: string
  assigned_member?: TeamMember
  created_by: string
  status: TaskStatus
  priority: Priority
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Note {
  id: string
  contact_id: string | null
  lead_id: string | null
  deal_id: string | null
  body: string
  is_pinned: boolean
  created_by: string
  creator?: TeamMember
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  type: "whatsapp" | "facebook" | "instagram" | "website_form" | "walk_in"
  name: string
  is_active: boolean
  config: Record<string, unknown>
  webhook_secret: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  entity_type: "contact" | "lead" | "deal" | "task"
  entity_id: string
  action: string
  changes: Record<string, unknown> | null
  performed_by: string
  performer?: TeamMember
  created_at: string
}
