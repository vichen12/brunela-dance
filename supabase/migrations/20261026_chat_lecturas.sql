-- Brunela Dance Trainer
-- 2026-10-26: hasta donde leyo cada persona cada chat.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   Pegar SOLO el SQL, sin `begin;` ni `commit;` (trampa 7 de CLAUDE.md).
--
-- POR QUE EXISTE
--   "A Brunela y a la gente no les llegan las notificaciones": nadie se
--   enteraba de un mensaje nuevo si no entraba a mirar. El sistema no guardaba
--   que habia leido cada una, asi que no habia forma de saber que era "nuevo".
--
--   Una fila por (persona, sala): `leido_hasta` es el momento hasta el que vio
--   esa sala. Todo mensaje de OTRA persona posterior a eso cuenta como no leido.
--   De ahi salen el numerito del menu (Mi chat, Comunidad, Mensajes), la
--   campanita y el contador de cada conversacion y canal.
--
-- QUIEN PUEDE QUE
--   Cada una lee y escribe SOLO sus propias filas. No guarda nada sensible: es
--   una marca de tiempo. Si alguien escribiera una fila para una sala que no
--   ve, no gana nada: los mensajes los sigue filtrando la RLS de chat_messages.
--
-- SIN ESTA MIGRACION LA APLICACION NO SE ROMPE
--   src/features/studio/chat-sin-leer.ts detecta que falta la tabla y cae en
--   una regla sin estado: en un chat directo, "no leido" = la ultima palabra es
--   de la otra persona. Los canales no muestran contador hasta correrla.

begin;

create table if not exists public.chat_lecturas (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  leido_hasta timestamptz not null default timezone('utc', now()),
  primary key (user_id, room_id)
);

comment on table public.chat_lecturas is
  'Hasta donde leyo cada persona cada sala de chat. De aca salen los mensajes no leidos y las notificaciones. 20261026_chat_lecturas.sql';

alter table public.chat_lecturas enable row level security;

drop policy if exists "chat_lecturas_select_propias" on public.chat_lecturas;
create policy "chat_lecturas_select_propias" on public.chat_lecturas
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "chat_lecturas_insert_propias" on public.chat_lecturas;
create policy "chat_lecturas_insert_propias" on public.chat_lecturas
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "chat_lecturas_update_propias" on public.chat_lecturas;
create policy "chat_lecturas_update_propias" on public.chat_lecturas
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sin DELETE: una lectura no se borra, se adelanta. Y anon, nada.
revoke all on public.chat_lecturas from anon, authenticated;
grant select, insert, update on public.chat_lecturas to authenticated;
grant all on public.chat_lecturas to service_role;

-- Que la Data API vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- VERIFICACION (despues de correrla)
--
--   select count(*) from public.chat_lecturas;        -- 0, sin error
--   select polname from pg_policy where polrelid = 'public.chat_lecturas'::regclass;
--     -- chat_lecturas_select_propias, _insert_propias, _update_propias
--
--   Por comportamiento: abrir un chat en la app y despues
--   select * from public.chat_lecturas;  -- aparece una fila con tu user_id
-- =============================================================================
