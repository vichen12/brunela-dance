-- Brunela Dance Trainer
-- Phase B1: allow clients to read live session links via RLS when authorized.

begin;

create or replace function public.can_current_user_view_live_session_link(target_live_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  session_record public.live_sessions%rowtype;
  require_booking boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  select *
  into session_record
  from public.live_sessions ls
  where ls.id = target_live_session_id;

  if not found then
    return false;
  end if;

  if session_record.status not in ('scheduled', 'completed') then
    return false;
  end if;

  if public.membership_tier_rank(public.current_user_membership_tier())
     < public.membership_tier_rank(session_record.membership_tier_required) then
    return false;
  end if;

  select coalesce(
    (public.get_site_setting('live_sessions.booking') ->> 'reveal_link_only_to_booked_users')::boolean,
    true
  )
  into require_booking;

  if not require_booking then
    return true;
  end if;

  return exists (
    select 1
    from public.live_session_bookings b
    where b.live_session_id = target_live_session_id
      and b.user_id = auth.uid()
      and b.status in ('reserved', 'attended')
  );
end;
$$;

drop policy if exists "live_session_access_links_select_authorized" on public.live_session_access_links;
create policy "live_session_access_links_select_authorized"
  on public.live_session_access_links
  for select
  to authenticated
  using (public.can_current_user_view_live_session_link(live_session_id));

commit;
