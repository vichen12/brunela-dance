-- Brunela Dance Trainer
-- 2026-07-30: Final pricing from Brunela.
-- Target: Supabase Postgres. Run in the SQL Editor.
--
--   Corps de Ballet   20 -> 16 EUR/month    192.00 -> 154 EUR/year
--   Solista           39 -> 31 EUR/month    374.40 -> 299 EUR/year
--   Principal         69 -> 59 EUR/month    662.40 -> 559 EUR/year
--
-- WHY THIS IS AN UPDATE AND NOT AN EDIT OF THE ORIGINAL SEED
--   20260616_video_bunny_audio_tracks_and_pricing.sql seeded the old amounts and
--   is already applied. Rewriting it would not change this database, and its
--   `on conflict do update` rebuilds the WHOLE catalog object -- re-running it
--   after the Stripe price ids are loaded would wipe them. So the seed stays as
--   history and the correction lives here.
--
-- WHY THIS PATCHES INSTEAD OF REBUILDING
--   Same reason, applied to this file: it edits only amount_monthly and
--   amount_yearly on each tier and leaves every other key untouched. Running it
--   again after the price ids are in place is harmless.
--
-- NOTE ON THE LANDING
--   The public landing does NOT read these values. Its numbers live in the
--   `plans` array in app/page.tsx and were changed in the same commit. The
--   "% less per month" badge is computed from them, not stored anywhere.

begin;

update public.site_settings s
set value = jsonb_set(
      s.value,
      '{tiers}',
      (
        select jsonb_agg(
                 case t->>'tier'
                   when 'corps_de_ballet'
                     then t || jsonb_build_object('amount_monthly', 16, 'amount_yearly', 154)
                   when 'solista'
                     then t || jsonb_build_object('amount_monthly', 31, 'amount_yearly', 299)
                   when 'principal'
                     then t || jsonb_build_object('amount_monthly', 59, 'amount_yearly', 559)
                   else t
                 end
                 order by (t->>'display_order')::int
               )
        from jsonb_array_elements(s.value -> 'tiers') t
      )
    ),
    updated_at = timezone('utc', now())
where s.setting_key = 'subscriptions.catalog';

commit;

-- =============================================================================
-- POST-RUN VERIFICATION
-- =============================================================================
--
-- Should return exactly three rows: 16/154, 31/299, 59/559, with the price id
-- columns still holding whatever they held before (null until Stripe is set up).
--
-- select t->>'tier'                     as tier,
--        t->>'amount_monthly'           as mensual,
--        t->>'amount_yearly'            as anual,
--        t->>'stripe_price_id_monthly'  as price_mensual,
--        t->>'stripe_price_id_yearly'   as price_anual
-- from public.site_settings s,
--      jsonb_array_elements(s.value->'tiers') t
-- where s.setting_key = 'subscriptions.catalog'
-- order by (t->>'display_order')::int;
