-- Brunela Dance Trainer
-- 2026-07-30: Keep BOTH sets of Stripe price ids, test and live.
-- Target: Supabase Postgres. Run in the SQL Editor.
--
-- WHY
--   The catalog held a single set of price ids, so moving between test and
--   production took TWO actions: swap STRIPE_SECRET_KEY *and* run a SQL update.
--   Do only one and the app runs a live key against test price ids (every
--   checkout fails) or a test key against live ones. The failure is quiet and
--   it sits next to real money.
--
--   That is not hypothetical. On 2026-07-30 the six LIVE price ids were loaded
--   while everyone believed they were test ones; it was caught before any
--   charge only by querying the Stripe API and finding livemode=true on all six.
--
--   With both sets stored, the running mode is derived from the secret key
--   alone (src/lib/stripe/catalog.ts -> stripeMode). Going to production is
--   swapping ONE environment variable. There is no second step to forget.
--
-- SHAPE CHANGE
--   before:  { ..., "stripe_price_id_monthly": "...", "stripe_price_id_yearly": "..." }
--   after:   { ..., "prices": { "test": {"monthly": ..., "yearly": ...},
--                               "live": {"monthly": ..., "yearly": ...} } }
--
--   Amounts, tier and display_order are NOT touched: this migration only
--   rewrites the price ids, so re-running it can never revert a price change.
--   The legacy flat keys are dropped.
--
-- THE 12 IDS BELOW ARE THE REAL ONES, already created in the Stripe account:
--   test -> "Modo de prueba" (livemode=false)
--   live -> production, verified against the API on 2026-07-30
--           (16/154, 31/299, 59/559 EUR, month/year, all active)

begin;

update public.site_settings s
set value = jsonb_set(
      s.value,
      '{tiers}',
      -- Safety net: jsonb_agg over zero rows returns NULL, and jsonb_set with a
      -- NULL value would blank the whole setting. Keep the tiers if that happens.
      coalesce(
        (
          select jsonb_agg(
                   (t - 'stripe_price_id_monthly' - 'stripe_price_id_yearly')
                   || jsonb_build_object(
                        'prices',
                        case t ->> 'tier'
                          when 'corps_de_ballet' then jsonb_build_object(
                            'test', jsonb_build_object(
                              'monthly', 'price_1TyzgpEMUQC9adJ0mDdjqmtI',
                              'yearly',  'price_1Tyzh9EMUQC9adJ08vibFUqp'),
                            'live', jsonb_build_object(
                              'monthly', 'price_1TyyxEEMUQC9adJ0iKHVbInd',
                              'yearly',  'price_1TyyzEEMUQC9adJ0lw7sdjga')
                          )
                          when 'solista' then jsonb_build_object(
                            'test', jsonb_build_object(
                              'monthly', 'price_1TyzhsEMUQC9adJ0iJacu4Kc',
                              'yearly',  'price_1TyziLEMUQC9adJ0DaIHMwMd'),
                            'live', jsonb_build_object(
                              'monthly', 'price_1Tyz5cEMUQC9adJ0KIAmblHm',
                              'yearly',  'price_1Tyz5mEMUQC9adJ09J06wMxf')
                          )
                          when 'principal' then jsonb_build_object(
                            'test', jsonb_build_object(
                              'monthly', 'price_1TyziiEMUQC9adJ0sZ49ELtV',
                              'yearly',  'price_1Tyzj4EMUQC9adJ0U3GLlGj9'),
                            'live', jsonb_build_object(
                              'monthly', 'price_1Tyz4aEMUQC9adJ05do0CeIJ',
                              'yearly',  'price_1Tyz4jEMUQC9adJ0eGgiralE')
                          )
                          -- Unknown tier: leave whatever it already had.
                          else coalesce(t -> 'prices', 'null'::jsonb)
                        end
                      )
                   order by (t ->> 'display_order')::int
                 )
          from jsonb_array_elements(s.value -> 'tiers') t
        ),
        s.value -> 'tiers'
      )
    ),
    updated_at = timezone('utc', now())
where s.setting_key = 'subscriptions.catalog';

commit;

-- =============================================================================
-- POST-RUN VERIFICATION
-- =============================================================================
--
-- Three rows, the twelve ids in place, amounts untouched (16/154, 31/299,
-- 59/559) and quedo_formato_viejo = false everywhere.
--
-- select t->>'tier'                     as tier,
--        t->>'amount_monthly'           as mensual,
--        t->>'amount_yearly'            as anual,
--        t #>> '{prices,test,monthly}'  as test_mensual,
--        t #>> '{prices,test,yearly}'   as test_anual,
--        t #>> '{prices,live,monthly}'  as live_mensual,
--        t #>> '{prices,live,yearly}'   as live_anual,
--        (t ? 'stripe_price_id_monthly') as quedo_formato_viejo
-- from public.site_settings s,
--      jsonb_array_elements(s.value->'tiers') t
-- where s.setting_key = 'subscriptions.catalog'
-- order by (t->>'display_order')::int;
--
-- Sanity check -- no id should appear in both modes (that would mean a paste
-- mistake). Must return zero rows:
--
-- select t->>'tier'
-- from public.site_settings s, jsonb_array_elements(s.value->'tiers') t
-- where s.setting_key = 'subscriptions.catalog'
--   and (t #>> '{prices,test,monthly}' = t #>> '{prices,live,monthly}'
--     or t #>> '{prices,test,yearly}'  = t #>> '{prices,live,yearly}');
