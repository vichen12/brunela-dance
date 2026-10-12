-- Brunela Dance Trainer
-- 2026-10-12: aviso de clase nueva por correo, y "Mis correos" en Mi perfil.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7). El editor
--    ya envuelve lo pegado en su transaccion. Este archivo no trae ninguno: se
--    pega entero.
--
-- ⚠️ ORDEN: va al FINAL, despues de 20261009_3_correos_enviados.sql (le cambia
--    un CHECK a esa tabla) y de 20260803_marketing_consent.sql. No redefine
--    ninguna funcion ni toca ninguna policy, asi que la trampa 8 no aplica.
--    Trae una guarda que falla ruidosamente si correos_enviados no existe.
--
-- QUE HACE
--   1. correos_enviados acepta el tipo 'clase_nueva'. Sin esto, la reserva de
--      cada aviso falla con 23514 y la aplicacion NO MANDA ninguno (lo dice en
--      los registros). Los otros cinco correos siguen saliendo igual.
--   2. profiles.correos_desactivados: los avisos opcionales que la alumna
--      APAGO en Mi perfil (vacia = recibe todo). Sin la columna, la aplicacion
--      hace como si nadie hubiera apagado nada.
--   3. unsubscribe_token: ya es NOT NULL con default desde la de marketing; se
--      reafirma por si una base se reconstruyo distinto (no cambia nada si ya
--      esta bien).
--
-- POR QUE CLASES NUEVAS NO VA EN LA LISTA
--   Su verdad ya existe: marketing_opt_in / marketing_opt_out_at, que es lo
--   que escribe el enlace de baja (/baja) y la prueba del consentimiento.
--   Ponerla tambien en la lista dejaria dos lugares que pueden contradecirse.
--   Por eso el CHECK de abajo la deja AFUERA a proposito.
--
-- PERMISOS
--   No hace falta ningun grant: authenticated tiene UPDATE sobre toda la tabla
--   profiles (20260801_authenticated_least_privilege.sql), la policy
--   profiles_update_self_or_admin la limita a su propia fila, y
--   protect_profile_admin_fields no toca esta columna (es de ella).

-- ---------------------------------------------------------------------------
-- 0. Guarda
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.correos_enviados') is null then
    raise exception 'Falta 20261009_3_correos_enviados.sql: correr esa primero.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'unsubscribe_token'
  ) then
    raise exception 'Falta 20260803_marketing_consent.sql: correr esa primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. El tipo nuevo en correos_enviados
-- ---------------------------------------------------------------------------
-- La lista es la de 20261009_3 copiada EXACTA, mas 'clase_nueva'. Copiar de
-- menos dejaria de aceptar un correo que hoy sale.

alter table public.correos_enviados
  drop constraint if exists correos_enviados_tipo_valido;

alter table public.correos_enviados
  add constraint correos_enviados_tipo_valido check (
    tipo in ('bienvenida', 'gratis_por_vencer', 'gratis_terminado', 'recordatorio_vivo', 'invitacion_vivo', 'clase_nueva')
  );

-- ---------------------------------------------------------------------------
-- 2. Lo que la alumna apago
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists correos_desactivados text[] not null default '{}';

comment on column public.profiles.correos_desactivados is
  'Avisos opcionales que la alumna apago en Mi perfil. Vacia = recibe todo. '
  'Clases nuevas NO va aca: es marketing_opt_in / marketing_opt_out_at.';

-- `<@` y no un conteo: cada elemento tiene que estar en la lista. Un NULL
-- dentro del arreglo no es igual a nada, asi que tambien se rechaza.
alter table public.profiles
  drop constraint if exists profiles_correos_desactivados_validos;

alter table public.profiles
  add constraint profiles_correos_desactivados_validos check (
    correos_desactivados <@ array['recordatorio_vivo', 'invitacion_vivo', 'gratis_por_vencer', 'gratis_terminado']::text[]
  );

-- ---------------------------------------------------------------------------
-- 3. Token de baja para todas (ya deberia estar)
-- ---------------------------------------------------------------------------

update public.profiles
   set unsubscribe_token = gen_random_uuid()
 where unsubscribe_token is null;

alter table public.profiles
  alter column unsubscribe_token set default gen_random_uuid();

-- =============================================================================
-- VERIFICACION (correr DESPUES, por separado)
-- =============================================================================
--
-- a) El tipo nuevo entra y uno inventado no (por COMPORTAMIENTO, trampa 7).
--    Cada sentencia por separado:
--
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar', 'clase_nueva', 'x@example.com');
--   -- INSERT 0 1
--   delete from public.correos_enviados where clave = 'prueba:borrar';
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar2', 'inventado', 'x@example.com');
--   -- ERROR 23514
--
-- b) La columna, con todas en vacio y ningun token nulo:
--
--   select count(*) as perfiles,
--          count(*) filter (where cardinality(correos_desactivados) = 0) as reciben_todo,
--          count(unsubscribe_token) as con_token
--     from public.profiles;
--   -- perfiles = reciben_todo = con_token
--
-- c) El CHECK rechaza 'clase_nueva' en la lista (va por marketing_opt_in).
--    Sobre una cuenta de prueba, NO sobre una alumna:
--
--   update public.profiles set correos_desactivados = '{clase_nueva}'
--    where email = 'una-cuenta-de-prueba@ejemplo.com';
--   -- ERROR 23514
