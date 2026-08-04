-- Brunela Dance Trainer
-- Diagnostico: hay 22 tablas en public y las migraciones crean 21.
--
-- NO MODIFICA NADA. Son cuatro consultas de lectura.
--
-- LO QUE YA SE SABE SIN MIRAR LA BASE
--   Las migraciones del repo crean exactamente 21 tablas: las 20 originales
--   mas activity_events. Ninguna las crea de mas.
--
--   Y el conteo de policies cuadra EXACTO: eran 43, la migracion de
--   activity_events agrega 2, y reportaste 45. O sea que **la tabla de mas no
--   tiene ni una policy**. Eso es lo que la vuelve interesante: si ademas
--   tiene RLS apagada, esta expuesta por el Data API sin ningun filtro.
--
--   Tampoco la consulta el codigo: ninguna ruta de la app la nombra.
--
-- DE DONDE SUELE SALIR ALGO ASI
--   - se creo a mano desde el Table Editor del panel
--   - quedo de la migracion desde el proyecto viejo (tabla de apoyo sin borrar)
--   - la dejo alguna extension de Postgres

-- ---------------------------------------------------------------------------
-- 1. CUAL ES. Comparar contra la lista de las 21 conocidas.
-- ---------------------------------------------------------------------------
select
  c.relname                                as tabla,
  c.relrowsecurity                         as rls_activa,
  pg_get_userbyid(c.relowner)              as dueno,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies,
  pg_size_pretty(pg_total_relation_size(c.oid)) as tamano,
  (select count(*) from pg_attribute a
    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columnas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in (
    'activity_events', 'categories', 'chat_bans', 'chat_messages', 'chat_mutes',
    'chat_rooms', 'documents', 'live_session_access_links',
    'live_session_bookings', 'live_sessions', 'profiles', 'program_days',
    'programs', 'reward_claims', 'site_settings', 'studio_announcements',
    'subscription_webhook_events', 'subscriptions', 'user_progress',
    'video_mux_jobs', 'videos'
  )
order by c.relname;

-- ---------------------------------------------------------------------------
-- 2. LA PREGUNTA QUE IMPORTA: hay alguna tabla sin RLS?
-- ---------------------------------------------------------------------------
-- Es la verificacion (b) de la migracion 17, que hoy deberia estar fallando.
-- Esperado: cero filas. Si devuelve la tabla de mas, es un agujero real.

select c.relname as tabla_sin_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity;

-- ---------------------------------------------------------------------------
-- 3. Quien puede tocarla
-- ---------------------------------------------------------------------------
-- Si `anon` aparece aca, cualquiera en internet la alcanza con la clave
-- publica. Reemplazar <TABLA> por lo que devuelva la consulta 1.

-- select grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
--   from information_schema.role_table_grants
--  where table_schema = 'public' and table_name = '<TABLA>'
--    and grantee in ('anon','authenticated','service_role')
--  group by grantee order by grantee;

-- ---------------------------------------------------------------------------
-- 4. Que tiene adentro y como se ve
-- ---------------------------------------------------------------------------
-- Antes de decidir si se borra hay que saber si tiene datos de alguien.

-- select * from public.<TABLA> limit 20;

-- ---------------------------------------------------------------------------
-- QUE HACER CON EL RESULTADO
-- ---------------------------------------------------------------------------
-- ⚠️ NO BORRARLA TODAVIA. Primero pasame lo que devuelvan 1 y 2.
--
--   - Si tiene 0 filas y ninguna policy: casi seguro es basura de la migracion
--     o una prueba. Se borra, con una migracion que lo deje escrito.
--   - Si tiene filas: hay que ver de quien son antes de tocar nada.
--   - Si ademas sale en la consulta 2 (sin RLS), eso se arregla ANTES que
--     cualquier otra cosa, aunque despues se borre.
