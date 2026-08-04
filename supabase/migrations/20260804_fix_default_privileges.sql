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

-- ---------------------------------------------------------------------------
-- 3. COMPROBACION QUE NO SE PUEDE PASAR POR ALTO
-- ---------------------------------------------------------------------------
-- El bloque 2 arregla el default DEL ROL QUE CORRE ESTA MIGRACION. Si el
-- default de Supabase estuviera declarado para otro rol (supabase_admin, por
-- ejemplo) y las tablas las creara ESE rol, el arreglo no serviria de nada y no
-- habria forma de notarlo hasta crear la proxima tabla, dentro de dos meses.
--
-- Asi que en vez de confiar, se prueba: se crea una tabla de verdad, se miran
-- sus permisos y se borra. Si nace con algo mas que SELECT, esto lanza una
-- excepcion y, como estamos dentro de la transaccion, la migracion ENTERA se
-- revierte. Preferible a que se aplique a medias y parezca que funciono.

do $$
declare
  sobrantes text;
  otros     text;
begin
  create table public.zz_chequeo_permisos (id int);

  select string_agg(privilege_type, ', ' order by privilege_type)
    into sobrantes
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name   = 'zz_chequeo_permisos'
    and grantee      = 'authenticated'
    and privilege_type <> 'SELECT';

  drop table public.zz_chequeo_permisos;

  if sobrantes is not null then
    raise exception
      'Una tabla nueva TODAVIA nace con % para authenticated. El default que '
      'manda no es el de % (el rol que corre esto). Correr la consulta (c) de '
      'abajo, mirar la columna lo_creo, y repetir el bloque 2 con '
      '"alter default privileges FOR ROLE <ese rol> ...". No se aplico nada.',
      sobrantes, current_user;
  end if;

  -- Aviso, no error: una entrada de otro rol solo molesta si ese rol llega a
  -- crear tablas, cosa que hoy no pasa. Pero conviene verlo.
  select string_agg(distinct pg_get_userbyid(d.defaclrole)::text, ', ')
    into otros
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname        = 'public'
    and d.defaclobjtype  = 'r'
    and pg_get_userbyid(d.defaclrole) <> current_user
    and exists (
      select 1 from aclexplode(d.defaclacl) a
      where a.grantee = 'authenticated'::regrole
        and a.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    );

  if otros is not null then
    raise notice
      'AVISO: los roles [%] tambien tienen un default con TRUNCATE/REFERENCES/'
      'TRIGGER para authenticated. Hoy no afecta porque las tablas las crea %, '
      'pero si alguna vez se crea una tabla desde otra herramienta, revisarlo.',
      otros, current_user;
  end if;

  raise notice 'OK: una tabla nueva nace solo con SELECT para authenticated.';
end $$;

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
-- e) La prueba de fuego YA VA ADENTRO (bloque 3): la migracion crea una tabla,
--    le mira los permisos y la borra. Si nace con algo mas que SELECT, lanza
--    excepcion y se revierte todo. O sea que si esto commiteo, (e) paso.
--
--    En la salida del SQL Editor tienen que aparecer estos avisos:
--      NOTICE: OK: una tabla nueva nace solo con SELECT para authenticated.
--    y, si hay defaults de otros roles, un AVISO que no impide nada.
--
-- f) Que el registro de actividad SIGA funcionando despues de esto: reproducir
--    una clase mas de un minuto y confirmar que entran filas.
--
-- select count(*) from public.activity_events;
