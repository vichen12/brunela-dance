-- Brunela Dance Trainer
-- 2026-10-09: acceso gratis por tiempo, otorgado por la admin.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7). El editor
--    ya envuelve lo pegado en su transaccion; un `commit;` propio la cierra antes
--    de tiempo y lo que sigue no persiste, con "Success" en pantalla. Este
--    archivo no trae ninguno a proposito: se pega entero.
--
-- ⚠️ ORDEN: va al FINAL, despues de todo (SETUP.md § 1.1). Redefine
--    `protect_profile_admin_fields()`, cuya version vigente hasta hoy es la de
--    `20260801_studio_owner_explicit.sql` (la 16). Corrida antes que esa, la 16
--    la pisaria y las columnas nuevas quedarian escribibles por la alumna, sin
--    ningun error (trampa 8). Ninguna migracion posterior a la 16 la redefine:
--    verificado con grep el 2026-10-09.
--
-- QUE PIDIO BRUNELA
--   "Que la admin pueda crear usuarias y darles los meses gratis que quiera; que
--   cuando se termine les diga 'la prueba gratis termino, vas a tener que
--   pagar', pero bien."
--
-- COMO FUNCIONA
--   - La admin le pone a una alumna un plan (membership_tier) y una fecha de fin
--     (acceso_gratis_hasta). Mientras dura, el plan da acceso por las mismas
--     policies de siempre: NO se toca ninguna policy. Es un plan como cualquier
--     otro, puesto a mano, con fecha de vencimiento.
--   - Al vencer, el cron diario (/api/cron/keepalive) y el layout del dashboard
--     la pasan a 'none' si no tiene una suscripcion que de acceso. La fecha NO
--     se borra: es lo que muestra el aviso "tu prueba gratis termino".
--   - Si paga, el webhook de Stripe pone acceso_gratis_hasta = null: ya no es
--     una alumna de prueba.
--
-- QUE NO HACE
--   - No hay un job en la base (pg_cron): la baja la aplica la aplicacion. Si un
--     dia el cron no corre, la baja igual ocurre la proxima vez que ella entra
--     al dashboard.

-- 1. Columnas ------------------------------------------------------------------

alter table public.profiles
  add column if not exists acceso_gratis_hasta timestamptz null,
  add column if not exists acceso_gratis_desde timestamptz null,
  add column if not exists acceso_gratis_plan public.membership_tier null,
  add column if not exists acceso_gratis_otorgado_por uuid null
    references public.profiles (id) on delete set null,
  add column if not exists acceso_gratis_aviso_visto_at timestamptz null;

comment on column public.profiles.acceso_gratis_hasta is
  'Fin del acceso gratis otorgado por la admin. Se CONSERVA al vencer (sirve para el aviso); se pone en null si paga o si la admin lo quita.';
comment on column public.profiles.acceso_gratis_desde is
  'Desde cuando corre el acceso gratis vigente. Solo para la barra de progreso de la alumna.';
comment on column public.profiles.acceso_gratis_plan is
  'Plan que se le regalo. membership_tier es el que da acceso; esta columna recuerda cual fue el regalo para el aviso y la ficha.';
comment on column public.profiles.acceso_gratis_otorgado_por is
  'Admin que otorgo el acceso gratis.';
comment on column public.profiles.acceso_gratis_aviso_visto_at is
  'Cuando la alumna cerro el aviso de fin de prueba. Es la UNICA de estas columnas que ella puede escribir.';

-- Un regalo es un plan de verdad: 'none' no tiene sentido como plan regalado.
alter table public.profiles
  drop constraint if exists profiles_acceso_gratis_plan_valido;
alter table public.profiles
  add constraint profiles_acceso_gratis_plan_valido
  check (acceso_gratis_plan is null or acceso_gratis_plan <> 'none');

-- Para el cron: solo indexa a quien tiene o tuvo acceso gratis, que son pocas.
create index if not exists idx_profiles_acceso_gratis_hasta
  on public.profiles (acceso_gratis_hasta)
  where acceso_gratis_hasta is not null;

-- 2. Proteccion de columnas -----------------------------------------------------
--
-- `authenticated` tiene UPDATE sobre profiles a nivel tabla (migracion 18), y la
-- policy profiles_update_self_or_admin la deja actualizar SU fila. Lo unico que
-- impide que una alumna se regale un año de Principal es este trigger.
--
-- COPIA ENTERA de la version vigente (20260801_studio_owner_explicit.sql).
-- Lo unico que cambia esta marcado con  -- NUEVO 20261009.
--
-- 🔴 LA GUARDA `auth.uid() is not null and` SE CONSERVA (trampa 1). Sin ella el
--    trigger revierte tambien las escrituras de service_role: el webhook de
--    Stripe, /admin/users y la baja automatica del cron dejarian de escribir,
--    sin ningun error.
--
-- `acceso_gratis_aviso_visto_at` NO se protege a proposito: es la marca de
-- "ya vi el aviso" y la escribe ella al cerrarlo.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.membership_tier = old.membership_tier;
    new.is_admin        = old.is_admin;
    new.email           = old.email;
    new.is_studio_owner = old.is_studio_owner;
    new.acceso_gratis_hasta        = old.acceso_gratis_hasta;         -- NUEVO 20261009
    new.acceso_gratis_desde        = old.acceso_gratis_desde;         -- NUEVO 20261009
    new.acceso_gratis_plan         = old.acceso_gratis_plan;          -- NUEVO 20261009
    new.acceso_gratis_otorgado_por = old.acceso_gratis_otorgado_por;  -- NUEVO 20261009
  end if;

  return new;
end;
$$;

-- El trigger que la llama (trg_protect_profile_admin_fields, de phase_a) no se
-- toca: `create or replace function` cambia el cuerpo y el trigger sigue
-- apuntando a la misma funcion.

-- =============================================================================
-- VERIFICACION (correr DESPUES, por separado; no hace falta pegarla con lo de
-- arriba)
-- =============================================================================
--
-- a) Las cinco columnas existen:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name like 'acceso_gratis%'
--    order by column_name;
--   -- 5 filas
--
-- b) La funcion vigente es ESTA (y conserva la guarda de la trampa 1):
--
--   select position('auth.uid() is not null' in prosrc) > 0 as guarda,
--          position('acceso_gratis_plan' in prosrc) > 0     as protege_gratis,
--          position('acceso_gratis_aviso_visto_at' in prosrc) = 0 as aviso_libre
--     from pg_proc
--    where proname = 'protect_profile_admin_fields';
--   -- true | true | true
--
-- c) Por COMPORTAMIENTO, no por metadatos (trampa 7): con una cuenta de
--    prueba sin admin, desde la app o con su JWT,
--      update profiles set acceso_gratis_hasta = now() + interval '1 year',
--                          acceso_gratis_aviso_visto_at = now()
--       where id = auth.uid();
--    -> acceso_gratis_hasta queda COMO ESTABA; aviso_visto_at SI cambia.
--
-- d) Quien esta hoy con acceso gratis:
--
--   select email, membership_tier, acceso_gratis_plan, acceso_gratis_hasta
--     from profiles where acceso_gratis_hasta is not null
--    order by acceso_gratis_hasta;
