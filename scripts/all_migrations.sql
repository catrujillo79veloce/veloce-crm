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

-- =============================================
-- RLS Helper Functions
-- =============================================

CREATE OR REPLACE FUNCTION is_crm_team_member()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_team_members
    WHERE auth_user_id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_crm_team_member_id()
RETURNS UUID AS $$
  SELECT id FROM crm_team_members
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_crm_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_team_members
    WHERE auth_user_id = auth.uid() AND is_active = true AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE crm_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Team Members policies
-- =============================================
CREATE POLICY "Team members can view all members"
  ON crm_team_members FOR SELECT
  USING (is_crm_team_member());

CREATE POLICY "Admins can insert members"
  ON crm_team_members FOR INSERT
  WITH CHECK (is_crm_admin());

CREATE POLICY "Admins can update members"
  ON crm_team_members FOR UPDATE
  USING (is_crm_admin());

-- =============================================
-- Standard CRUD policies (for most tables)
-- =============================================

-- Contacts
CREATE POLICY "Team can view contacts" ON crm_contacts FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create contacts" ON crm_contacts FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update contacts" ON crm_contacts FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Admins can delete contacts" ON crm_contacts FOR DELETE USING (is_crm_admin());

-- Leads
CREATE POLICY "Team can view leads" ON crm_leads FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create leads" ON crm_leads FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update leads" ON crm_leads FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Admins can delete leads" ON crm_leads FOR DELETE USING (is_crm_admin());

-- Deals
CREATE POLICY "Team can view deals" ON crm_deals FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create deals" ON crm_deals FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update deals" ON crm_deals FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Admins can delete deals" ON crm_deals FOR DELETE USING (is_crm_admin());

-- Products
CREATE POLICY "Team can view products" ON crm_products FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create products" ON crm_products FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update products" ON crm_products FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Admins can delete products" ON crm_products FOR DELETE USING (is_crm_admin());

-- Deal Products
CREATE POLICY "Team can view deal products" ON crm_deal_products FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create deal products" ON crm_deal_products FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update deal products" ON crm_deal_products FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Team can delete deal products" ON crm_deal_products FOR DELETE USING (is_crm_team_member());

-- Interactions
CREATE POLICY "Team can view interactions" ON crm_interactions FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create interactions" ON crm_interactions FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update interactions" ON crm_interactions FOR UPDATE USING (is_crm_team_member());

-- Tasks
CREATE POLICY "Team can view tasks" ON crm_tasks FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create tasks" ON crm_tasks FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update tasks" ON crm_tasks FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Team can delete tasks" ON crm_tasks FOR DELETE USING (is_crm_team_member());

-- Tags
CREATE POLICY "Team can view tags" ON crm_tags FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create tags" ON crm_tags FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Admins can delete tags" ON crm_tags FOR DELETE USING (is_crm_admin());

-- Contact Tags
CREATE POLICY "Team can view contact tags" ON crm_contact_tags FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create contact tags" ON crm_contact_tags FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can delete contact tags" ON crm_contact_tags FOR DELETE USING (is_crm_team_member());

-- Notes
CREATE POLICY "Team can view notes" ON crm_notes FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create notes" ON crm_notes FOR INSERT WITH CHECK (is_crm_team_member());
CREATE POLICY "Team can update notes" ON crm_notes FOR UPDATE USING (is_crm_team_member());
CREATE POLICY "Team can delete notes" ON crm_notes FOR DELETE USING (is_crm_team_member());

-- Channels (admin only for mutations)
CREATE POLICY "Team can view channels" ON crm_channels FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Admins can manage channels" ON crm_channels FOR ALL USING (is_crm_admin());

-- Activity Log
CREATE POLICY "Team can view activity" ON crm_activity_log FOR SELECT USING (is_crm_team_member());
CREATE POLICY "Team can create activity" ON crm_activity_log FOR INSERT WITH CHECK (is_crm_team_member());

-- =============================================
-- Auto-update timestamp trigger
-- =============================================
CREATE OR REPLACE FUNCTION crm_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_crm_team_members_updated
  BEFORE UPDATE ON crm_team_members
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_contacts_updated
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_leads_updated
  BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_deals_updated
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_products_updated
  BEFORE UPDATE ON crm_products
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_tasks_updated
  BEFORE UPDATE ON crm_tasks
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_notes_updated
  BEFORE UPDATE ON crm_notes
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

CREATE TRIGGER trg_crm_channels_updated
  BEFORE UPDATE ON crm_channels
  FOR EACH ROW EXECUTE FUNCTION crm_update_timestamp();

-- =============================================
-- Lead Score Calculator
-- =============================================
CREATE OR REPLACE FUNCTION crm_calculate_lead_score(p_lead_id UUID)
RETURNS INT AS $$
DECLARE
  v_score INT := 0;
  v_contact RECORD;
  v_interaction_count INT;
  v_last_interaction TIMESTAMPTZ;
BEGIN
  -- Get contact info
  SELECT c.* INTO v_contact
  FROM crm_contacts c
  JOIN crm_leads l ON l.contact_id = c.id
  WHERE l.id = p_lead_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Contact completeness
  IF v_contact.email IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_contact.phone IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_contact.cycling_experience IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_contact.cycling_app_profile_id IS NOT NULL THEN v_score := v_score + 15; END IF;

  -- Interaction volume (max 30 points)
  SELECT COUNT(*), MAX(occurred_at)
  INTO v_interaction_count, v_last_interaction
  FROM crm_interactions
  WHERE contact_id = v_contact.id;

  v_score := v_score + LEAST(v_interaction_count * 5, 30);

  -- Recency of last interaction
  IF v_last_interaction IS NOT NULL THEN
    IF v_last_interaction > now() - INTERVAL '7 days' THEN
      v_score := v_score + 20;
    ELSIF v_last_interaction > now() - INTERVAL '30 days' THEN
      v_score := v_score + 10;
    END IF;
  END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Dashboard KPI Functions
-- =============================================
CREATE OR REPLACE FUNCTION crm_get_dashboard_kpis()
RETURNS JSON AS $$
DECLARE
  v_new_leads INT;
  v_closed_deals INT;
  v_pipeline_value DECIMAL;
  v_pending_tasks INT;
BEGIN
  SELECT COUNT(*) INTO v_new_leads
  FROM crm_leads
  WHERE created_at >= date_trunc('week', now())
  AND status = 'new';

  SELECT COUNT(*) INTO v_closed_deals
  FROM crm_deals
  WHERE closed_at >= date_trunc('month', now())
  AND stage = 'closed_won';

  SELECT COALESCE(SUM(amount), 0) INTO v_pipeline_value
  FROM crm_deals
  WHERE stage NOT IN ('closed_won', 'closed_lost');

  SELECT COUNT(*) INTO v_pending_tasks
  FROM crm_tasks
  WHERE status IN ('pending', 'in_progress');

  RETURN json_build_object(
    'new_leads', v_new_leads,
    'closed_deals', v_closed_deals,
    'pipeline_value', v_pipeline_value,
    'pending_tasks', v_pending_tasks
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Seed Data
-- =============================================

-- Default channel configurations
INSERT INTO crm_channels (type, name, is_active, config) VALUES
  ('whatsapp', 'WhatsApp Business', false, '{"phone_number_id": "", "access_token": "", "app_secret": "", "verify_token": "veloce-crm-wa-verify-2026"}'),
  ('facebook', 'Facebook Lead Ads', false, '{"page_id": "", "page_access_token": "", "app_secret": "", "verify_token": "veloce-crm-fb-verify-2026"}'),
  ('instagram', 'Instagram DMs', false, '{"account_id": "", "access_token": "", "app_secret": "", "verify_token": "veloce-crm-ig-verify-2026"}'),
  ('website_form', 'Formulario Web', true, '{"allowed_origins": ["*"], "honeypot_field": "website_url"}'),
  ('walk_in', 'Tienda Física', true, '{}');

-- Default tags
INSERT INTO crm_tags (name, color) VALUES
  ('VIP', '#f59e0b'),
  ('Ciclismo Indoor', '#22c55e'),
  ('Bicicleta Ruta', '#3b82f6'),
  ('MTB', '#8b5cf6'),
  ('Gravel', '#f97316'),
  ('Principiante', '#06b6d4'),
  ('Competidor', '#ef4444'),
  ('Seguimiento', '#ec4899'),
  ('Referido', '#84cc16'),
  ('Corporativo', '#64748b');

