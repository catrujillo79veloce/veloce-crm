-- =============================================
-- Veloce CRM - Initial Schema
-- =============================================

-- Enums
CREATE TYPE crm_user_role AS ENUM ('admin', 'manager', 'sales_rep');
CREATE TYPE crm_contact_source AS ENUM ('website_form', 'facebook_lead_ads', 'instagram', 'whatsapp', 'walk_in', 'referral', 'manual', 'cycling_app');
CREATE TYPE crm_contact_status AS ENUM ('active', 'inactive', 'do_not_contact', 'merged');
CREATE TYPE crm_lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
CREATE TYPE crm_deal_stage AS ENUM ('qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE crm_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE crm_task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE crm_interaction_type AS ENUM ('call', 'whatsapp_message', 'facebook_message', 'instagram_message', 'email', 'visit_store', 'website_form', 'note', 'meeting');
CREATE TYPE crm_interaction_direction AS ENUM ('inbound', 'outbound', 'internal');
CREATE TYPE crm_product_category AS ENUM ('road_bike', 'mtb', 'gravel', 'urban', 'accessories', 'components', 'clothing', 'indoor_cycling', 'service');
CREATE TYPE crm_cycling_experience AS ENUM ('beginner', 'intermediate', 'advanced', 'pro');

-- =============================================
-- Team Members
-- =============================================
CREATE TABLE crm_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role crm_user_role NOT NULL DEFAULT 'sales_rep',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Contacts
-- =============================================
CREATE TABLE crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  whatsapp_phone TEXT,
  facebook_id TEXT,
  instagram_id TEXT,
  document_id TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Medellín',
  neighborhood TEXT,
  cycling_experience crm_cycling_experience,
  bike_type TEXT,
  interests TEXT[] DEFAULT '{}',
  source crm_contact_source NOT NULL DEFAULT 'manual',
  source_detail TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  assigned_to UUID REFERENCES crm_team_members(id) ON DELETE SET NULL,
  cycling_app_profile_id UUID,
  status crm_contact_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX idx_crm_contacts_whatsapp ON crm_contacts(whatsapp_phone);
CREATE INDEX idx_crm_contacts_source ON crm_contacts(source);
CREATE INDEX idx_crm_contacts_assigned ON crm_contacts(assigned_to);
CREATE INDEX idx_crm_contacts_status ON crm_contacts(status);

-- =============================================
-- Leads
-- =============================================
CREATE TABLE crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status crm_lead_status NOT NULL DEFAULT 'new',
  priority crm_priority NOT NULL DEFAULT 'medium',
  source crm_contact_source,
  source_detail TEXT,
  assigned_to UUID REFERENCES crm_team_members(id) ON DELETE SET NULL,
  estimated_value DECIMAL(12,2),
  position INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  last_contacted_at TIMESTAMPTZ,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_leads_contact ON crm_leads(contact_id);
CREATE INDEX idx_crm_leads_status ON crm_leads(status);
CREATE INDEX idx_crm_leads_assigned ON crm_leads(assigned_to);

-- =============================================
-- Deals
-- =============================================
CREATE TABLE crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage crm_deal_stage NOT NULL DEFAULT 'qualification',
  amount DECIMAL(12,2),
  currency TEXT NOT NULL DEFAULT 'COP',
  probability INT NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  assigned_to UUID REFERENCES crm_team_members(id) ON DELETE SET NULL,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX idx_crm_deals_stage ON crm_deals(stage);

-- =============================================
-- Products
-- =============================================
CREATE TABLE crm_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category crm_product_category NOT NULL,
  sku TEXT UNIQUE,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost DECIMAL(12,2),
  currency TEXT NOT NULL DEFAULT 'COP',
  description TEXT,
  image_url TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Deal Products (junction)
-- =============================================
CREATE TABLE crm_deal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES crm_products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_percent / 100)) STORED
);

-- =============================================
-- Interactions
-- =============================================
CREATE TABLE crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  type crm_interaction_type NOT NULL,
  direction crm_interaction_direction NOT NULL DEFAULT 'internal',
  subject TEXT,
  body TEXT,
  channel_message_id TEXT,
  channel_metadata JSONB,
  team_member_id UUID REFERENCES crm_team_members(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_interactions_contact ON crm_interactions(contact_id);
CREATE INDEX idx_crm_interactions_type ON crm_interactions(type);
CREATE INDEX idx_crm_interactions_occurred ON crm_interactions(occurred_at DESC);
CREATE UNIQUE INDEX idx_crm_interactions_channel_msg ON crm_interactions(channel_message_id) WHERE channel_message_id IS NOT NULL;

-- =============================================
-- Tasks
-- =============================================
CREATE TABLE crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES crm_team_members(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES crm_team_members(id) ON DELETE CASCADE,
  status crm_task_status NOT NULL DEFAULT 'pending',
  priority crm_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_tasks_assigned ON crm_tasks(assigned_to);
CREATE INDEX idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX idx_crm_tasks_due ON crm_tasks(due_date);

-- =============================================
-- Tags
-- =============================================
CREATE TABLE crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crm_contact_tags (
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- =============================================
-- Notes
-- =============================================
CREATE TABLE crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES crm_team_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Channels (integration configs)
-- =============================================
CREATE TABLE crm_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT UNIQUE NOT NULL CHECK (type IN ('whatsapp', 'facebook', 'instagram', 'website_form', 'walk_in')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  webhook_secret TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Activity Log
-- =============================================
CREATE TABLE crm_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'lead', 'deal', 'task')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  changes JSONB,
  performed_by UUID REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_activity_entity ON crm_activity_log(entity_type, entity_id);
CREATE INDEX idx_crm_activity_created ON crm_activity_log(created_at DESC);
