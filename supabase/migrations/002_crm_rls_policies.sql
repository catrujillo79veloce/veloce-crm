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
