-- Brunela Dance Trainer
-- 2026-08-03: registro de actividad, solo-insercion.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE EXISTE
--   `user_progress` es un UPSERT: una fila por (alumna, clase), que el
--   reproductor reescribe cada ~10 segundos. Sirve para "segui donde ibas",
--   que es para lo que se hizo.
--
--   Pero eso significa que si una alumna mira una clase el lunes, el miercoles
--   y el viernes, en la base queda UNA fila con la fecha del viernes. El lunes
--   y el miercoles no existieron nunca.
--
--   Por eso hoy no se pueden calcular, y no se van a poder calcular nunca
--   mirando hacia atras:
--
--     - retencion y frecuencia de uso (semanal / mensual)
--     - tiempo medio de uso por alumna
--     - franjas horarias y dias de mayor actividad
--     - visualizaciones por clase (ver dos veces no cuenta dos veces)
--     - duracion media vista POR REPRODUCCION
--
--   El dato no se pierde por falta de tiempo: se destruye en cada guardado.
--   Esta tabla lo conserva.
--
-- NO REEMPLAZA A user_progress
--   Las dos conviven a proposito. `user_progress` responde "donde quedo esta
--   alumna en esta clase" con una sola fila y un indice; contestarlo agregando
--   eventos seria mas lento y mas fragil, y es la consulta que corre en cada
--   carga de la biblioteca. Esta tabla responde preguntas de historia.
--
-- POR QUE SOLO-INSERCION
--   Un registro de actividad que se puede editar no es un registro: es una
--   opinion. No se otorga UPDATE ni DELETE a `authenticated`, y no se crean
--   policies para esas operaciones, asi que ni una alumna ni una admin pueden
--   reescribir su propia historia desde la aplicacion. Las correcciones, si
--   alguna vez hacen falta, van por service_role y quedan a la vista.
--
-- ⚠️ LOS GRANTS DE ABAJO NO SON OPCIONALES
--   La migracion 20260801_authenticated_least_privilege.sql termina con:
--
--     alter default privileges in schema public
--       revoke insert, update, delete on tables from authenticated;
--
--   O sea que toda tabla creada DESPUES de esa nace sin INSERT para
--   `authenticated`. Sin el grant explicito de mas abajo, el primer heartbeat
--   del reproductor falla con `42501 permission denied for table
--   activity_events` y no se registra un solo evento. La propia migracion 18
--   dice que se otorga en la migracion que crea la tabla; esto es eso.
--
-- CRECIMIENTO
--   Un heartbeat por minuto de reproduccion. Una clase de 40 minutos deja ~42
--   filas por alumna y por vez. Con 100 alumnas activas y 3 clases por semana
--   son ~55.000 filas al mes, que para Postgres no es nada, pero conviene
--   revisarlo al ano. La salida, cuando haga falta, es agregar por dia a una
--   tabla resumen y podar lo viejo -- no dejar de registrar.

begin;

create table if not exists public.activity_events (
  -- bigint identity y no uuid: es una tabla de solo-agregado que se consulta
  -- por rangos de fecha. Las claves secuenciales se insertan al final del
  -- indice en vez de dispersarse, que es justo lo que conviene aca.
  id               bigint generated always as identity primary key,

  user_id          uuid not null references auth.users (id) on delete cascade,

  -- Que paso. El check evita que un typo del cliente cree un tipo de evento
  -- fantasma que despues no aparece en ninguna metrica.
  event_type       text not null,

  -- Cuando paso, en la zona del servidor. De aca salen las franjas horarias y
  -- los dias de mayor uso.
  occurred_at      timestamptz not null default now(),

  -- Que clase. `on delete set null` y no cascade: si Brunela borra una clase,
  -- la historia de que se uso NO se borra. Se pierde el vinculo, no el hecho.
  video_id         uuid references public.videos (id) on delete set null,
  program_id       uuid references public.programs (id) on delete set null,

  -- Copia del slug al momento del evento, para que "las clases mas vistas"
  -- siga teniendo nombre despues de que la clase se borre o se renombre.
  video_slug       text,

  -- Agrupa los eventos de UNA reproduccion. Sin esto no se puede distinguir
  -- "una alumna vio la clase entera" de "cinco alumnas vieron el primer
  -- minuto", que es exactamente la diferencia que Brunela quiere ver.
  session_id       uuid,

  -- Donde estaba el cabezal. Sirve para el punto de abandono.
  position_seconds integer check (position_seconds is null or position_seconds >= 0),

  -- Segundos REALMENTE reproducidos desde el evento anterior, no diferencia de
  -- posicion. Si adelanta 10 minutos, la posicion salta pero esto suma ~0: es
  -- lo que hace que "tiempo de uso" mida uso y no manoseo de la barra.
  seconds_watched  integer check (seconds_watched is null or seconds_watched >= 0),

  metadata         jsonb not null default '{}'::jsonb,

  constraint activity_events_event_type_check check (
    event_type in ('video_start', 'video_heartbeat', 'video_complete')
  )
);

comment on table public.activity_events is
  'Registro de actividad solo-insercion. Conserva la historia que user_progress '
  'pisa en cada upsert. Ver el encabezado de 20260803_activity_events.sql.';

-- Linea de tiempo de una alumna: inactividad, frecuencia, retencion.
create index if not exists idx_activity_events_user_time
  on public.activity_events (user_id, occurred_at desc);

-- Metricas por clase: visualizaciones, duracion media, contenido sin uso.
create index if not exists idx_activity_events_video_time
  on public.activity_events (video_id, occurred_at desc)
  where video_id is not null;

-- Series temporales globales: franjas horarias, dias de mayor uso.
create index if not exists idx_activity_events_time
  on public.activity_events (occurred_at desc);

-- Reconstruir una reproduccion completa a partir de sus heartbeats.
create index if not exists idx_activity_events_session
  on public.activity_events (session_id, occurred_at)
  where session_id is not null;

alter table public.activity_events enable row level security;

-- Lectura: la propia alumna y las admin. Brunela necesita ver todo para el
-- panel; una alumna solo lo suyo.
drop policy if exists "activity_events_select_own_or_admin" on public.activity_events;
create policy "activity_events_select_own_or_admin"
  on public.activity_events
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Escritura: cada quien registra lo suyo y nada mas. A diferencia del resto
-- del esquema, aca NO se agrega `or is_admin()`: una admin insertando eventos
-- a nombre de otra persona ensuciaria las metricas sin dejar rastro.
drop policy if exists "activity_events_insert_own" on public.activity_events;
create policy "activity_events_insert_own"
  on public.activity_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No hay policy de UPDATE ni de DELETE. Es deliberado: sin policy, la
-- operacion no existe para `authenticated` aunque alguien otorgara el grant
-- por error mas adelante. Son las dos cerraduras del solo-insercion.

-- Ver la advertencia del encabezado: sin esto, 42501 en el primer heartbeat.
grant select, insert on public.activity_events to authenticated;

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Permisos: esperado exactamente INSERT y SELECT. Si aparece UPDATE o
--    DELETE, algo mas los otorgo y el solo-insercion ya no se sostiene.
--
-- select privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name   = 'activity_events'
--    and grantee      = 'authenticated'
--  order by privilege_type;
--
-- b) RLS activa y exactamente DOS policies (select e insert):
--
-- select relrowsecurity from pg_class where relname = 'activity_events';
--   esperado: true
--
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'activity_events'
--  order by policyname;
--   esperado: activity_events_insert_own | INSERT
--             activity_events_select_own_or_admin | SELECT
--
-- c) El conteo de tablas de public sube de 20 a 21, y el de policies de 43 a 45.
--
-- d) La prueba de verdad, con el reproductor: entrar como alumna, reproducir
--    una clase mas de un minuto, y despues
--
-- select event_type, count(*), max(occurred_at)
--   from public.activity_events group by event_type;
--
--    esperado: al menos un video_start y un video_heartbeat.
--    Si sale vacio y en la consola del navegador hay un 500 de /api/activity,
--    lo mas probable es que falte el grant de (a).
