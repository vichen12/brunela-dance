-- Brunela Dance Trainer
-- 2026-08-04: el chat empieza a comprobar el plan. Hasta ahora no lo hacia.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- ⚠️ ESTO CIERRA UN AGUJERO REAL, NO ES UNA MEJORA
--
--   `chat_rooms.tier_required` existe desde el primer dia y NO APARECE EN
--   NINGUNA POLICY. Las dos que gobiernan el chat dicen, hoy:
--
--     chat_rooms_select_accessible
--       or (type in ('community', 'tier') and is_archived = false)
--
--     chat_messages_select_room_member
--       r.type in ('community', 'tier')
--
--   Ninguna mira el plan. La comparacion vive en JavaScript, en
--   app/dashboard/community/page.tsx:
--
--     r.type === "community" || TIER_ORDER[tier] >= TIER_ORDER[r.tier_required]
--
--   Eso filtra LO QUE SE DIBUJA, no lo que se puede pedir. Es la trampa 4 de
--   CLAUDE.md otra vez: la interfaz puede ocultar, pero lo que tiene que frenar
--   es el acceso.
--
--   Hoy, una alumna de corps_de_ballet con su propia sesion puede hacer
--
--     await supabase.from('chat_messages').select('*').eq('room_id', '<sala principal>')
--
--   y leer la conversacion entera. Y suscribirse a su canal de realtime y
--   recibirla en vivo, porque postgres_changes filtra por estas mismas policies.
--
--   Videos y programas SI comprueban el plan con membership_tier_rank desde
--   phase_a. El chat quedo afuera.
--
-- LOS DM NO CAMBIAN
--   Su aislamiento ya estaba bien hecho (auth.uid() = any(participant_ids)) y
--   se conserva tal cual. Lo unico que se agrega es la comprobacion de plan
--   para las salas de tipo 'tier'.
--
-- LAS SALAS 'community' SIGUEN SIENDO DE TODAS
--   Por definicion son para todo el estudio, incluida quien no tiene plan. Solo
--   las de tipo 'tier' pasan a exigir rango suficiente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ver la sala
-- ---------------------------------------------------------------------------

drop policy if exists "chat_rooms_select_accessible" on public.chat_rooms;
create policy "chat_rooms_select_accessible"
  on public.chat_rooms
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (type = 'dm' and (select auth.uid()) = any(participant_ids))
    or (type = 'community' and is_archived = false)
    or (
      type = 'tier'
      and is_archived = false
      -- Lo mismo que ya hacen videos y programas desde el primer dia.
      and public.membership_tier_rank((select public.current_user_membership_tier()))
          >= public.membership_tier_rank(tier_required)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Leer sus mensajes
-- ---------------------------------------------------------------------------
-- Tiene que repetir la regla y no solo apoyarse en la de arriba: son dos tablas
-- distintas y PostgREST deja consultar chat_messages por room_id sin pasar por
-- chat_rooms. Si esta se quedara en `type in ('community','tier')`, el agujero
-- seguiria abierto aunque la sala no se listara.

drop policy if exists "chat_messages_select_room_member" on public.chat_messages;
create policy "chat_messages_select_room_member"
  on public.chat_messages
  for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          (r.type = 'dm' and (select auth.uid()) = any(r.participant_ids))
          or (r.type = 'community' and r.is_archived = false)
          or (
            r.type = 'tier'
            and r.is_archived = false
            and public.membership_tier_rank((select public.current_user_membership_tier()))
                >= public.membership_tier_rank(r.tier_required)
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Escribir en ella
-- ---------------------------------------------------------------------------
-- El insert tenia el mismo hueco: dejaba escribir en cualquier sala de tier.
-- Se conservan tal cual las comprobaciones de baneo y muteo.

drop policy if exists "chat_messages_insert_member" on public.chat_messages;
create policy "chat_messages_insert_member"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and r.is_archived = false
        and (
          (r.type = 'dm' and (select auth.uid()) = any(r.participant_ids))
          or r.type = 'community'
          or (
            r.type = 'tier'
            and public.membership_tier_rank((select public.current_user_membership_tier()))
                >= public.membership_tier_rank(r.tier_required)
          )
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

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Las tres policies mencionan tier_required. Esperado: 3 filas.
--
-- select policyname from pg_policies
--  where schemaname = 'public'
--    and (qual like '%tier_required%' or with_check like '%tier_required%');
--
-- b) LA PRUEBA DE VERDAD, que no es SQL:
--
--      npm run test:aislamiento
--
--    Crea alumnas temporales de cada plan y comprueba, con el JWT de cada una,
--    que no llegue a lo que no le corresponde -- por REST y por realtime, que
--    son dos caminos de autorizacion distintos. Sin correr eso, esta migracion
--    esta sin verificar.
--
-- c) Que no haya roto lo que funcionaba: entrar como alumna con plan y
--    confirmar que sigue viendo SUS salas y puede escribir.
