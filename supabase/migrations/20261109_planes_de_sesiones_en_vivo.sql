-- Brunela Dance Trainer
-- 2026-11-09: las sesiones en vivo se abren plan por plan, con casillas.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   Pegar tal cual: no trae `begin;` ni `commit;` (trampa 7 de CLAUDE.md).
--
-- POR QUE EXISTE
--   Pedido de la duena: "que salgan cada plan por separado y que pueda cliquear
--   en cuales si y cuales no". Hasta hoy una sesion guardaba UN plan minimo
--   ("Corps de Ballet" = todas), asi que "solo Corps de Ballet" o "Corps y
--   Principal, sin Solista" no se podian guardar.
--
-- QUE CAMBIA (el mismo modelo que ya usan las clases grabadas, 20260921)
--   1. live_sessions.planes_permitidos: la lista de planes que la ven y la
--      reservan. Backfill con la regla vieja, asi ninguna sesion cambia de manos.
--   2. Un trigger que mantiene membership_tier_required (el plan minimo de la
--      lista) para las pantallas que solo muestran una etiqueta.
--   3. Los TRES lugares que deciden el acceso pasan de "rango >= minimo" a
--      "su plan esta en la lista": verla, reservarla y ver el enlace.
--      Cada uno se reproduce ENTERO desde su version vigente
--      (20260805_invitaciones_a_sesiones.sql) y cambia UNA condicion, marcada
--      "CAMBIA". Copiar de menos no da error: borra comprobaciones en silencio.
--
-- SIN ESTA MIGRACION
--   El panel sigue funcionando con el plan minimo, como hasta hoy: la accion
--   detecta que falta la columna y guarda solo membership_tier_required.
--
-- ⚠️ ORDEN: DESPUES de 20260805_invitaciones_a_sesiones.sql (redefine sus tres
--    funciones/policies). Con el resto, al final y en cualquier orden.

-- ---------------------------------------------------------------------------
-- 0. Guarda
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.live_session_invitations') is null then
    raise exception 'Falta 20260805_invitaciones_a_sesiones.sql: correr esa primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. La columna, con los datos de hoy
-- ---------------------------------------------------------------------------

alter table public.live_sessions
  add column if not exists planes_permitidos public.membership_tier[] not null default '{}';

-- "Los planes de rango mayor o igual al que pedia": nadie gana ni pierde acceso.
update public.live_sessions s
set planes_permitidos = (
  select coalesce(array_agg(t order by public.membership_tier_rank(t)), '{}')
  from unnest(enum_range(null::public.membership_tier)) as t
  where t <> 'none'
    and public.membership_tier_rank(t) >= public.membership_tier_rank(s.membership_tier_required)
)
where cardinality(s.planes_permitidos) = 0;

-- Ni vacia (no la veria nadie) ni con `none` (la veria quien no paga).
-- cardinality y NO array_length: array_length('{}', 1) es NULL y un CHECK con
-- NULL deja pasar (20260921_3_la_lista_vacia_ahora_si_se_rechaza.sql).
alter table public.live_sessions
  drop constraint if exists live_sessions_planes_permitidos_validos;

alter table public.live_sessions
  add constraint live_sessions_planes_permitidos_validos
  check (
    cardinality(planes_permitidos) >= 1
    and not (planes_permitidos @> array['none'::public.membership_tier])
  );

create index if not exists idx_live_sessions_planes_permitidos
  on public.live_sessions using gin (planes_permitidos);

comment on column public.live_sessions.planes_permitidos is
  'Planes que ven y reservan la sesion. Lo leen la policy de live_sessions, validate_live_session_booking y can_current_user_view_live_session_link. membership_tier_required se deriva de aca por trigger y es solo para mostrar. 20261109_planes_de_sesiones_en_vivo.sql';

-- ---------------------------------------------------------------------------
-- 2. El trigger que mantiene las dos columnas de acuerdo
-- ---------------------------------------------------------------------------
-- Igual que videos_sincronizar_planes. Si la escritura trae la LISTA, gana la
-- lista; si trae solo el plan minimo (codigo viejo, pruebas), se reconstruye
-- la lista con la regla vieja.

create or replace function public.live_sessions_sincronizar_planes()
returns trigger
language plpgsql
as $$
declare
  planes_vacios boolean;
  planes_cambiaron boolean;
begin
  planes_vacios := new.planes_permitidos is null
                   or cardinality(new.planes_permitidos) = 0;

  planes_cambiaron := tg_op = 'INSERT'
                      or new.planes_permitidos is distinct from old.planes_permitidos;

  if not planes_vacios and planes_cambiaron then
    new.membership_tier_required := (
      select t
      from unnest(new.planes_permitidos) as t
      order by public.membership_tier_rank(t)
      limit 1
    );
    return new;
  end if;

  if planes_vacios
     or (tg_op = 'UPDATE'
         and new.membership_tier_required is distinct from old.membership_tier_required) then
    new.planes_permitidos := (
      select coalesce(array_agg(t order by public.membership_tier_rank(t)), '{}')
      from unnest(enum_range(null::public.membership_tier)) as t
      where t <> 'none'
        and public.membership_tier_rank(t) >= public.membership_tier_rank(new.membership_tier_required)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists live_sessions_sincronizar_planes on public.live_sessions;
create trigger live_sessions_sincronizar_planes
  before insert or update on public.live_sessions
  for each row execute function public.live_sessions_sincronizar_planes();

-- ---------------------------------------------------------------------------
-- 3. Lugar 1 de 3 — verla en el listado
-- ---------------------------------------------------------------------------
-- Version vigente: 20260805, seccion 5. CAMBIA solo la comparacion de rangos.

drop policy if exists "live_sessions_select_allowed_by_tier" on public.live_sessions;
create policy "live_sessions_select_allowed_by_tier"
  on public.live_sessions
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      status in ('scheduled', 'completed')
      and (
        -- CAMBIA. ANTES: membership_tier_rank(current_user_membership_tier())
        --                  >= membership_tier_rank(membership_tier_required)
        planes_permitidos @> array[(select public.current_user_membership_tier())]
        or public.current_user_is_invited_to_live_session(id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Lugar 2 de 3 — poder reservarla
-- ---------------------------------------------------------------------------
-- Version vigente: 20260805, seccion 6, ENTERA. CAMBIA solo la condicion de plan.

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
  invited boolean;
begin
  select *
  into session_record
  from public.live_sessions ls
  where ls.id = new.live_session_id;

  if not found then
    raise exception 'Live session % not found', new.live_session_id;
  end if;

  invited := public.is_invited_to_live_session(new.live_session_id, new.user_id);

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

    -- CAMBIA. ANTES: membership_tier_rank(membership_tier_for_user(new.user_id))
    --                  < membership_tier_rank(session_record.membership_tier_required)
    -- La invitacion sigue abriendo el plan.
    if not (session_record.planes_permitidos @> array[public.membership_tier_for_user(new.user_id)])
       and not invited then
      raise exception 'Membership tier does not allow booking this live session';
    end if;

    if not invited
       and session_record.booking_opens_at is not null
       and timezone('utc', now()) < session_record.booking_opens_at then
      raise exception 'Booking window has not opened yet';
    end if;

    if not invited
       and session_record.booking_closes_at is not null
       and timezone('utc', now()) > session_record.booking_closes_at then
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

-- ---------------------------------------------------------------------------
-- 5. Lugar 3 de 3 — ver el enlace de Zoom o Meet
-- ---------------------------------------------------------------------------
-- 🔴 La que protege el enlace. Version vigente: 20260805, seccion 7, ENTERA.
--    CAMBIA solo la condicion de plan; el requisito de haber reservado queda.

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

  -- CAMBIA. ANTES: membership_tier_rank(current_user_membership_tier())
  --                  < membership_tier_rank(session_record.membership_tier_required)
  if not (session_record.planes_permitidos @> array[public.current_user_membership_tier()])
     and not public.is_invited_to_live_session(target_live_session_id, auth.uid()) then
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

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Ninguna sesion quedo con la lista vacia. Esperado: 0.
--
-- select count(*) from public.live_sessions where cardinality(planes_permitidos) = 0;
--
-- b) La lista coincide con la regla vieja en las sesiones que ya existian.
--    Esperado: 0 filas.
--
-- select id, membership_tier_required, planes_permitidos
--   from public.live_sessions
--  where membership_tier_required <> (
--          select t from unnest(planes_permitidos) t order by public.membership_tier_rank(t) limit 1);
--
-- c) Por COMPORTAMIENTO, no leyendo el SQL: npm run test:aislamiento.
