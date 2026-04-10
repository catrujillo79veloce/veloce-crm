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
