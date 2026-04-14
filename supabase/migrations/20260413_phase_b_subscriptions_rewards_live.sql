-- Brunela Dance Trainer
-- Phase B: subscriptions, rewards, live classes and admin bootstrap.
-- Target: Supabase Postgres

-- -----------------------------------------------------------------------------
-- New enums
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'unpaid',
      'paused',
      'canceled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'reward_claim_status') then
    create type public.reward_claim_status as enum (
      'earned',
      'claim_initiated',
      'claimed',
      'expired',
      'revoked'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'live_session_status') then
    create type public.live_session_status as enum (
      'draft',
      'scheduled',
      'completed',
      'canceled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'live_booking_status') then
    create type public.live_booking_status as enum (
      'reserved',
      'waitlisted',
      'canceled',
      'attended',
      'missed'
    );
  end if;
end;
$$;

begin;

-- -----------------------------------------------------------------------------
-- Phase A fixes required before introducing subscriptions
-- -----------------------------------------------------------------------------

alter table public.profiles
  alter column membership_tier set default 'none'::public.membership_tier;

update public.profiles
set membership_tier = 'none'::public.membership_tier,
    updated_at = timezone('utc', now())
where is_admin = false;

create or replace function public.membership_tier_rank(input_tier public.membership_tier)
returns integer
language sql
immutable
as $$
  select case input_tier
    when 'none' then 0
    when 'corps_de_ballet' then 1
    when 'solista' then 2
    when 'principal' then 3
  end;
$$;

create or replace function public.current_user_membership_tier()
returns public.membership_tier
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.membership_tier from public.profiles p where p.id = auth.uid()),
    'none'::public.membership_tier
  );
$$;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.membership_tier = old.membership_tier;
    new.is_admin = old.is_admin;
    new.email = old.email;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Shared helper functions
-- -----------------------------------------------------------------------------

create or replace function public.get_site_setting(input_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.value
  from public.site_settings s
  where s.setting_key = input_key;
$$;

create or replace function public.subscription_status_grants_access(input_status public.subscription_status)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (public.get_site_setting('subscriptions.access_defaults') -> 'access_granting_statuses') ? input_status::text,
    input_status in ('trialing', 'active')
  );
$$;

create or replace function public.membership_tier_for_user(input_user_id uuid)
returns public.membership_tier
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.membership_tier from public.profiles p where p.id = input_user_id),
    'none'::public.membership_tier
  );
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text not null unique,
  provider_price_id text,
  membership_tier public.membership_tier not null,
  status public.subscription_status not null default 'incomplete',
  cancel_at_period_end boolean not null default false,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  last_webhook_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscriptions_provider_check check (char_length(provider) > 0),
  constraint subscriptions_membership_tier_not_none check (membership_tier <> 'none'),
  constraint subscriptions_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.subscription_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint subscription_webhook_events_payload_is_object check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_progress_id uuid references public.user_progress (id) on delete set null,
  milestone_sequence integer not null check (milestone_sequence > 0),
  classes_required_snapshot integer not null check (classes_required_snapshot > 0),
  reward_type text not null,
  reward_payload jsonb not null default '{}'::jsonb,
  status public.reward_claim_status not null default 'earned',
  earned_at timestamptz not null default timezone('utc', now()),
  claimed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reward_claims_unique_milestone unique (user_id, milestone_sequence),
  constraint reward_claims_payload_is_object check (jsonb_typeof(reward_payload) = 'object')
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  status public.live_session_status not null default 'draft',
  membership_tier_required public.membership_tier not null default 'principal',
  instructor_profile_id uuid references public.profiles (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  session_timezone text not null,
  capacity integer not null check (capacity > 0),
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  cover_image_url text,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint live_sessions_title_i18n_is_object check (jsonb_typeof(title_i18n) = 'object'),
  constraint live_sessions_description_i18n_is_object check (jsonb_typeof(description_i18n) = 'object'),
  constraint live_sessions_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint live_sessions_membership_tier_not_none check (membership_tier_required <> 'none'),
  constraint live_sessions_time_window_check check (ends_at > starts_at),
  constraint live_sessions_booking_window_check check (
    booking_opens_at is null
    or booking_closes_at is null
    or booking_opens_at < booking_closes_at
  )
);

create table if not exists public.live_session_access_links (
  live_session_id uuid primary key references public.live_sessions (id) on delete cascade,
  provider text not null default 'zoom',
  join_url text not null,
  host_url text,
  passcode text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint live_session_access_links_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.live_session_bookings (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.live_booking_status not null default 'reserved',
  reserved_at timestamptz not null default timezone('utc', now()),
  canceled_at timestamptz,
  attended_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint live_session_bookings_unique_user_session unique (live_session_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

comment on table public.subscriptions is 'Subscription source of truth synchronized from Stripe webhooks.';
comment on table public.subscription_webhook_events is 'Webhook audit log with idempotency key per provider event.';
comment on table public.reward_claims is 'Historical reward milestones and delivery state.';
comment on table public.live_sessions is 'Admin-managed live classes with membership-based visibility.';
comment on table public.live_session_access_links is 'Sensitive meeting links stored separately from live session metadata.';
comment on table public.live_session_bookings is 'Reservations and attendance state for live sessions.';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_provider_customer on public.subscriptions (provider, provider_customer_id);
create index if not exists idx_subscriptions_period_end on public.subscriptions (current_period_ends_at);

create index if not exists idx_subscription_webhook_events_processed_at on public.subscription_webhook_events (processed_at);
create index if not exists idx_subscription_webhook_events_event_type on public.subscription_webhook_events (event_type);

create index if not exists idx_reward_claims_user_id on public.reward_claims (user_id, earned_at desc);
create index if not exists idx_reward_claims_status on public.reward_claims (status);

create index if not exists idx_live_sessions_status_starts_at on public.live_sessions (status, starts_at);
create index if not exists idx_live_sessions_tier_starts_at on public.live_sessions (membership_tier_required, starts_at);
create index if not exists idx_live_session_bookings_session_status on public.live_session_bookings (live_session_id, status);
create index if not exists idx_live_session_bookings_user_id on public.live_session_bookings (user_id, reserved_at desc);

-- -----------------------------------------------------------------------------
-- Triggers and business rules
-- -----------------------------------------------------------------------------

create or replace function public.sync_profile_membership_from_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  resolved_tier public.membership_tier;
  fallback_tier public.membership_tier;
begin
  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  select coalesce(
    (public.get_site_setting('subscriptions.access_defaults') ->> 'fallback_membership_tier')::public.membership_tier,
    'none'::public.membership_tier
  )
  into fallback_tier;

  select s.membership_tier
  into resolved_tier
  from public.subscriptions s
  where s.user_id = target_user_id
    and public.subscription_status_grants_access(s.status)
  order by public.membership_tier_rank(s.membership_tier) desc, s.created_at desc
  limit 1;

  update public.profiles p
  set membership_tier = coalesce(resolved_tier, fallback_tier),
      updated_at = timezone('utc', now())
  where p.id = target_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.validate_live_session_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record public.live_sessions%rowtype;
  allow_waitlist boolean;
  reserved_count integer;
begin
  select *
  into session_record
  from public.live_sessions ls
  where ls.id = new.live_session_id;

  if not found then
    raise exception 'Live session % not found', new.live_session_id;
  end if;

  if auth.uid() is not null and auth.uid() = new.user_id and not public.is_admin() then
    if new.status in ('attended', 'missed') then
      raise exception 'Users cannot set attendance states directly';
    end if;

    if tg_op = 'UPDATE'
       and new.status is distinct from old.status
       and new.status <> 'canceled' then
      raise exception 'Users can only cancel their own booking';
    end if;
  end if;

  if tg_op = 'INSERT' or new.status in ('reserved', 'waitlisted') then
    if session_record.status <> 'scheduled' then
      raise exception 'Only scheduled live sessions can be booked';
    end if;

    if public.membership_tier_rank(public.membership_tier_for_user(new.user_id))
       < public.membership_tier_rank(session_record.membership_tier_required) then
      raise exception 'Membership tier does not allow booking this live session';
    end if;

    if session_record.booking_opens_at is not null and timezone('utc', now()) < session_record.booking_opens_at then
      raise exception 'Booking window has not opened yet';
    end if;

    if session_record.booking_closes_at is not null and timezone('utc', now()) > session_record.booking_closes_at then
      raise exception 'Booking window is closed';
    end if;

    select count(*)
    into reserved_count
    from public.live_session_bookings b
    where b.live_session_id = new.live_session_id
      and b.status in ('reserved', 'attended')
      and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    select coalesce(
      (public.get_site_setting('live_sessions.booking') ->> 'allow_waitlist')::boolean,
      true
    )
    into allow_waitlist;

    if reserved_count >= session_record.capacity and new.status = 'reserved' then
      if allow_waitlist then
        new.status = 'waitlisted';
      else
        raise exception 'Live session is full';
      end if;
    end if;
  end if;

  if new.status = 'canceled' and new.canceled_at is null then
    new.canceled_at = timezone('utc', now());
  end if;

  if new.status = 'attended' and new.attended_at is null then
    new.attended_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.bootstrap_admin_by_email(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_admin = true,
      updated_at = timezone('utc', now())
  where lower(email) = lower(trim(target_email));

  if not found then
    raise exception 'No profile found for email %', target_email;
  end if;
end;
$$;

revoke all on function public.bootstrap_admin_by_email(text) from public;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_reward_claims_updated_at on public.reward_claims;
create trigger trg_reward_claims_updated_at
  before update on public.reward_claims
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_live_sessions_updated_at on public.live_sessions;
create trigger trg_live_sessions_updated_at
  before update on public.live_sessions
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_live_session_access_links_updated_at on public.live_session_access_links;
create trigger trg_live_session_access_links_updated_at
  before update on public.live_session_access_links
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_live_session_bookings_updated_at on public.live_session_bookings;
create trigger trg_live_session_bookings_updated_at
  before update on public.live_session_bookings
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists trg_subscriptions_sync_profile_membership on public.subscriptions;
create trigger trg_subscriptions_sync_profile_membership
  after insert or update or delete on public.subscriptions
  for each row execute procedure public.sync_profile_membership_from_subscriptions();

drop trigger if exists trg_live_session_bookings_validate on public.live_session_bookings;
create trigger trg_live_session_bookings_validate
  before insert or update on public.live_session_bookings
  for each row execute procedure public.validate_live_session_booking();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.subscriptions enable row level security;
alter table public.subscription_webhook_events enable row level security;
alter table public.reward_claims enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_session_access_links enable row level security;
alter table public.live_session_bookings enable row level security;

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "subscriptions_admin_manage" on public.subscriptions;
create policy "subscriptions_admin_manage"
  on public.subscriptions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "subscription_webhook_events_admin_manage" on public.subscription_webhook_events;
create policy "subscription_webhook_events_admin_manage"
  on public.subscription_webhook_events
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "reward_claims_select_own_or_admin" on public.reward_claims;
create policy "reward_claims_select_own_or_admin"
  on public.reward_claims
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "reward_claims_admin_manage" on public.reward_claims;
create policy "reward_claims_admin_manage"
  on public.reward_claims
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "live_sessions_select_allowed_by_tier" on public.live_sessions;
create policy "live_sessions_select_allowed_by_tier"
  on public.live_sessions
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      status in ('scheduled', 'completed')
      and public.membership_tier_rank(public.current_user_membership_tier())
          >= public.membership_tier_rank(membership_tier_required)
    )
  );

drop policy if exists "live_sessions_admin_manage" on public.live_sessions;
create policy "live_sessions_admin_manage"
  on public.live_sessions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "live_session_access_links_admin_manage" on public.live_session_access_links;
create policy "live_session_access_links_admin_manage"
  on public.live_session_access_links
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "live_session_bookings_select_own_or_admin" on public.live_session_bookings;
create policy "live_session_bookings_select_own_or_admin"
  on public.live_session_bookings
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "live_session_bookings_insert_own_or_admin" on public.live_session_bookings;
create policy "live_session_bookings_insert_own_or_admin"
  on public.live_session_bookings
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "live_session_bookings_update_own_or_admin" on public.live_session_bookings;
create policy "live_session_bookings_update_own_or_admin"
  on public.live_session_bookings
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Site setting seed updates
-- -----------------------------------------------------------------------------

insert into public.site_settings (setting_key, category, value, description, is_public)
values
  (
    'subscriptions.access_defaults',
    'subscriptions',
    jsonb_build_object(
      'fallback_membership_tier', 'none',
      'access_granting_statuses', jsonb_build_array('trialing', 'active')
    ),
    'Fallback access tier and statuses that grant content access.',
    false
  ),
  (
    'live_sessions.booking',
    'live_sessions',
    jsonb_build_object(
      'allow_waitlist', true,
      'reveal_link_only_to_booked_users', true
    ),
    'Live session booking behavior and access-link policy.',
    false
  )
on conflict (setting_key) do update
set category = excluded.category,
    value = excluded.value,
    description = excluded.description,
    is_public = excluded.is_public,
    updated_at = timezone('utc', now());

commit;
