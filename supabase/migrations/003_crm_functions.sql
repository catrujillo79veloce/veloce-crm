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
