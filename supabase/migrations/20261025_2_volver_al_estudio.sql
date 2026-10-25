-- Brunela Dance Trainer
-- 2026-10-25: correo "volver al estudio" para las alumnas sin acceso.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7). El editor
--    ya envuelve lo pegado en su transaccion. Este archivo no trae ninguno: se
--    pega entero.
--
-- ⚠️ ORDEN: va al FINAL, despues de 20261012_clase_nueva.sql: le vuelve a
--    cambiar el CHECK de tipo a correos_enviados, y la lista de abajo es la de
--    esa migracion copiada EXACTA mas el tipo nuevo. Corrida antes, el CHECK
--    de la 20261012 pisaria a este y 'volver_al_estudio' dejaria de entrar.
--    Trae una guarda que falla ruidosamente si la 20261012 no corrio.
--    No redefine ninguna funcion existente ni toca ninguna policy (trampa 8).
--
-- QUE HACE
--   1. correos_enviados acepta el tipo 'volver_al_estudio'. Sin esto, la
--      reserva de cada invitacion falla con 23514 y la aplicacion NO MANDA
--      ninguna (y el boton del panel aparece apagado, ver el punto 3).
--   2. Un indice para la regla de los 14 dias: "¿cuando fue la ultima
--      invitacion a esta alumna?" se pregunta por tipo y alumna.
--   3. correo_volver_al_estudio_disponible(): una funcion que solo devuelve
--      true. Existe para que el panel SEPA si esta migracion corrio sin
--      escribir nada en la base (un CHECK no se puede leer por la Data API).
--      Solo service_role la puede ejecutar: una funcion con EXECUTE para
--      anon o authenticated es un endpoint RPC publico, y esta no tiene nada
--      que contestarle a nadie de afuera.
--
-- LA REGLA (vive en src/features/correos/reglas.ts, motivoNoRecibeVolver)
--   Clave volver:<alumna>:<dia en Madrid> -> nunca dos el mismo dia.
--   Y antes de reservar, la aplicacion mira la ultima fila de este tipo para
--   esa alumna: si es de hace menos de 14 dias, no se manda.

-- ---------------------------------------------------------------------------
-- 0. Guarda
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.correos_enviados') is null then
    raise exception 'Falta 20261009_3_correos_enviados.sql: correr esa primero.';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'correos_enviados_tipo_valido'
       and conrelid = 'public.correos_enviados'::regclass
       and pg_get_constraintdef(oid) like '%''clase_nueva''%'
  ) then
    raise exception 'Falta 20261012_clase_nueva.sql: correr esa primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. El tipo nuevo en correos_enviados
-- ---------------------------------------------------------------------------
-- La lista es la de 20261012_clase_nueva.sql copiada EXACTA, mas
-- 'volver_al_estudio'. Copiar de menos dejaria de aceptar un correo que hoy sale.

alter table public.correos_enviados
  drop constraint if exists correos_enviados_tipo_valido;

alter table public.correos_enviados
  add constraint correos_enviados_tipo_valido check (
    tipo in ('bienvenida', 'gratis_por_vencer', 'gratis_terminado', 'recordatorio_vivo', 'invitacion_vivo', 'clase_nueva', 'volver_al_estudio')
  );

-- ---------------------------------------------------------------------------
-- 2. La regla de los 14 dias
-- ---------------------------------------------------------------------------

create index if not exists correos_enviados_tipo_alumna_fecha_idx
  on public.correos_enviados (tipo, alumna_id, enviado_at desc);

-- ---------------------------------------------------------------------------
-- 3. ¿Corrio esta migracion? (para el panel)
-- ---------------------------------------------------------------------------

create or replace function public.correo_volver_al_estudio_disponible()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

comment on function public.correo_volver_al_estudio_disponible() is
  'Siempre true. Existe solo para que el panel sepa que 20261025_2_volver_al_estudio.sql corrio. Solo service_role.';

-- revocarle a anon o authenticated NO alcanza: el EXECUTE lo heredan de PUBLIC.
revoke all on function public.correo_volver_al_estudio_disponible() from public;
revoke all on function public.correo_volver_al_estudio_disponible() from anon, authenticated;
grant execute on function public.correo_volver_al_estudio_disponible() to service_role;

-- Que la Data API vea la funcion nueva sin esperar.
notify pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACION (correr DESPUES, por separado)
-- =============================================================================
--
-- a) El tipo nuevo entra y uno inventado no (por COMPORTAMIENTO, trampa 7).
--    Cada sentencia por separado:
--
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar', 'volver_al_estudio', 'x@example.com');
--   -- INSERT 0 1
--   delete from public.correos_enviados where clave = 'prueba:borrar';
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar2', 'inventado', 'x@example.com');
--   -- ERROR 23514
--
-- b) Los tipos de antes siguen entrando (control positivo de la copia):
--
--   insert into public.correos_enviados (clave, tipo, para)
--     values ('prueba:borrar3', 'clase_nueva', 'x@example.com');
--   -- INSERT 0 1
--   delete from public.correos_enviados where clave = 'prueba:borrar3';
--
-- c) La funcion: service_role si, el resto no.
--
--   select has_function_privilege('service_role', 'public.correo_volver_al_estudio_disponible()', 'execute') as service,
--          has_function_privilege('authenticated', 'public.correo_volver_al_estudio_disponible()', 'execute') as auth,
--          has_function_privilege('anon', 'public.correo_volver_al_estudio_disponible()', 'execute') as anon;
--   -- service = true, auth = false, anon = false
