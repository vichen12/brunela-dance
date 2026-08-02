-- Brunela Dance Trainer
-- 2026-08-01: permisos de tabla del Data API, declarados en el repo.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE EXISTE
--   Ninguna de las 16 migraciones anteriores otorgaba UN SOLO permiso de tabla.
--   Todas dependian, sin decirlo, de que Supabase configurara los privilegios
--   por defecto del esquema public al crear el proyecto. Es el mismo problema
--   que past_due y la duena del estudio: una regla que vive en un toggle del
--   panel y no en el repo se pierde al reconstruir, en silencio.
--
--   Con "expose new tables" desactivado en el proyecto nuevo, las 20 tablas
--   podian nacer sin permisos y TODA consulta de la app devolver
--   "42501: permission denied for table X" -- que parece un problema de RLS y
--   no lo es: RLS ni llega a evaluarse.
--
-- QUE CAMBIA RESPECTO DEL DEFAULT DE SUPABASE
--   El proyecto viejo tenia, para las 20 tablas:
--     anon           DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     authenticated  idem
--     service_role   idem
--
--   Aca anon queda SIN NINGUN privilegio de tabla. Verificado el 2026-08-01:
--   nada en la app consulta tablas como anon.
--     - la landing no toca Supabase
--     - middleware.ts solo llama auth.getSession() (API de auth, no PostgREST)
--     - oauth-buttons solo llama signInWithOAuth
--     - chat-room vive bajo /dashboard, siempre con sesion
--     - el upsert de /auth/callback corre DESPUES de exchangeCodeForSession,
--       o sea con JWT, o sea como authenticated
--
--   Y un alta futura tampoco lo necesita: signUp va por GoTrue contra el
--   esquema auth, y el perfil lo crea handle_new_user(), que es SECURITY
--   DEFINER y corre con los permisos de su dueno, no con los del visitante.
--
-- POR QUE IMPORTA
--   La publishable key es PUBLICA por diseno: viaja en el bundle del navegador.
--   "anon" no es "visitante confiable", es "cualquiera en internet". Con los
--   privilegios del default, una sola tabla que quede sin RLS por error queda
--   expuesta a DELETE por cualquiera.
--
--   Nota sobre TRUNCATE: RLS NO se aplica a truncate, Postgres solo evalua
--   politicas para select/insert/update/delete. No era alcanzable con la anon
--   key porque PostgREST nunca emite truncate, pero es un privilegio sin
--   ningun motivo para existir.
--
-- ESTO NO REEMPLAZA A RLS
--   Los grants son gruesos; RLS es el control fino. authenticated conserva DML
--   sobre todas las tablas y lo que decide que fila puede tocar es la politica.
--   Por eso la verificacion "RLS activa en las 20 tablas" no es un lujo: es la
--   que sostiene el modelo.

begin;

-- Poder "ver" el esquema. Sin esto el error cambia de forma y confunde el
-- diagnostico; el control real son los privilegios de tabla de abajo.
grant usage on schema public to anon, authenticated, service_role;

-- Partir de cero para que la migracion sea idempotente y no dependa de que
-- habia antes.
revoke all on all tables    in schema public from anon;
revoke all on all tables    in schema public from authenticated;
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;

-- anon: NADA. Ver el bloque de arriba.

-- authenticated: exactamente lo que PostgREST puede emitir. Sin TRUNCATE, sin
-- REFERENCES, sin TRIGGER. RLS decide cada fila.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- service_role: es el camino de administracion y salta RLS por diseno.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Y lo mismo para las tablas FUTURAS, para no repetir el problema con la
-- proxima tabla que alguien agregue.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;

commit;

-- =============================================================================
-- LIMITACION CONOCIDA
-- =============================================================================
--
-- `alter default privileges` aplica a los objetos que cree EL ROL QUE CORRE
-- ESTA MIGRACION. Una tabla creada por otro rol (por ejemplo desde el Table
-- Editor del panel, o por tooling de Supabase) puede volver a nacer con los
-- privilegios del default de Supabase.
--
-- Por eso la verificacion de abajo va a la lista de control del deploy, no se
-- corre una sola vez: si anon vuelve a aparecer con privilegios, se vuelve a
-- correr esta migracion.

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) anon NO debe aparecer. Esperado: solo authenticated (4 privilegios sobre
--    20 tablas) y service_role.
--
-- select grantee,
--        count(distinct table_name) as tablas,
--        string_agg(distinct privilege_type, ', ' order by privilege_type) as permisos
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee in ('anon','authenticated','service_role')
-- group by grantee
-- order by grantee;
--
-- b) LA QUE SOSTIENE TODO: RLS activa en las 20 tablas.
--    Tiene que devolver CERO FILAS.
--
-- select relname from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
