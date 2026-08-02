-- Brunela Dance Trainer
-- 2026-07-29: Multi-language audio via server-side muxing.
-- Target: Supabase Postgres. Run in the SQL Editor.
--
-- BACKGROUND
--   Bunny Stream has no API to attach audio tracks to an existing video
--   (verified 2026-07-28: /audiotracks, /audiotrack and /audio all 404).
--   It DOES preserve multiple audio tracks that are already muxed into the
--   uploaded file, exposing them as HLS renditions with correct LANGUAGE tags
--   (verified 2026-07-28 across 6 encodes).
--
--   So: the admin uploads one video plus one mp3 per language, a worker muxes
--   them into a single multi-track file with ffmpeg (-c:v copy, no re-encode),
--   uploads that to Bunny as a NEW video, and swaps the catalog row over once
--   the new encode is verified. The old video keeps serving until the swap, so
--   a class is never unavailable while languages are being added.
--
-- WHAT THIS ADDS
--   1. storage bucket "class-audio" -- private, holds the mp3 inputs only until
--      the mux succeeds, then they are deleted.
--   2. table video_mux_jobs -- the queue the worker polls. No public endpoint on
--      the worker: it only makes outbound connections.
--
-- WHAT THIS DOES NOT CHANGE
--   videos.audio_tracks keeps its type (jsonb array) and its check constraint.
--   Only the shape of the objects inside changes, and the column is empty in
--   every row today because the old flow never managed to write it.
--   New shape: [{"locale":"en","label":"English","muxed_at":"2026-..."}]

begin;

-- =============================================================================
-- 1. Audio input bucket
-- =============================================================================
-- 52428800 = 50 MiB, the FIXED per-file ceiling of the Supabase Free plan
-- (not raisable from here). At 96 kbps that is ~69 minutes of audio; if a class
-- ever runs longer, drop the export to 64 kbps mono for ~104 minutes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'class-audio',
  'class-audio',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only admins touch this bucket. Members never read from it at all: the audio
-- ends up inside the Bunny video, so there is nothing here for them to fetch.
-- The worker uses the service role and bypasses RLS.
drop policy if exists "class_audio_admin_all" on storage.objects;
create policy "class_audio_admin_all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'class-audio' and (select public.is_admin()))
  with check (bucket_id = 'class-audio' and (select public.is_admin()));

-- =============================================================================
-- 2. Mux job queue
-- =============================================================================
create table if not exists public.video_mux_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,

  -- Bunny video the worker reads the original from.
  source_bunny_video_id text not null,
  -- Bunny video the worker produced. Null until the mux succeeds.
  result_bunny_video_id text,

  -- [{"locale":"en","label":"English","path":"<video_id>/en.mp3"}]
  audio_inputs jsonb not null default '[]'::jsonb,

  -- Locales the finished playlist MUST expose before we swap. Written at
  -- enqueue time so verification cannot silently drift from the request.
  expected_locales text[] not null default '{}',

  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,

  claimed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.video_mux_jobs
  drop constraint if exists video_mux_jobs_audio_inputs_is_array;
alter table public.video_mux_jobs
  add constraint video_mux_jobs_audio_inputs_is_array
  check (jsonb_typeof(audio_inputs) = 'array');

comment on table public.video_mux_jobs is
  'Queue for muxing per-language audio into a class video. Polled by an external ffmpeg worker.';
comment on column public.video_mux_jobs.expected_locales is
  'Locales that must be present in the encoded HLS playlist before the swap. If any is missing the job fails instead of swapping.';

alter table public.video_mux_jobs enable row level security;

drop policy if exists "mux_jobs_admin_all" on public.video_mux_jobs;
create policy "mux_jobs_admin_all"
  on public.video_mux_jobs
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Partial index: the worker's only hot query is "oldest pending job".
create index if not exists idx_mux_jobs_pending
  on public.video_mux_jobs (created_at)
  where status = 'pending';

-- The admin list shows the latest job per video.
create index if not exists idx_mux_jobs_video_created
  on public.video_mux_jobs (video_id, created_at desc);

drop trigger if exists trg_video_mux_jobs_updated_at on public.video_mux_jobs;
create trigger trg_video_mux_jobs_updated_at
  before update on public.video_mux_jobs
  for each row execute procedure public.set_current_timestamp_updated_at();

commit;

-- =============================================================================
-- POST-RUN VERIFICATION
-- =============================================================================
--
-- a) Bucket present, private, 50 MiB:
--
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'class-audio';
--
-- b) Queue table + its two indexes:
--
-- select tablename, indexname from pg_indexes
-- where schemaname = 'public' and tablename = 'video_mux_jobs';
--
-- c) RLS on and one policy on each new object:
--
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'video_mux_jobs';
--
-- d) Policy count should be 42 + 1 = 43 (42 was the number after the orphan
--    cleanup in 20260728b):
--
-- select count(*) from pg_policies where schemaname = 'public';
