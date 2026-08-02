-- Brunela Dance Trainer
-- 2026-06-16: Fix missing audio_tracks column, add Bunny Stream fields,
-- and rebuild the subscription catalog to support monthly + yearly pricing.
-- Target: Supabase Postgres
--
-- Context:
--  * The admin video form (app/admin/videos/page.tsx + src/features/admin/actions.ts)
--    reads and writes videos.audio_tracks, but that column never existed in any
--    migration -> every video save was failing. This adds it.
--  * Video provider is now Bunny Stream (HLS with multiple audio tracks).
--    We keep the generic stream_* columns for backwards compatibility and add
--    Bunny-specific identifiers.
--  * Pricing now supports monthly + yearly (with trial) per tier.

begin;

-- -----------------------------------------------------------------------------
-- 1. videos: add the missing audio_tracks column (THE BUG FIX)
-- -----------------------------------------------------------------------------
-- Shape: [{ "locale": "es", "label": "Espanol", "track_id": "<bunny audio track id>" }]
alter table public.videos
  add column if not exists audio_tracks jsonb not null default '[]'::jsonb;

alter table public.videos
  drop constraint if exists videos_audio_tracks_is_array;

alter table public.videos
  add constraint videos_audio_tracks_is_array
  check (jsonb_typeof(audio_tracks) = 'array');

comment on column public.videos.audio_tracks is
  'Per-language audio tracks for multi-audio playback: [{locale,label,track_id}]. track_id is the Bunny audio track id.';

-- -----------------------------------------------------------------------------
-- 2. videos: Bunny Stream identifiers
-- -----------------------------------------------------------------------------
-- bunny_library_id  -> Bunny Stream "Video Library" id (numeric, stored as text)
-- bunny_video_id    -> Bunny Stream per-video GUID
-- The existing stream_provider / stream_playback_id / stream_asset_id stay so
-- nothing that already reads them breaks; for new videos stream_provider='bunny'.
alter table public.videos
  add column if not exists bunny_library_id text;

alter table public.videos
  add column if not exists bunny_video_id text;

comment on column public.videos.bunny_library_id is 'Bunny Stream video library id (text).';
comment on column public.videos.bunny_video_id is 'Bunny Stream per-video GUID used to build the HLS playback URL.';

-- New videos default to the Bunny provider going forward.
alter table public.videos
  alter column stream_provider set default 'bunny';

-- -----------------------------------------------------------------------------
-- 3. Rebuild subscriptions.catalog to support monthly + yearly per tier
-- -----------------------------------------------------------------------------
-- WARNING -- DO NOT RE-RUN THIS SECTION ON A LIVE DATABASE.
--   The amounts below are SUPERSEDED by 20260730_pricing_update.sql
--   (16/154, 31/299, 59/559). They are kept as the historical seed.
--   The `on conflict do update` rebuilds the whole catalog object, so re-running
--   it would both restore the old prices AND null out the Stripe price ids.
--   To change prices or ids, write a patch migration that edits only the keys
--   it needs -- see 20260730_pricing_update.sql for the pattern.
-- price_monthly_id / price_yearly_id are Stripe Price IDs the admin fills in.
-- amount_* are display-only EUR amounts so the UI has a single source of truth.
insert into public.site_settings (setting_key, category, value, description, is_public)
values
  (
    'subscriptions.catalog',
    'subscriptions',
    jsonb_build_object(
      'currency', 'eur',
      'trial_days', 7,
      'tiers', jsonb_build_array(
        jsonb_build_object(
          'tier', 'corps_de_ballet',
          'display_order', 1,
          'amount_monthly', 20,
          'amount_yearly', 192,
          'stripe_price_id_monthly', null,
          'stripe_price_id_yearly', null
        ),
        jsonb_build_object(
          'tier', 'solista',
          'display_order', 2,
          'amount_monthly', 39,
          'amount_yearly', 374.4,
          'stripe_price_id_monthly', null,
          'stripe_price_id_yearly', null
        ),
        jsonb_build_object(
          'tier', 'principal',
          'display_order', 3,
          'amount_monthly', 69,
          'amount_yearly', 662.4,
          'stripe_price_id_monthly', null,
          'stripe_price_id_yearly', null
        )
      )
    ),
    'Stripe subscription mapping (monthly + yearly) and trial configuration. EUR.',
    false
  )
on conflict (setting_key) do update
set category = excluded.category,
    value = excluded.value,
    description = excluded.description,
    is_public = excluded.is_public,
    updated_at = timezone('utc', now());

commit;
