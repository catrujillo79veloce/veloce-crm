-- ---------------------------------------------------------------------------
-- 005 — Inbox read state, push debounce clock and inbox indexes
--
-- Context: the unread badge used to mean "nobody has replied", but the AI bot
-- replies to almost everything, so the counter was permanently zero and new
-- customer messages looked handled when nobody had actually seen them.
-- ---------------------------------------------------------------------------

-- When a human last opened this contact's conversation in the inbox.
alter table public.crm_contacts
  add column if not exists inbox_read_at timestamptz;

-- Separate debounce clock for push notifications. The WhatsApp admin ping is
-- debounced 15 min per contact; push is the primary alert and is silent by
-- design, so it needs its own much shorter window instead of riding along.
alter table public.crm_contacts
  add column if not exists last_push_notified_at timestamptz;

-- Inbox list query: newest messaging interactions first.
create index if not exists crm_interactions_type_occurred_idx
  on public.crm_interactions (type, occurred_at desc);

-- Per-conversation thread load + unread counting.
create index if not exists crm_interactions_contact_occurred_idx
  on public.crm_interactions (contact_id, occurred_at desc);
