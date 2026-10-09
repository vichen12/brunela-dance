-- Brunela Dance Trainer
-- 2026-10-09: registro de correos enviados (para no mandar nunca dos veces).
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7). El editor
--    ya envuelve lo pegado en su transaccion; un `commit;` propio la cierra antes
--    de tiempo y lo que sigue no persiste, con "Success" en pantalla. Este
--    archivo no trae ninguno a proposito: se pega entero.
--
-- ⚠️ ORDEN: va al FINAL, despues de todo (SETUP.md § 1.1). Necesita `profiles`
--    e `is_admin()` (phase_a), y tiene que correr DESPUES de
--    20260804_fix_default_privileges.sql: por eso trae su propio `grant`. No
--    redefine ninguna funcion ni toca ninguna policy existente.
--
-- POR QUE EXISTE
--   El estudio manda cinco correos propios: bienvenida, acceso gratis por
--   vencer, acceso gratis terminado, recordatorio de clase en vivo e invitacion
--   a una clase en vivo. Los dispara el webhook de Stripe (que REINTENTA), el
--   cron diario (que corre todos los dias sobre las mismas alumnas) y acciones
--   del panel (que se pueden apretar dos veces).
--
--   Resend acepta una Idempotency-Key, pero la recuerda 24 horas. El aviso "te
--   quedan 3 dias" se evaluaria tres dias seguidos, y un reintento de Stripe
--   puede llegar dias despues. Hace falta una memoria que no venza: esta tabla.
--
-- COMO FUNCIONA (src/features/correos/enviar-una-vez.ts)
--   1. Se RESERVA la clave con un INSERT. La primary key hace el resto: si dos
--      ejecuciones llegan a la vez, una gana y la otra recibe 23505 y no manda.
--   2. Se manda el correo.
--   3. Si salio, se guarda el id de Resend. Si fallo, se BORRA la reserva para
--      que la proxima ejecucion lo reintente.
--
--   Sin esta tabla la aplicacion NO MANDA NINGUN CORREO de estos (y lo avisa en
--   los registros): es mejor perder un aviso que mandarlo todos los dias.
--
-- LA CLAVE
--   Texto armado por la aplicacion, con el motivo y lo que lo hace unico:
--     bienvenida:<alumna>
--     gratis-por-vencer:<alumna>:<fecha de fin>
--     gratis-terminado:<alumna>:<fecha de fin>
--     recordatorio:<reserva>
--     invitacion:<sesion>:<alumna>
--   La fecha va en las del acceso gratis para que un regalo NUEVO pueda volver
--   a avisar.
--
-- DATO PERSONAL
--   `para` guarda la direccion a la que se mando: es lo que permite contestar
--   "¿me mandaron el correo?" sin entrar a Resend. `alumna_id` es `set null`
--   y no `cascade`: si se borra la cuenta, la fila queda sin dueña y se puede
--   limpiar a mano; el registro de lo que se envio no deberia desaparecer solo.

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------

create table if not exists public.correos_enviados (
  clave text primary key
    constraint correos_enviados_clave_corta check (char_length(clave) between 1 and 300),
  alumna_id uuid null references public.profiles (id) on delete set null,
  tipo text not null
    constraint correos_enviados_tipo_valido check (
      tipo in ('bienvenida', 'gratis_por_vencer', 'gratis_terminado', 'recordatorio_vivo', 'invitacion_vivo')
    ),
  para text not null,
  resend_id text null,
  enviado_at timestamptz not null default now()
);

comment on table public.correos_enviados is
  'Un correo transaccional por clave, nunca dos. Lo escribe solo service_role (src/features/correos/enviar-una-vez.ts).';
comment on column public.correos_enviados.resend_id is
  'Id del envio en Resend. null = reservado y todavia sin confirmar (o el envio esta en curso).';

-- "Los correos de esta alumna", para la ficha o para contestar un reclamo.
create index if not exists correos_enviados_alumna_idx
  on public.correos_enviados (alumna_id);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
-- Una sola policy, de lectura, SOLO para admins. Ninguna de escritura: quien
-- escribe es la aplicacion con service_role, que no pasa por RLS. Una alumna
-- no tiene nada que leer aca.

alter table public.correos_enviados enable row level security;

drop policy if exists "correos_enviados_select_admin" on public.correos_enviados;
create policy "correos_enviados_select_admin"
  on public.correos_enviados
  for select
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. Permisos
-- ---------------------------------------------------------------------------
-- ⚠️ Tabla nueva NO hereda nada: 20260804_fix_default_privileges dejo los
--    privilegios por defecto en cero. El `revoke all` deja la tabla en un
--    estado conocido aunque el proyecto tuviera otros defaults.

revoke all on public.correos_enviados from anon, authenticated;
grant select on public.correos_enviados to authenticated;

-- =============================================================================
-- VERIFICACION (correr DESPUES, por separado)
-- =============================================================================
--
-- a) La tabla existe con RLS activa:
--
--   select relname, relrowsecurity from pg_class
--    where oid = 'public.correos_enviados'::regclass;
--   -- correos_enviados | true
--
-- b) Permisos exactos: authenticated solo SELECT, anon nada.
--
--   select grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'correos_enviados'
--      and grantee in ('anon', 'authenticated')
--    order by grantee, privilege_type;
--   -- authenticated | SELECT      (y ninguna otra fila)
--
-- c) La primary key frena el segundo envio (por comportamiento, trampa 7).
--    Correr cada sentencia POR SEPARADO: el segundo insert tiene que fallar.
--
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar', 'bienvenida', 'x@example.com');
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar', 'bienvenida', 'x@example.com');
--   -- ERROR: duplicate key value violates unique constraint (23505)
--   delete from public.correos_enviados where clave = 'prueba:borrar';
