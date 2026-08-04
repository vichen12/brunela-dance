-- Brunela Dance Trainer
-- 2026-08-04: sacar TRUNCATE/REFERENCES/TRIGGER a authenticated y arreglar el
--             default para las tablas futuras.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- EL SINTOMA
--   activity_events tenia que quedar con SELECT e INSERT. Quedo con:
--
--     INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
--
--   TRUNCATE es el grave: vacia la tabla entera de un comando y **RLS no se
--   aplica a truncate** -- Postgres solo evalua politicas para select, insert,
--   update y delete. El diseno de solo-insercion se cae: no se puede editar
--   fila por fila, pero si borrar todo de una.
--
-- LA CAUSA -- NO ES LA MIGRACION 20
--   Es una asimetria en la 17 (20260801_data_api_grants.sql). Mira las dos:
--
--     linea 79:  alter default privileges ... revoke all on tables from anon;
--     linea 82:  alter default privileges ... grant select, insert, update,
--                delete on tables to authenticated;
--
--   A `anon` se le RESETEA el default antes de nada. A `authenticated` no: se
--   le hace un GRANT, que es ADITIVO. Un grant no quita lo que ya estaba, y lo
--   que ya estaba era el default de Supabase, que otorga ALL sobre las tablas
--   nuevas del esquema public.
--
--   Asi que el default real para authenticated nunca fue lo que decia la
--   migracion. La cadena completa:
--
--     Supabase al crear el proyecto ....... ALL (7 privilegios)
--     17 hace GRANT (aditivo) ............. sigue ALL
--     18 revoca insert, update, delete .... SELECT, TRUNCATE, REFERENCES, TRIGGER
--     20 hace grant select, insert ........ + INSERT  = los cinco del sintoma
--
--   Cuadra exacto con lo observado, y explica por que las 20 tablas viejas SI
--   estan bien: sobre ellas la 17 corrio `revoke all on all tables` (linea 62)
--   y la 18 `revoke ... truncate` (linea 56). Lo que quedo mal es el DEFAULT,
--   que solo afecta a las tablas creadas DESPUES.
--
-- O SEA QUE ESTO NO ERA UN PROBLEMA DE activity_events
--   Era una bomba para CUALQUIER tabla futura. activity_events fue la primera
--   que se creo despues de la 18 y por eso lo destapo.
--
-- QUE TAN EXPLOTABLE ES
--   Poco, y conviene decirlo con precision: PostgREST no emite TRUNCATE, asi
--   que no hay forma de dispararlo desde el Data API con una sesion de alumna.
--   Pero es un privilegio sin ningun motivo para existir, en la unica tabla
--   del sistema cuyo valor es que no se pueda reescribir. Se saca.

begin;

-- ---------------------------------------------------------------------------
-- 1. Las tablas que ya existen
-- ---------------------------------------------------------------------------
-- Va sobre TODAS y no solo sobre activity_events, a proposito: si alguna otra
-- tabla llego con estos privilegios de mas, esto la limpia tambien. Sobre las
-- que ya estan bien no hace nada.

revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all tables in schema public from anon;

-- Y dejar activity_events exactamente como corresponde, sin depender de que
-- habia antes.
revoke all    on public.activity_events from authenticated;
grant  select, insert on public.activity_events to authenticated;

-- ---------------------------------------------------------------------------
-- 2. El default para las tablas FUTURAS -- lo que de verdad estaba roto
-- ---------------------------------------------------------------------------
-- Primero RESETEAR y despues otorgar. Este es el paso que le faltaba a la 17:
-- sin el revoke previo, el grant se suma al default de Supabase en vez de
-- reemplazarlo.

alter default privileges in schema public revoke all on tables    from authenticated;
alter default privileges in schema public revoke all on sequences from authenticated;

-- Solo lectura por defecto, que es lo que la 18 decia querer. Una tabla nueva
-- que necesite escritura de miembro la otorga su propia migracion.
alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- anon: nada, ni ahora ni en el futuro. Idempotente.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) LA QUE MOTIVO ESTA MIGRACION. Esperado EXACTAMENTE dos filas:
--    INSERT y SELECT.
--
-- select privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name   = 'activity_events'
--    and grantee      = 'authenticated'
--  order by privilege_type;
--
-- b) Nadie con TRUNCATE en ninguna tabla. Esperado: cero filas.
--
-- select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--  where table_schema  = 'public'
--    and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')
--    and grantee in ('anon','authenticated');
--
-- c) EL DEFAULT, que es lo que evita que esto vuelva a pasar.
--    Para authenticated tiene que decir solo r (=SELECT) sobre tablas.
--
-- select pg_get_userbyid(d.defaclrole) as lo_creo,
--        n.nspname                     as esquema,
--        d.defaclobjtype               as tipo,   -- r = tabla, S = secuencia
--        d.defaclacl                   as permisos
--   from pg_default_acl d
--   join pg_namespace n on n.oid = d.defaclnamespace
--  where n.nspname = 'public';
--
--    En `permisos` se lee como  rol=PRIVILEGIOS/quien_lo_otorgo. Las letras:
--      r = select   a = insert   w = update   d = delete
--      D = TRUNCATE     x = references     t = trigger
--
--    ESPERADO para tablas: authenticated=r/postgres  (y service_role con todo).
--    Si aparece authenticated=arwdDxt/... , el reset no aplico -- ver (d).
--
-- d) SI (c) NO DA LO ESPERADO
--    `alter default privileges` solo afecta a los objetos que cree EL ROL que
--    corrio la migracion. Si el default de Supabase esta declarado para otro
--    rol (por ejemplo supabase_admin), hay que repetir el bloque 2 con
--    `for role <ese rol>`. La consulta (c) muestra en `lo_creo` de que rol es
--    cada entrada: si hay mas de una fila, hay mas de un default que arreglar.
--
-- e) PRUEBA DE FUEGO -- que una tabla nueva nazca bien.
--    Se crea, se mira y se borra:
--
-- create table public.zz_prueba_permisos (id int);
-- select privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='zz_prueba_permisos'
--    and grantee='authenticated';
--    ESPERADO: solo SELECT.
-- drop table public.zz_prueba_permisos;
--
-- f) Que el registro de actividad SIGA funcionando despues de esto: reproducir
--    una clase mas de un minuto y confirmar que entran filas.
--
-- select count(*) from public.activity_events;
