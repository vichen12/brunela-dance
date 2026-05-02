-- Brunela Dance Trainer
-- Studio announcements: admin broadcast messages visible on member dashboard

begin;

create table if not exists public.studio_announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default '',
  content       text not null,
  tier_target   text not null default 'all'
                  check (tier_target in ('all', 'corps_de_ballet', 'solista', 'principal')),
  is_active     boolean not null default true,
  published_at  timestamptz not null default timezone('utc', now()),
  expires_at    timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

comment on table public.studio_announcements
  is 'Admin broadcast messages shown as banners on the member dashboard.';

create index if not exists idx_studio_announcements_active_tier
  on public.studio_announcements (is_active, tier_target, published_at);

create or replace function public.trg_set_updated_at_studio_announcements()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_studio_announcements_updated_at on public.studio_announcements;
create trigger trg_studio_announcements_updated_at
  before update on public.studio_announcements
  for each row execute procedure public.trg_set_updated_at_studio_announcements();

-- RLS
alter table public.studio_announcements enable row level security;

drop policy if exists "announcements_select_active" on public.studio_announcements;
create policy "announcements_select_active"
  on public.studio_announcements
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      is_active = true
      and (expires_at is null or expires_at > timezone('utc', now()))
      and (
        tier_target = 'all'
        or tier_target = public.current_user_membership_tier()::text
        or (
          tier_target = 'corps_de_ballet'
          and public.membership_tier_rank(public.current_user_membership_tier()) >= 1
        )
        or (
          tier_target = 'solista'
          and public.membership_tier_rank(public.current_user_membership_tier()) >= 2
        )
        or (
          tier_target = 'principal'
          and public.membership_tier_rank(public.current_user_membership_tier()) >= 3
        )
      )
    )
  );

drop policy if exists "announcements_admin_manage" on public.studio_announcements;
create policy "announcements_admin_manage"
  on public.studio_announcements
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
