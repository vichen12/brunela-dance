-- Brunela Dance Trainer
-- 2026-06-16: Chat upgrades
--   1. Configurable DM access per membership tier (admin toggles it).
--   2. Enforce that DM access at the DB level (RLS), not just in the UI.
--   3. Link topic rooms to existing video categories.
-- Target: Supabase Postgres
--
-- Builds on the existing chat schema (20260421_chat_docs_categories_rls.sql):
-- chat_rooms / chat_messages / chat_bans / chat_mutes already exist, with RLS
-- that blocks muted/banned users on INSERT. We do NOT recreate any of that.

begin;

-- -----------------------------------------------------------------------------
-- 1. Setting: which tiers may START a DM with the admin.
--    Default = only 'principal' (matches the landing's "Chat directo con Brunela").
--    The admin can flip these from /admin/chat.
-- -----------------------------------------------------------------------------
insert into public.site_settings (setting_key, category, value, description, is_public)
values (
  'chat.dm_access',
  'chat',
  jsonb_build_object(
    'none', false,
    'corps_de_ballet', false,
    'solista', false,
    'principal', true
  ),
  'Per-tier toggle for who can START a direct chat with the admin. Admin can always start with anyone.',
  false
)
on conflict (setting_key) do nothing;

-- Helper: can the current user start a DM? (admin always can)
create or replace function public.can_start_dm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or coalesce(
      (public.get_site_setting('chat.dm_access')
        -> (public.current_user_membership_tier())::text)::boolean,
      false
    );
$$;

-- -----------------------------------------------------------------------------
-- 2. Tighten DM room creation: a member may only insert a 'dm' room they are
--    part of AND only if their tier is allowed. Admin is unrestricted.
--    Replaces the old chat_rooms_member_insert_dm policy.
-- -----------------------------------------------------------------------------
drop policy if exists "chat_rooms_member_insert_dm" on public.chat_rooms;
create policy "chat_rooms_member_insert_dm"
  on public.chat_rooms
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      type = 'dm'
      and auth.uid() = any(participant_ids)
      and public.can_start_dm()
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Link topic rooms to existing video categories.
--    category_slug is optional; when set it points at categories.slug so the
--    community channels stay aligned with the video library.
-- -----------------------------------------------------------------------------
alter table public.chat_rooms
  add column if not exists category_slug text;

comment on column public.chat_rooms.category_slug is
  'Optional link to categories.slug so a topic room mirrors a video category.';

create index if not exists idx_chat_rooms_category_slug
  on public.chat_rooms (category_slug)
  where category_slug is not null;

commit;
