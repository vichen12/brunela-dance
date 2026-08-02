-- Brunela Dance Trainer
-- 2026-07-30: Narrow lookup of the studio admin, for the member chat.
-- Target: Supabase Postgres. Run in the SQL Editor.
--
-- THE BUG THIS FIXES
--   /dashboard/chat rendered "Cargando chat..." forever for EVERY member.
--   It is not a loading state: it is the final `else` of the component.
--
--   The member view needs the admin's user id to find or create their DM room.
--   It looked it up with the member's own client:
--
--     select id, full_name, email from profiles where is_admin = true
--
--   and `profiles_select_self_or_admin` only lets a member read their OWN row,
--   so the query returned nothing, the whole DM block was skipped, and the page
--   fell through to that placeholder. Verified with a real member token:
--   `is_admin=true` returned [] and the member could see exactly 1 profile row.
--
--   Everything else the member chat needs was ALREADY permitted:
--     chat_rooms_member_insert_dm   -> can create the DM (if can_start_dm())
--     chat_rooms_select_accessible  -> can see it
--     chat_messages_select/insert   -> can read and write in it
--   This one lookup was the only blocked step.
--
-- WHY A FUNCTION AND NOT A LOOSER POLICY
--   Relaxing profiles RLS would expose every member's row to every member.
--   Not an option: this function returns ONE row and TWO columns, and nothing
--   else about anyone.
--
-- WHY A FUNCTION AND NOT A SERVER-SIDE SERVICE-ROLE READ
--   Auditability. An elevation hidden in one line of application code does not
--   show up when someone reviews the migrations six months from now -- the same
--   way the two hand-made orphan policies on `categories` went unnoticed for
--   months. Written as a function it is versioned, reviewable and greppable.
--
-- WHAT IT DELIBERATELY DOES NOT RETURN
--   No email: the previous code fell back to rendering the admin's email as the
--   display name, so a member could end up seeing Brunela's address. Gone.
--   No membership_tier, no is_admin, no other profile of any kind.

begin;

create or replace function public.get_studio_admin()
returns table (admin_id uuid, admin_name text)
language sql
stable
security definer
set search_path = public
as $$
  -- Oldest admin wins, so the studio always resolves to the same person even
  -- if a second admin account is created later.
  select p.id, p.full_name
  from public.profiles p
  where p.is_admin = true
  order by p.created_at asc
  limit 1;
$$;

comment on function public.get_studio_admin() is
  'Returns only the id and display name of the studio admin, so a member can open their DM. Deliberately excludes email and every other column; profiles RLS stays closed.';

-- Members must be able to call it; nobody else.
revoke all on function public.get_studio_admin() from public;
revoke all on function public.get_studio_admin() from anon;
grant execute on function public.get_studio_admin() to authenticated;

commit;

-- =============================================================================
-- POST-RUN VERIFICATION
-- =============================================================================
--
-- a) Devuelve exactamente una fila con dos columnas:
--
-- select * from public.get_studio_admin();
--
-- b) Los permisos: authenticated si, anon no.
--
-- select grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_name = 'get_studio_admin';
--
-- c) El conteo de policies NO cambia (esta migracion no crea ninguna).
--    Deberia seguir en 43:
--
-- select count(*) from pg_policies where schemaname = 'public';
