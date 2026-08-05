-- Brunela Dance Trainer
-- 2026-08-05: invitar a una alumna concreta a una sesion en vivo, aunque su
--             plan no le alcance.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   PEGAR SOLO EL SQL, SIN el `begin;` ni el `commit;` de abajo. El editor ya
--   envuelve lo pegado en su propia transaccion y un `commit;` propio la cierra
--   antes de tiempo: lo que sigue se ejecuta sin error visible y NO PERSISTE.
--   Es la trampa 7 de CLAUDE.md, la que costo cuatro intentos en el chat.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUE CAMBIA, Y POR QUE SON TRES LUGARES Y NO UNO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hoy el acceso a una sesion sale UNICAMENTE de `membership_tier_required`, y
-- eso se comprueba en tres sitios distintos, cada uno gobernando una cosa:
--
--   1. live_sessions_select_allowed_by_tier ......... verla en el listado
--   2. validate_live_session_booking (trigger) ...... poder reservarla
--   3. can_current_user_view_live_session_link() .... ver el enlace de Zoom
--
-- Una invitacion tiene que abrir los tres. Abrir dos deja una funcionalidad que
-- "casi anda" -- por ejemplo: la ve, la reserva, y no le aparece el Zoom.
--
-- LA REGLA VIVE EN UNA SOLA FUNCION, no copiada tres veces. Si manana hay que
-- cambiarla (que caduque, que la pueda revocar) se cambia en un lugar.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LAS CUATRO DECISIONES DE PRODUCTO QUE ESTAN METIDAS EN ESTE SQL
-- ═══════════════════════════════════════════════════════════════════════════
--
--   ✅ La invitacion SALTEA EL PLAN.          Es la definicion de la funcionalidad.
--   ✅ La invitacion SALTEA LA VENTANA de     Una invitacion personal suele ser
--      reservas (desde/hasta).                tardia: "veni a la de manana". Si
--                                             la ventana la frenara, no serviria.
--   ❌ La invitacion NO SALTEA EL CUPO.       Si la sala de Zoom tiene un limite
--                                             duro, sobrevender deja afuera a
--                                             alguien que YA tenia su lugar. Si
--                                             hace falta un asiento mas, se sube
--                                             el cupo, que es un campo.
--                                             Con cupo lleno la invitada cae en
--                                             lista de espera (si esta activada),
--                                             que es visible y reversible.
--   ❌ La invitacion NO RESERVA SOLA.         Da el DERECHO a reservar; la alumna
--                                             confirma. Asi el cupo sigue
--                                             contando gente que va a venir, y no
--                                             gente que fue invitada y ni se
--                                             entero.
--
-- Las dos primeras se cambian borrando una condicion. Las dos ultimas se
-- cambian con mas cuidado -- estan asi a proposito.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE HAY DOS FUNCIONES Y NO UNA
-- ═══════════════════════════════════════════════════════════════════════════
--
--   current_user_is_invited_to_live_session(sesion)        -> authenticated
--   is_invited_to_live_session(sesion, alumna)             -> SOLO service_role
--
-- Es el mismo par que ya existe con current_user_membership_tier() y
-- membership_tier_for_user(), y por el mismo motivo.
--
-- Una funcion en `public` a la que `authenticated` puede hacer EXECUTE es un
-- ENDPOINT RPC PUBLICO para cualquiera con sesion. Si la version de dos
-- argumentos estuviera expuesta, cualquier alumna podria preguntar "¿esta
-- Fulana invitada a tal sesion?" y enumerar la lista de invitadas.
--
-- La de un argumento solo puede contestar sobre quien pregunta.
--
-- Y hace falta que `authenticated` tenga EXECUTE en ESA: las expresiones de una
-- policy se evaluan con los permisos del usuario, no con los del dueno. El
-- trigger y la funcion del enlace son SECURITY DEFINER, corren como postgres, y
-- por eso si pueden usar la de dos argumentos.

begin;

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------
-- Sin `expires_at` a proposito: una invitacion es a UNA sesion, y la sesion ya
-- tiene fecha. Caducarla aparte seria una fecha mas que puede quedar mal.

create table if not exists public.live_session_invitations (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- `set null` y no `cascade`: si algun dia se borra la cuenta que invito, la
  -- invitacion sigue siendo valida. Se pierde quien la hizo, no el acceso.
  invited_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint live_session_invitations_unicas unique (live_session_id, user_id)
);

-- El unique ya indexa (live_session_id, user_id), que es como pregunta la
-- funcion. Este otro es para el camino contrario: "las invitaciones de esta
-- alumna", que es lo que dibuja su pantalla.
create index if not exists live_session_invitations_user_idx
  on public.live_session_invitations (user_id);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
-- ⚠️ NINGUNA de estas policies puede mirar `live_sessions`: la policy de
--    live_sessions va a llamar a una funcion que lee ESTA tabla, y si esta
--    tabla mirara live_sessions se cierra el circulo y Postgres entra en
--    recursion infinita. Se quedan mirando solo columnas propias.

alter table public.live_session_invitations enable row level security;

drop policy if exists "live_session_invitations_select_own" on public.live_session_invitations;
create policy "live_session_invitations_select_own"
  on public.live_session_invitations
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (select auth.uid()) = user_id
  );

-- ---------------------------------------------------------------------------
-- 3. Permisos
-- ---------------------------------------------------------------------------
-- ⚠️ Una tabla nueva NO hereda nada: la migracion 20260804_fix_default_privileges
--    dejo los privilegios por defecto en cero. Si esto no estuviera, la tabla
--    daria 42501 al primer SELECT. Es lo que ya paso con activity_events.
--
-- Solo SELECT. Escribir es cosa de Brunela, y las acciones de admin van por
-- service_role (createSupabaseAdminClient), que no pasa por estos grants.
-- Darle INSERT a `authenticated` seria darselo a cualquiera con sesion.

grant select on public.live_session_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- 4. La regla, en un solo lugar
-- ---------------------------------------------------------------------------

create or replace function public.is_invited_to_live_session(
  target_live_session_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_session_invitations i
    where i.live_session_id = target_live_session_id
      and i.user_id = target_user_id
  );
$$;

-- Cinturon: aunque `public` no suele tener EXECUTE por defecto en Supabase, se
-- revoca explicitamente para que no dependa de la configuracion del proyecto.
revoke all on function public.is_invited_to_live_session(uuid, uuid) from public;
revoke all on function public.is_invited_to_live_session(uuid, uuid) from anon;
revoke all on function public.is_invited_to_live_session(uuid, uuid) from authenticated;
grant execute on function public.is_invited_to_live_session(uuid, uuid) to service_role;

create or replace function public.current_user_is_invited_to_live_session(
  target_live_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.live_session_invitations i
       where i.live_session_id = target_live_session_id
         and i.user_id = auth.uid()
     );
$$;

revoke all on function public.current_user_is_invited_to_live_session(uuid) from public;
revoke all on function public.current_user_is_invited_to_live_session(uuid) from anon;
grant execute on function public.current_user_is_invited_to_live_session(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Lugar 1 de 3 — verla en el listado
-- ---------------------------------------------------------------------------
-- Se reproduce la version vigente (20260728_rls_initplan_and_chat_indexes.sql,
-- linea 232) y se le agrega SOLO el `or`.
--
-- ⚠️ `status in ('scheduled','completed')` queda AFUERA del or a proposito: una
--    invitacion abre el plan, no el estado. A una sesion en borrador o cancelada
--    no entra nadie, invitada o no.

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
        public.membership_tier_rank((select public.current_user_membership_tier()))
            >= public.membership_tier_rank(membership_tier_required)
        or public.current_user_is_invited_to_live_session(id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Lugar 2 de 3 — poder reservarla
-- ---------------------------------------------------------------------------
-- Se reproduce ENTERA la version vigente (phase_b, linea 349). Un
-- `create or replace` reemplaza todo el cuerpo: copiar de menos aca no da error,
-- borra comprobaciones en silencio.
--
-- Cambian exactamente dos cosas, marcadas con "NUEVO":
--   a) el plan insuficiente ya no frena si hay invitacion
--   b) la ventana de reservas no frena si hay invitacion

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
  invited boolean;              -- NUEVO
begin
  select *
  into session_record
  from public.live_sessions ls
  where ls.id = new.live_session_id;

  if not found then
    raise exception 'Live session % not found', new.live_session_id;
  end if;

  -- NUEVO. Se resuelve una sola vez: se usa en dos comprobaciones.
  -- Va con la version de DOS argumentos porque cuando Brunela reserva en nombre
  -- de una alumna, auth.uid() es ella (o es null si va por service_role), y
  -- quien tiene que estar invitada es new.user_id.
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

    -- NUEVO (a): la invitacion abre el plan.
    if public.membership_tier_rank(public.membership_tier_for_user(new.user_id))
       < public.membership_tier_rank(session_record.membership_tier_required)
       and not invited then
      raise exception 'Membership tier does not allow booking this live session';
    end if;

    -- NUEVO (b): la invitacion abre la ventana de reservas.
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

    -- SIN CAMBIOS: el cupo se respeta tambien para las invitadas.
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
-- 7. Lugar 3 de 3 — ver el enlace de Zoom
-- ---------------------------------------------------------------------------
-- 🔴 ESTA ES LA MAS DELICADA DE LAS TRES. Es la que protege el enlace: si el
--    `or` quedara mal puesto, el Zoom se le muestra a cualquiera con sesion.
--
-- Se reproduce entera la version vigente (phase_b1). Cambia UNA condicion.
--
-- ⚠️ Lo que NO cambia: si `reveal_link_only_to_booked_users` esta activo, la
--    invitada SIGUE necesitando haber reservado. La invitacion da el derecho a
--    reservar, no el enlace directo.

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

  -- NUEVO: unico cambio de esta funcion. La invitacion abre el plan.
  if public.membership_tier_rank(public.current_user_membership_tier())
     < public.membership_tier_rank(session_record.membership_tier_required)
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

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) La tabla existe y `authenticated` tiene SELECT y NADA MAS.
--    Esperado: exactamente una fila, con privilege_type = SELECT.
--
-- select grantee, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name = 'live_session_invitations'
--    and grantee = 'authenticated';
--
-- b) La funcion de dos argumentos NO es alcanzable por una alumna.
--    Esperado: CERO filas. Si aparece `authenticated`, la lista de invitadas
--    es enumerable por RPC.
--
-- select r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(p.proacl) a
--   join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname = 'is_invited_to_live_session'
--    and a.privilege_type = 'EXECUTE'
--    and r.rolname in ('anon', 'authenticated');
--
-- c) Los tres lugares miran la invitacion. Esperado: las tres filas en SI.
--
-- select nombre,
--        case when definicion like '%invited_to_live_session%' then 'SI' else 'NO' end as mira_invitacion
--   from (
--     select 'policy live_sessions' as nombre,
--            coalesce(qual,'') || coalesce(with_check,'') as definicion
--       from pg_policies
--      where schemaname = 'public'
--        and policyname = 'live_sessions_select_allowed_by_tier'
--     union all
--     select 'trigger de reservas', prosrc from pg_proc
--      where proname = 'validate_live_session_booking'
--     union all
--     select 'enlace de zoom', prosrc from pg_proc
--      where proname = 'can_current_user_view_live_session_link'
--   ) t;
--
-- ⚠️ Esta consulta busca `invited_to_live_session`, que NO es substring de
--    ninguna otra cosa del esquema. La version anterior de este tipo de
--    verificacion uso 'tier_required', que SI es substring de
--    'membership_tier_required', y dio un falso positivo que costo dos rondas.
--
-- d) LA PRUEBA DE VERDAD, que no es SQL:
--
--      npm run test:aislamiento
--
--    El archivo tests/aislamiento/sesiones.test.ts comprueba, con el JWT de
--    cada alumna, que:
--      - sin invitacion y sin plan: no la ve, no la reserva, no ve el Zoom
--      - con invitacion y sin plan: la ve, la reserva, y ve el Zoom al reservar
--      - la invitacion de OTRA no le sirve a nadie
--      - el cupo se respeta igual
--
--    Sin correr eso, esta migracion esta sin verificar.
