-- Brunela Dance Trainer
-- 2026-07-28: Performance pass on RLS + chat indexes.
-- Target: Supabase Postgres. Run in the SQL Editor.
--
-- WHAT THIS DOES
--   1. Rewrites every RLS policy so the stable helper functions
--      (auth.uid(), is_admin(), current_user_membership_tier(), can_start_dm())
--      are wrapped in a scalar subselect. Postgres then evaluates them ONCE per
--      statement as an InitPlan instead of once per candidate row.
--   2. Adds the composite index chat_messages (room_id, created_at desc) that
--      the "last N messages of a room" query actually needs.
--   3. Adds a GIN index on chat_rooms.participant_ids, used by the DM lookup
--      (.contains("participant_ids", [...])) which was doing a seq scan.
--
-- WHAT THIS DOES NOT DO
--   - No table, column or data changes. Zero rows are touched.
--   - No permission semantics change. Every policy keeps the exact same
--     expression, the same command (select/insert/update/all) and the same role
--     targeting. Wrapping a stable function in (select ...) does not alter its
--     result, only how many times the planner calls it.
--
-- SAFETY
--   - Fully transactional: if any statement fails, nothing is applied.
--   - Idempotent: safe to re-run.
--   - Reversible: re-running the previous migrations restores the old policies.
--
-- NOTE ON ROLE TARGETING
--   Policies from 20260413_* and 20260502_* were declared "to authenticated".
--   Policies from 20260421_* were declared with NO role clause (so they apply to
--   PUBLIC). Both forms are reproduced below exactly as they were. Do not
--   "normalize" them without deciding that separately.

begin;

-- =============================================================================
-- 1. profiles
-- =============================================================================

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- =============================================================================
-- 2. videos   <- hottest member path: the library fetches the whole catalog
-- =============================================================================

drop policy if exists "videos_select_allowed_by_tier" on public.videos;
create policy "videos_select_allowed_by_tier"
  on public.videos
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      status = 'published'
      and public.membership_tier_rank((select public.current_user_membership_tier()))
          >= public.membership_tier_rank(membership_tier_required)
    )
  );

drop policy if exists "videos_admin_manage" on public.videos;
create policy "videos_admin_manage"
  on public.videos
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- 3. programs / program_days
-- =============================================================================

drop policy if exists "programs_select_allowed_by_tier" on public.programs;
create policy "programs_select_allowed_by_tier"
  on public.programs
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      status = 'published'
      and public.membership_tier_rank((select public.current_user_membership_tier()))
          >= public.membership_tier_rank(membership_tier_required)
    )
  );

drop policy if exists "programs_admin_manage" on public.programs;
create policy "programs_admin_manage"
  on public.programs
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The EXISTS stays correlated to the row (it must), but the two helper calls
-- inside it are now hoisted out of the per-row loop.
drop policy if exists "program_days_select_allowed_by_program_tier" on public.program_days;
create policy "program_days_select_allowed_by_program_tier"
  on public.program_days
  for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.programs p
      where p.id = program_days.program_id
        and p.status = 'published'
        and public.membership_tier_rank((select public.current_user_membership_tier()))
            >= public.membership_tier_rank(p.membership_tier_required)
    )
  );

drop policy if exists "program_days_admin_manage" on public.program_days;
create policy "program_days_admin_manage"
  on public.program_days
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- 4. user_progress
-- =============================================================================

drop policy if exists "user_progress_select_own_or_admin" on public.user_progress;
create policy "user_progress_select_own_or_admin"
  on public.user_progress
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "user_progress_insert_own_or_admin" on public.user_progress;
create policy "user_progress_insert_own_or_admin"
  on public.user_progress
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "user_progress_update_own_or_admin" on public.user_progress;
create policy "user_progress_update_own_or_admin"
  on public.user_progress
  for update
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

-- =============================================================================
-- 5. site_settings
-- =============================================================================

drop policy if exists "site_settings_select_public_or_admin" on public.site_settings;
create policy "site_settings_select_public_or_admin"
  on public.site_settings
  for select
  to authenticated
  using (is_public = true or (select public.is_admin()));

drop policy if exists "site_settings_admin_manage" on public.site_settings;
create policy "site_settings_admin_manage"
  on public.site_settings
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- 6. subscriptions / webhook events / reward claims
-- =============================================================================

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "subscriptions_admin_manage" on public.subscriptions;
create policy "subscriptions_admin_manage"
  on public.subscriptions
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "subscription_webhook_events_admin_manage" on public.subscription_webhook_events;
create policy "subscription_webhook_events_admin_manage"
  on public.subscription_webhook_events
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "reward_claims_select_own_or_admin" on public.reward_claims;
create policy "reward_claims_select_own_or_admin"
  on public.reward_claims
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "reward_claims_admin_manage" on public.reward_claims;
create policy "reward_claims_admin_manage"
  on public.reward_claims
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- 7. live sessions / bookings / access links
-- =============================================================================

drop policy if exists "live_sessions_select_allowed_by_tier" on public.live_sessions;
create policy "live_sessions_select_allowed_by_tier"
  on public.live_sessions
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      status in ('scheduled', 'completed')
      and public.membership_tier_rank((select public.current_user_membership_tier()))
          >= public.membership_tier_rank(membership_tier_required)
    )
  );

drop policy if exists "live_sessions_admin_manage" on public.live_sessions;
create policy "live_sessions_admin_manage"
  on public.live_sessions
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "live_session_access_links_admin_manage" on public.live_session_access_links;
create policy "live_session_access_links_admin_manage"
  on public.live_session_access_links
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- NOT TOUCHED: live_session_access_links_select_authorized.
-- Its predicate is can_current_user_view_live_session_link(live_session_id),
-- which takes a per-row column as an argument, so it genuinely depends on the
-- row and cannot be hoisted into an InitPlan. Left exactly as defined in
-- 20260413_phase_b1_live_session_link_access.sql.

drop policy if exists "live_session_bookings_select_own_or_admin" on public.live_session_bookings;
create policy "live_session_bookings_select_own_or_admin"
  on public.live_session_bookings
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "live_session_bookings_insert_own_or_admin" on public.live_session_bookings;
create policy "live_session_bookings_insert_own_or_admin"
  on public.live_session_bookings
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists "live_session_bookings_update_own_or_admin" on public.live_session_bookings;
create policy "live_session_bookings_update_own_or_admin"
  on public.live_session_bookings
  for update
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

-- =============================================================================
-- 8. categories / documents
--    Reminder: these were declared WITHOUT a role clause. Preserved as-is.
-- =============================================================================

drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public"
  on public.categories for select
  using (is_active = true or (select public.is_admin()));

drop policy if exists "categories_admin_manage" on public.categories;
create policy "categories_admin_manage"
  on public.categories for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "documents_select_published" on public.documents;
create policy "documents_select_published"
  on public.documents for select
  using (is_published = true or (select public.is_admin()));

drop policy if exists "documents_admin_manage" on public.documents;
create policy "documents_admin_manage"
  on public.documents for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- 9. chat_rooms
-- =============================================================================

drop policy if exists "chat_rooms_select_accessible" on public.chat_rooms;
create policy "chat_rooms_select_accessible"
  on public.chat_rooms for select
  using (
    (select public.is_admin())
    or (type = 'dm' and (select auth.uid()) = any(participant_ids))
    or (type in ('community', 'tier') and is_archived = false)
  );

drop policy if exists "chat_rooms_admin_manage" on public.chat_rooms;
create policy "chat_rooms_admin_manage"
  on public.chat_rooms for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Keeps the tightened 20260616 version (tier gate + "to authenticated"),
-- NOT the looser original from 20260421.
drop policy if exists "chat_rooms_member_insert_dm" on public.chat_rooms;
create policy "chat_rooms_member_insert_dm"
  on public.chat_rooms
  for insert
  to authenticated
  with check (
    (select public.is_admin())
    or (
      type = 'dm'
      and (select auth.uid()) = any(participant_ids)
      and (select public.can_start_dm())
    )
  );

-- =============================================================================
-- 10. chat_bans / chat_mutes
-- =============================================================================

drop policy if exists "chat_bans_admin_manage" on public.chat_bans;
create policy "chat_bans_admin_manage"
  on public.chat_bans for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "chat_bans_select_own" on public.chat_bans;
create policy "chat_bans_select_own"
  on public.chat_bans for select
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "chat_mutes_admin_manage" on public.chat_mutes;
create policy "chat_mutes_admin_manage"
  on public.chat_mutes for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "chat_mutes_select_own" on public.chat_mutes;
create policy "chat_mutes_select_own"
  on public.chat_mutes for select
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- =============================================================================
-- 11. chat_messages
--     The insert policy was already cheap (WITH CHECK runs once per inserted
--     row, and one message is one row). Wrapped anyway for consistency; the
--     real win here is on the SELECT policy, which runs per fetched row.
-- =============================================================================

drop policy if exists "chat_messages_select_room_member" on public.chat_messages;
create policy "chat_messages_select_room_member"
  on public.chat_messages for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.type in ('community', 'tier')
          or (r.type = 'dm' and (select auth.uid()) = any(r.participant_ids))
        )
    )
  );

drop policy if exists "chat_messages_insert_member" on public.chat_messages;
create policy "chat_messages_insert_member"
  on public.chat_messages for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and r.is_archived = false
        and (
          r.type in ('community', 'tier')
          or (r.type = 'dm' and (select auth.uid()) = any(r.participant_ids))
        )
    )
    and not exists (
      select 1 from public.chat_bans b
      where b.user_id = (select auth.uid())
        and (b.expires_at is null or b.expires_at > now())
    )
    and not exists (
      select 1 from public.chat_mutes m
      where m.user_id = (select auth.uid())
        and (m.expires_at is null or m.expires_at > now())
    )
  );

drop policy if exists "chat_messages_update_soft_delete" on public.chat_messages;
create policy "chat_messages_update_soft_delete"
  on public.chat_messages for update
  using ((select public.is_admin()) or user_id = (select auth.uid()))
  with check ((select public.is_admin()) or user_id = (select auth.uid()));

-- =============================================================================
-- 12. studio_announcements
-- =============================================================================

drop policy if exists "announcements_select_active" on public.studio_announcements;
create policy "announcements_select_active"
  on public.studio_announcements
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      is_active = true
      and (expires_at is null or expires_at > timezone('utc', now()))
      and (
        tier_target = 'all'
        or tier_target = (select public.current_user_membership_tier())::text
        or (
          tier_target = 'corps_de_ballet'
          and public.membership_tier_rank((select public.current_user_membership_tier())) >= 1
        )
        or (
          tier_target = 'solista'
          and public.membership_tier_rank((select public.current_user_membership_tier())) >= 2
        )
        or (
          tier_target = 'principal'
          and public.membership_tier_rank((select public.current_user_membership_tier())) >= 3
        )
      )
    )
  );

drop policy if exists "announcements_admin_manage" on public.studio_announcements;
create policy "announcements_admin_manage"
  on public.studio_announcements
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- 13. Indexes
-- =============================================================================

-- The "last N messages of a room" query is:
--   where room_id = ? and is_deleted = false order by created_at desc limit 100
-- The two pre-existing single-column indexes forced Postgres to filter by room
-- and then sort every message in that room. This serves filter + order in one
-- index scan that stops after 100 rows.
create index if not exists idx_chat_messages_room_created
  on public.chat_messages (room_id, created_at desc);

-- The member DM lookup does .contains("participant_ids", [...]), which without
-- a GIN index is a sequential scan over one row per member.
create index if not exists idx_chat_rooms_participant_ids
  on public.chat_rooms using gin (participant_ids);

commit;

-- =============================================================================
-- POST-RUN VERIFICATION (run separately, after the COMMIT above)
-- =============================================================================
--
-- a) Find any policy still calling a helper unwrapped. The strategy: delete
--    every already-wrapped "( SELECT helper() ... )" occurrence from the
--    rendered expression, then see if a bare call survives.
--    (Postgres regex is POSIX -- no lookbehind -- hence the strip-then-match.)
--
--    Expect exactly ONE row: live_session_access_links_select_authorized,
--    the known exception explained in section 7. Anything else is a miss.
--
-- select tablename, policyname
-- from pg_policies
-- where schemaname = 'public'
--   and regexp_replace(
--         coalesce(qual, '') || ' ' || coalesce(with_check, ''),
--         '\( SELECT (auth\.uid|is_admin|current_user_membership_tier|can_start_dm)\(\)[^)]*\)',
--         '',
--         'g'
--       ) ~ '(auth\.uid|is_admin|current_user_membership_tier|can_start_dm)\(\)';
--
-- a-bis) If that heuristic looks off, just read them yourself. Every helper
--    call should appear as "( SELECT ... )" in the output:
--
-- select tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
--
-- b) Confirm the policy count is unchanged (should be the same number you had
--    before running this file):
--
-- select count(*) from pg_policies where schemaname = 'public';
--
-- c) Confirm the new indexes exist:
--
-- select indexname from pg_indexes
-- where schemaname = 'public'
--   and indexname in ('idx_chat_messages_room_created', 'idx_chat_rooms_participant_ids');
--
-- d) Confirm the chat index is actually used (should say "Index Scan using
--    idx_chat_messages_room_created", not "Seq Scan" + "Sort"):
--
-- explain analyze
-- select id, content, created_at from public.chat_messages
-- where room_id = '<pega-un-room-id-real>' and is_deleted = false
-- order by created_at desc limit 100;
