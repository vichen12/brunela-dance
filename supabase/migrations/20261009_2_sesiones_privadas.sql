-- Brunela Dance Trainer
-- 2026-10-09: sesiones privadas 1 a 1 (lo que promete el plan Principal).
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7). El editor
--    ya envuelve lo pegado en su transaccion; un `commit;` propio la cierra antes
--    de tiempo y lo que sigue no persiste, con "Success" en pantalla. Este
--    archivo no trae ninguno a proposito: se pega entero.
--
-- ⚠️ ORDEN: va al FINAL, despues de todo (SETUP.md § 1.1). Necesita
--    `profiles`, `is_admin()` y `set_current_timestamp_updated_at()` (phase_a),
--    y tiene que correr DESPUES de 20260804_fix_default_privileges.sql: por eso
--    trae su propio `grant`. No redefine ninguna funcion ni toca ninguna policy
--    existente: es una tabla nueva y nada mas.
--
-- QUE PIDIO BRUNELA
--   El plan Principal promete "2 clases en vivo al mes en formato privado".
--   Hasta hoy no habia donde anotarlas: se coordinaban por chat y nadie sabia
--   cuantas llevaba cada alumna en el mes.
--
-- COMO FUNCIONA
--   - Una fila = una sesion privada con UNA alumna: fecha, duracion, enlace
--     (Meet o Zoom, opcional: se puede cargar despues) y una nota.
--   - La agenda Brunela desde la ficha de la alumna o desde
--     /admin/sesiones-privadas. Al agendar, cambiar o cancelar, la aplicacion le
--     escribe a la alumna por el chat privado.
--   - La alumna la ve en su inicio y en /dashboard/sesiones-privadas, con el
--     boton "Unirse" desde 15 minutos antes.
--
-- QUE NO HACE
--   - No limita a 2 por mes. El cupo se MUESTRA (X/2) pero no se impone: una
--     sesion de reposicion o un regalo no tienen por que pelear con la base.
--   - No mira el plan. Brunela puede agendarle una privada a cualquiera; la
--     lista de /admin/sesiones-privadas parte de las de Principal, nada mas.

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------
-- `estado` es texto con check y no un enum a proposito: agregar un valor a un
-- enum es un `alter type` que no se puede correr en la misma transaccion que
-- lo usa (ver phase_b0). Con un check, se cambia en una sola migracion.
--
-- `proveedor` se DEDUCE del enlace en la aplicacion (src/features/studio/
-- enlace-clase.ts), igual que en las clases en vivo. Se guarda para no tener
-- que parsear la URL en cada listado.

create table if not exists public.sesiones_privadas (
  id uuid primary key default gen_random_uuid(),
  alumna_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  duracion_minutos integer not null default 60
    constraint sesiones_privadas_duracion_valida check (duracion_minutos between 15 and 240),
  enlace text null
    constraint sesiones_privadas_enlace_https check (enlace is null or enlace like 'https://%'),
  proveedor text null
    constraint sesiones_privadas_proveedor_valido check (proveedor is null or proveedor in ('zoom', 'meet', 'otro')),
  nota text null
    constraint sesiones_privadas_nota_corta check (nota is null or char_length(nota) <= 1000),
  estado text not null default 'agendada'
    constraint sesiones_privadas_estado_valido check (estado in ('agendada', 'cancelada', 'hecha')),
  -- `set null` y no `cascade`: si algun dia se borra la cuenta que la agendo,
  -- la sesion de la alumna sigue en pie. Se pierde quien la hizo, no la cita.
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.sesiones_privadas is
  'Sesiones privadas 1 a 1 (plan Principal: 2 por mes). Las escribe solo la admin por service_role; la alumna lee las suyas.';
comment on column public.sesiones_privadas.enlace is
  'Enlace de Meet o Zoom. Opcional: se puede cargar despues. Solo https.';
comment on column public.sesiones_privadas.estado is
  'agendada | cancelada | hecha. Una agendada que ya paso se muestra como hecha sin escribir nada.';

-- Como pregunta cada pantalla: "las de esta alumna, por fecha" (su pagina, la
-- ficha, el X/2 del mes) y "las de este rango" (calendario, recordatorios).
create index if not exists sesiones_privadas_alumna_inicio_idx
  on public.sesiones_privadas (alumna_id, starts_at);
create index if not exists sesiones_privadas_inicio_idx
  on public.sesiones_privadas (starts_at);

drop trigger if exists trg_sesiones_privadas_updated_at on public.sesiones_privadas;
create trigger trg_sesiones_privadas_updated_at
  before update on public.sesiones_privadas
  for each row execute procedure public.set_current_timestamp_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
-- Una sola policy, de lectura: la alumna ve las SUYAS y la admin todas.
--
-- NO hay policy de insert/update/delete para `authenticated`, y es el punto:
-- quien agenda es Brunela, por server actions con requireAdmin() y
-- service_role (que no pasa por RLS). Una policy de escritura para
-- `authenticated` seria dejar que una alumna se agende sola.

alter table public.sesiones_privadas enable row level security;

drop policy if exists "sesiones_privadas_select_propias_o_admin" on public.sesiones_privadas;
create policy "sesiones_privadas_select_propias_o_admin"
  on public.sesiones_privadas
  for select
  to authenticated
  using (
    (select auth.uid()) = alumna_id
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 3. Permisos
-- ---------------------------------------------------------------------------
-- ⚠️ Tabla nueva NO hereda nada: 20260804_fix_default_privileges dejo los
--    privilegios por defecto en cero. Sin esto, 42501 al primer SELECT.
--
-- El `revoke all` va primero por si el proyecto tuviera otros defaults (un
-- entorno reconstruido sin la 23): deja la tabla en un estado conocido.
-- Despues, SOLO SELECT para `authenticated`. Nada para `anon`.

revoke all on public.sesiones_privadas from anon, authenticated;
grant select on public.sesiones_privadas to authenticated;

-- =============================================================================
-- VERIFICACION (correr DESPUES, por separado; no hace falta pegarla con lo de
-- arriba)
-- =============================================================================
--
-- a) La tabla existe con RLS activa:
--
--   select relname, relrowsecurity
--     from pg_class
--    where oid = 'public.sesiones_privadas'::regclass;
--   -- sesiones_privadas | true
--
-- b) Permisos exactos: authenticated solo SELECT, anon nada.
--
--   select grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'sesiones_privadas'
--      and grantee in ('anon', 'authenticated')
--    order by grantee, privilege_type;
--   -- authenticated | SELECT      (y ninguna otra fila)
--
-- c) Una sola policy, de select:
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'sesiones_privadas';
--   -- sesiones_privadas_select_propias_o_admin | SELECT
--
-- d) Por COMPORTAMIENTO, no por metadatos (trampa 7): con una cuenta de
--    alumna, desde la app,
--      insert into sesiones_privadas (alumna_id, starts_at) values (auth.uid(), now());
--    -> 42501 (permission denied). Y un select devuelve solo las suyas.
