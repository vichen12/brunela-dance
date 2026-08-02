-- Brunela Dance Trainer
-- 2026-07-30: Ordering guard for Stripe webhooks.
-- Target: Supabase Postgres. Run in the SQL Editor.
--
-- THE PROBLEM
--   app/api/stripe/webhooks/route.ts upserts the subscription unconditionally.
--   Stripe does NOT guarantee delivery order, and it retries failed deliveries
--   with backoff. So this sequence is possible today:
--
--     1. Member cancels          -> customer.subscription.deleted   (delayed)
--     2. Earlier plan change     -> customer.subscription.updated   (arrives 2nd)
--
--   The second event overwrites status 'canceled' with 'active'. The trigger
--   sync_profile_membership_from_subscriptions() then RESTORES the member's
--   membership_tier, and someone who cancelled keeps full access to the studio
--   indefinitely. Nothing in the app would ever correct it.
--
-- THE FIX
--   Record which Stripe event last wrote each row and ignore anything older.
--   Stripe stamps every event with `created` (unix seconds), which is assigned
--   by Stripe itself, so it orders events reliably even when delivery does not.
--
-- WHAT THIS MIGRATION DOES
--   Adds the column only. The comparison lives in the webhook route, which is
--   updated in the same piece of work.

begin;

alter table public.subscriptions
  add column if not exists last_event_at timestamptz;

comment on column public.subscriptions.last_event_at is
  'Stripe event.created of the last webhook applied to this row. The webhook drops any event older than this, so an out-of-order delivery cannot revive a cancelled subscription.';

-- Backfill: rows written before this guard existed have no marker. Seeding them
-- with their last update keeps history sane without blocking future events.
update public.subscriptions
set last_event_at = coalesce(updated_at, created_at)
where last_event_at is null;

commit;

-- =============================================================================
-- POST-RUN VERIFICATION
-- =============================================================================
--
-- a) Column present:
--
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'subscriptions'
--   and column_name = 'last_event_at';
--
-- b) No row left without a marker (should return 0):
--
-- select count(*) from public.subscriptions where last_event_at is null;
--
-- c) Policy count should be unchanged at 43 -- this migration adds no policy:
--
-- select count(*) from pg_policies where schemaname = 'public';
