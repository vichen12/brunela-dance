-- Brunela Dance Trainer
-- Phase A: Core schema for profiles, videos, programs, user_progress and site_settings.
-- Target: Supabase Postgres

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_tier') then
    create type public.membership_tier as enum (
      'corps_de_ballet',
      'solista',
      'principal'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'technical_level') then
    create type public.technical_level as enum (
      'principiante',
      'intermedio',
      'avanzado',
      'profesional',
      'maestro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'training_goal') then
    create type public.training_goal as enum (
      'movilidad',
      'fuerza_centro',
      'flexibilidad',
      'recuperacion',
      'resistencia',
      'alineacion_postural',
      'rendimiento_escenico',
      'bienestar_general'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'video_status') then
    create type public.video_status as enum (
      'draft',
      'published',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'program_status') then
    create type public.program_status as enum (
      'draft',
      'published',
      'archived'
    );
  end if;
 end;
 $$;

-- -----------------------------------------------------------------------------
-- Utility functions
-- -----------------------------------------------------------------------------

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.membership_tier_rank(input_tier public.membership_tier)
returns integer
language sql
immutable
as $$
  select case input_tier
    when 'corps_de_ballet' then 1
    when 'solista' then 2
    when 'principal' then 3
  end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  birth_date date,
  country_code text,
  city text,
  injury_notes text,
  injury_flags text[] not null default '{}',
  technical_level public.technical_level not null default 'principiante',
  training_goals public.training_goal[] not null default array['bienestar_general']::public.training_goal[],
  membership_tier public.membership_tier not null default 'corps_de_ballet',
  preferred_locale text not null default 'es',
  onboarding_completed boolean not null default false,
  is_admin boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_preferred_locale_check check (char_length(preferred_locale) between 2 and 10)
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  status public.video_status not null default 'draft',
  membership_tier_required public.membership_tier not null default 'corps_de_ballet',
  duration_seconds integer not null check (duration_seconds > 0),
  recommended_min_level public.technical_level not null default 'principiante',
  recommended_max_level public.technical_level not null default 'maestro',
  equipment text[] not null default '{}',
  category_slugs text[] not null default '{}',
  injury_contraindications text[] not null default '{}',
  thumbnail_url text,
  stream_provider text not null default 'mux',
  stream_asset_id text,
  stream_playback_id text,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint videos_title_i18n_is_object check (jsonb_typeof(title_i18n) = 'object'),
  constraint videos_description_i18n_is_object check (jsonb_typeof(description_i18n) = 'object')
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  status public.program_status not null default 'draft',
  membership_tier_required public.membership_tier not null default 'solista',
  duration_days integer not null default 14 check (duration_days > 0),
  cover_image_url text,
  is_featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint programs_title_i18n_is_object check (jsonb_typeof(title_i18n) = 'object'),
  constraint programs_description_i18n_is_object check (jsonb_typeof(description_i18n) = 'object')
);

create table if not exists public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  video_id uuid not null references public.videos (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint program_days_unique_day unique (program_id, day_number)
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  program_day_number integer check (program_day_number is null or program_day_number > 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  max_position_seconds integer not null default 0 check (max_position_seconds >= 0),
  completion_percent numeric(5,2) not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  is_completed boolean not null default false,
  completed_at timestamptz,
  counted_toward_reward boolean not null default false,
  reward_counted_on date,
  completion_source text not null default 'player',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_settings (
  setting_key text primary key,
  category text not null,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint site_settings_value_is_valid_json check (jsonb_typeof(value) in ('object', 'array', 'string', 'number', 'boolean'))
);

create or replace function public.current_user_membership_tier()
returns public.membership_tier
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.membership_tier from public.profiles p where p.id = auth.uid()),
    'corps_de_ballet'::public.membership_tier
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

comment on table public.profiles is 'Extended account profile with onboarding, membership and admin flags.';
comment on table public.videos is 'On-demand content catalog with tiered access and metadata for filtering.';
comment on table public.programs is 'Structured programs with tiered access.';
comment on table public.program_days is 'Maps each program day to a specific video in sequence.';
comment on table public.user_progress is 'Per-user playback and completion state used for resume and reward tracking.';
comment on table public.site_settings is 'Admin-managed global configuration store to avoid business-rule hardcoding.';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_profiles_membership_tier on public.profiles (membership_tier);
create index if not exists idx_profiles_is_admin on public.profiles (is_admin) where is_admin = true;

create index if not exists idx_videos_status_tier on public.videos (status, membership_tier_required);
create index if not exists idx_videos_published_at on public.videos (published_at desc);
create index if not exists idx_videos_category_slugs on public.videos using gin (category_slugs);
create index if not exists idx_videos_equipment on public.videos using gin (equipment);
create index if not exists idx_videos_injury_contraindications on public.videos using gin (injury_contraindications);

create index if not exists idx_programs_status_tier on public.programs (status, membership_tier_required);
create index if not exists idx_programs_published_at on public.programs (published_at desc);
create index if not exists idx_program_days_program_id on public.program_days (program_id, day_number);
create index if not exists idx_program_days_video_id on public.program_days (video_id);

create index if not exists idx_user_progress_user_id on public.user_progress (user_id);
create index if not exists idx_user_progress_video_id on public.user_progress (video_id);
create index if not exists idx_user_progress_completed_at on public.user_progress (completed_at desc nulls last);
create index if not exists idx_user_progress_reward_counter on public.user_progress (user_id, reward_counted_on)
  where counted_toward_reward = true;

create unique index if not exists uq_user_progress_video_without_program
  on public.user_progress (user_id, video_id)
  where program_id is null;

create unique index if not exists uq_user_progress_video_with_program_day
  on public.user_progress (user_id, video_id, program_id, program_day_number)
  where program_id is not null;

create index if not exists idx_site_settings_category on public.site_settings (category);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    preferred_locale
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'preferred_locale', 'es')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.membership_tier = old.membership_tier;
    new.is_admin = old.is_admin;
    new.email = old.email;
  end if;

  return new;
end;
$$;

create or replace function public.apply_user_progress_business_rules()
returns trigger
language plpgsql
as $$
declare
  already_counted_today boolean;
begin
  new.max_position_seconds = greatest(coalesce(new.max_position_seconds, 0), coalesce(new.last_position_seconds, 0));

  if new.completion_percent >= 90 then
    new.is_completed = true;
  end if;

  if new.is_completed
     and (tg_op = 'INSERT' or old.is_completed is distinct from true)
     and new.completed_at is null then
    new.completed_at = timezone('utc', now());
  end if;

  if new.is_completed and new.completed_at is not null then
    select exists (
      select 1
      from public.user_progress up
      where up.user_id = new.user_id
        and up.counted_toward_reward = true
        and up.reward_counted_on = (new.completed_at at time zone 'utc')::date
        and up.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    into already_counted_today;

    if already_counted_today then
      new.counted_toward_reward = false;
      new.reward_counted_on = null;
    else
      new.counted_toward_reward = true;
      new.reward_counted_on = (new.completed_at at time zone 'utc')::date;
    end if;
  else
    new.counted_toward_reward = false;
    new.reward_counted_on = null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_videos_updated_at on public.videos;
create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_programs_updated_at on public.programs;
create trigger trg_programs_updated_at
  before update on public.programs
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_user_progress_updated_at on public.user_progress;
create trigger trg_user_progress_updated_at
  before update on public.user_progress
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_program_days_updated_at on public.program_days;
create trigger trg_program_days_updated_at
  before update on public.program_days
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_profiles_protect_admin_fields on public.profiles;
create trigger trg_profiles_protect_admin_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_admin_fields();

drop trigger if exists trg_user_progress_business_rules on public.user_progress;
create trigger trg_user_progress_business_rules
  before insert or update on public.user_progress
  for each row execute procedure public.apply_user_progress_business_rules();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.user_progress enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "videos_select_allowed_by_tier" on public.videos;
create policy "videos_select_allowed_by_tier"
  on public.videos
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      status = 'published'
      and public.membership_tier_rank(public.current_user_membership_tier())
          >= public.membership_tier_rank(membership_tier_required)
    )
  );

drop policy if exists "videos_admin_manage" on public.videos;
create policy "videos_admin_manage"
  on public.videos
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "programs_select_allowed_by_tier" on public.programs;
create policy "programs_select_allowed_by_tier"
  on public.programs
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      status = 'published'
      and public.membership_tier_rank(public.current_user_membership_tier())
          >= public.membership_tier_rank(membership_tier_required)
    )
  );

drop policy if exists "programs_admin_manage" on public.programs;
create policy "programs_admin_manage"
  on public.programs
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "program_days_select_allowed_by_program_tier" on public.program_days;
create policy "program_days_select_allowed_by_program_tier"
  on public.program_days
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.programs p
      where p.id = program_days.program_id
        and p.status = 'published'
        and public.membership_tier_rank(public.current_user_membership_tier())
            >= public.membership_tier_rank(p.membership_tier_required)
    )
  );

drop policy if exists "program_days_admin_manage" on public.program_days;
create policy "program_days_admin_manage"
  on public.program_days
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_progress_select_own_or_admin" on public.user_progress;
create policy "user_progress_select_own_or_admin"
  on public.user_progress
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_progress_insert_own_or_admin" on public.user_progress;
create policy "user_progress_insert_own_or_admin"
  on public.user_progress
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_progress_update_own_or_admin" on public.user_progress;
create policy "user_progress_update_own_or_admin"
  on public.user_progress
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "site_settings_select_public_or_admin" on public.site_settings;
create policy "site_settings_select_public_or_admin"
  on public.site_settings
  for select
  to authenticated
  using (is_public = true or public.is_admin());

drop policy if exists "site_settings_admin_manage" on public.site_settings;
create policy "site_settings_admin_manage"
  on public.site_settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Seed settings
-- -----------------------------------------------------------------------------

insert into public.site_settings (setting_key, category, value, description, is_public)
values
  (
    'rewards.progress',
    'rewards',
    jsonb_build_object(
      'classes_required_for_reward', 15,
      'max_reward_counted_classes_per_day', 1,
      'reward_delivery_type', 'pdf_or_coupon'
    ),
    'Reward milestone thresholds and cadence.',
    false
  ),
  (
    'subscriptions.catalog',
    'subscriptions',
    jsonb_build_object(
      'trial_days', 7,
      'tiers', jsonb_build_array(
        jsonb_build_object('tier', 'corps_de_ballet', 'stripe_price_id', null, 'display_order', 1),
        jsonb_build_object('tier', 'solista', 'stripe_price_id', null, 'display_order', 2),
        jsonb_build_object('tier', 'principal', 'stripe_price_id', null, 'display_order', 3)
      )
    ),
    'Stripe subscription mapping and trial configuration.',
    false
  ),
  (
    'content.access',
    'content',
    jsonb_build_object(
      'default_video_tier', 'corps_de_ballet',
      'default_program_tier', 'solista',
      'resume_class_enabled', true
    ),
    'Default content access rules.',
    false
  ),
  (
    'ui.locales',
    'i18n',
    jsonb_build_object(
      'default_locale', 'es',
      'supported_locales', jsonb_build_array('es', 'en')
    ),
    'Supported locales for the application UI.',
    true
  )
on conflict (setting_key) do nothing;

commit;
