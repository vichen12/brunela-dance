-- Migration: RLS for categories, documents, chat tables + admin tier fix
-- Run this in Supabase SQL Editor

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure 'none' exists in membership_tier enum (safe re-run)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'none'
      and enumtypid = 'public.membership_tier'::regtype
  ) then
    alter type public.membership_tier add value 'none';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Set all admin users to tier = principal automatically
-- ─────────────────────────────────────────────────────────────────────────────
update public.profiles
set membership_tier = 'principal'
where is_admin = true
  and membership_tier != 'principal';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. categories table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  membership_tier_required text not null default 'none',
  cover_image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.categories enable row level security;

drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public"
  on public.categories for select
  using (is_active = true or public.is_admin());

drop policy if exists "categories_admin_manage" on public.categories;
create policy "categories_admin_manage"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. documents table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text not null,
  file_type text not null default 'pdf',
  file_size_kb integer,
  membership_tier_required text not null default 'none',
  category_slug text,
  video_slug text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.documents enable row level security;

drop policy if exists "documents_select_published" on public.documents;
create policy "documents_select_published"
  on public.documents for select
  using (is_published = true or public.is_admin());

drop policy if exists "documents_admin_manage" on public.documents;
create policy "documents_admin_manage"
  on public.documents for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. chat_rooms table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'community',
  name text not null,
  tier_required text not null default 'none',
  participant_ids uuid[] not null default '{}',
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.chat_rooms enable row level security;

drop policy if exists "chat_rooms_select_accessible" on public.chat_rooms;
create policy "chat_rooms_select_accessible"
  on public.chat_rooms for select
  using (
    public.is_admin()
    or (type = 'dm' and auth.uid() = any(participant_ids))
    or (type in ('community', 'tier') and is_archived = false)
  );

drop policy if exists "chat_rooms_admin_manage" on public.chat_rooms;
create policy "chat_rooms_admin_manage"
  on public.chat_rooms for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "chat_rooms_member_insert_dm" on public.chat_rooms;
create policy "chat_rooms_member_insert_dm"
  on public.chat_rooms for insert
  with check (
    type = 'dm' and auth.uid() = any(participant_ids)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. chat_messages table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_room_member" on public.chat_messages;
create policy "chat_messages_select_room_member"
  on public.chat_messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.type in ('community', 'tier')
          or (r.type = 'dm' and auth.uid() = any(r.participant_ids))
        )
    )
  );

drop policy if exists "chat_messages_insert_member" on public.chat_messages;
create policy "chat_messages_insert_member"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and r.is_archived = false
        and (
          r.type in ('community', 'tier')
          or (r.type = 'dm' and auth.uid() = any(r.participant_ids))
        )
    )
    and not exists (
      select 1 from public.chat_bans b
      where b.user_id = auth.uid()
        and (b.expires_at is null or b.expires_at > now())
    )
    and not exists (
      select 1 from public.chat_mutes m
      where m.user_id = auth.uid()
        and (m.expires_at is null or m.expires_at > now())
    )
  );

drop policy if exists "chat_messages_update_soft_delete" on public.chat_messages;
create policy "chat_messages_update_soft_delete"
  on public.chat_messages for update
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. chat_bans table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id),
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id)
);

alter table public.chat_bans enable row level security;

drop policy if exists "chat_bans_admin_manage" on public.chat_bans;
create policy "chat_bans_admin_manage"
  on public.chat_bans for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "chat_bans_select_own" on public.chat_bans;
create policy "chat_bans_select_own"
  on public.chat_bans for select
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. chat_mutes table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_by uuid not null references public.profiles(id),
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id)
);

alter table public.chat_mutes enable row level security;

drop policy if exists "chat_mutes_admin_manage" on public.chat_mutes;
create policy "chat_mutes_admin_manage"
  on public.chat_mutes for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "chat_mutes_select_own" on public.chat_mutes;
create policy "chat_mutes_select_own"
  on public.chat_mutes for select
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Enable Realtime on chat_messages
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Indexes for performance
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_chat_messages_room_id on public.chat_messages(room_id);
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at);
create index if not exists idx_chat_bans_user_id on public.chat_bans(user_id);
create index if not exists idx_chat_mutes_user_id on public.chat_mutes(user_id);
create index if not exists idx_documents_is_published on public.documents(is_published);
create index if not exists idx_categories_is_active on public.categories(is_active);

commit;
