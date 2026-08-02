-- Brunela Dance Trainer
-- 2026-08-01: authenticated pasa a solo-lectura en 14 de las 20 tablas.
-- Target: Supabase Postgres. Correr DESPUES de 20260801_data_api_grants.sql.
--
-- POR QUE
--   La 17 dejo a authenticated con select/insert/update/delete sobre las 20
--   tablas, que es el modelo estandar de Supabase: grants gruesos, RLS fina.
--   Pero una auditoria de TODAS las rutas de escritura del proyecto mostro que
--   una alumna logueada solo escribe en SEIS tablas. Sobre las otras catorce
--   tenia DELETE sin que ninguna linea de codigo lo use.
--
--   Es el mismo argumento por el que anon quedo en cero, un nivel mas adentro:
--   un privilegio que nadie ejerce es superficie de ataque que solo depende de
--   que ninguna policy de RLS este mal escrita. Con esto, aunque una policy de
--   `videos` quedara mal, authenticated no puede borrar nada ahi.
--
-- AUDITORIA (2026-08-01), rutas de escritura con CLIENTE DE SESION
--
--     tabla                    insert  update  delete   donde
--     ---------------------------------------------------------------------
--     user_progress              si      si      no     studio/actions.ts,
--                                                       api/progress/route.ts
--     live_session_bookings      si      si      no     studio/actions.ts
--     chat_messages              si      si      no     chat-room.tsx
--     chat_mutes                 si      si      no     chat-room.tsx (upsert)
--     chat_rooms                 si      no      no     dashboard/chat (DM)
--     profiles                   si      si*     no     auth/callback (upsert)
--
--   Las otras 14 -- categories, chat_bans, documents,
--   live_session_access_links, live_sessions, program_days, programs,
--   reward_claims, site_settings, studio_announcements,
--   subscription_webhook_events, subscriptions, video_mux_jobs, videos --
--   no reciben ninguna escritura por sesion. Todo lo que las toca pasa por
--   service_role.
--
--   DELETE: los 10 `.delete()` del repositorio usan createSupabaseAdminClient().
--   Ni uno usa el cliente de sesion. Por eso authenticated se queda SIN DELETE
--   en las 20 tablas, no solo en las 14.
--
--   (*) profiles.UPDATE se otorga aunque hoy ninguna ruta de miembro lo use.
--   Es la unica concesion por encima de lo verificado, y es deliberada: la
--   policy profiles_update_self_or_admin existe y el trigger
--   protect_profile_admin_fields ya acota que columnas importan, asi que la
--   edicion de perfil que figura como proximo paso en CLAUDE.md va a
--   necesitarlo. Sin esto fallaria con "permission denied", que es un error
--   mas confuso que el de RLS.
--
-- SI ESTO ROMPE ALGO
--   El sintoma es 42501 permission denied for table X en una accion de miembro.
--   Se arregla otorgando la operacion puntual sobre esa tabla, no volviendo al
--   grant global.

begin;

-- 1. Punto de partida: solo lectura en las 20.
revoke insert, update, delete, truncate on all tables in schema public from authenticated;

-- 2. Y de vuelta, exactamente lo que la app ejerce.
grant insert, update on
  public.user_progress,
  public.live_session_bookings,
  public.chat_messages,
  public.chat_mutes,
  public.profiles
to authenticated;

-- chat_rooms: solo INSERT. La alumna crea su DM con la profesora; archivar y
-- renombrar son acciones de admin y van por service_role.
grant insert on public.chat_rooms to authenticated;

-- 3. Tablas futuras: solo lectura por defecto. Si una necesita escritura de
--    miembro, se otorga explicitamente en la migracion que la crea.
alter default privileges in schema public
  revoke insert, update, delete on tables from authenticated;

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Esperado: 14 tablas con solo SELECT, 5 con SELECT/INSERT/UPDATE,
--    1 (chat_rooms) con SELECT/INSERT. Ninguna con DELETE.
--
-- select table_name,
--        string_agg(privilege_type, ', ' order by privilege_type) as permisos
-- from information_schema.role_table_grants
-- where table_schema = 'public' and grantee = 'authenticated'
-- group by table_name
-- order by permisos, table_name;
--
-- b) Nadie con DELETE salvo service_role. Esperado: cero filas.
--
-- select table_name, grantee from information_schema.role_table_grants
-- where table_schema = 'public'
--   and privilege_type = 'DELETE'
--   and grantee in ('anon','authenticated');
--
-- c) Las pruebas a mano que cubren las 6 tablas escribibles:
--    1. reproducir una clase y que guarde la posicion   -> user_progress
--    2. reservar y cancelar una sesion en vivo          -> live_session_bookings
--    3. abrir el DM con la profesora por primera vez    -> chat_rooms
--    4. enviar un mensaje                               -> chat_messages
--    5. entrar con Google con una cuenta nueva          -> profiles
--    Si alguna falla con 42501, es esta migracion.
