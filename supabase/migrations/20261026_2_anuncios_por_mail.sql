-- Brunela Dance Trainer
-- 2026-10-26: los anuncios del estudio tambien salen por mail.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   Pegar tal cual: no trae `begin;` ni `commit;` (trampa 7 de CLAUDE.md).
--
-- POR QUE EXISTE
--   Pedido de la duena: "los anuncios, que se mande un mail a las personas".
--   Hasta hoy un anuncio solo se veia al entrar al estudio.
--
-- QUE CAMBIA (solo dos CHECK, no redefine funciones ni policies)
--   1. correos_enviados acepta el tipo 'anuncio'. La clave anuncio:<anuncio>:<alumna>
--      impide que le llegue dos veces el mismo.
--   2. profiles.correos_desactivados acepta 'anuncio': el interruptor
--      "Anuncios del estudio" de Mis correos.
--
-- ⚠️ ORDEN: DESPUES de 20261025_2_volver_al_estudio.sql. Las listas de abajo son
--    las de esa (y de 20261012_clase_nueva.sql) copiadas EXACTAS, mas 'anuncio'.
--    Copiar de menos dejaria de aceptar un correo que hoy sale (trampa 8).
--
-- SIN ESTA MIGRACION
--   El anuncio se publica igual; el mail no sale y el panel lo dice.

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
       and pg_get_constraintdef(oid) like '%''volver_al_estudio''%'
  ) then
    raise exception 'Falta 20261025_2_volver_al_estudio.sql: correr esa primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. El tipo nuevo en correos_enviados
-- ---------------------------------------------------------------------------

alter table public.correos_enviados
  drop constraint if exists correos_enviados_tipo_valido;

alter table public.correos_enviados
  add constraint correos_enviados_tipo_valido check (
    tipo in ('bienvenida', 'gratis_por_vencer', 'gratis_terminado', 'recordatorio_vivo', 'invitacion_vivo', 'clase_nueva', 'volver_al_estudio', 'anuncio')
  );

-- ---------------------------------------------------------------------------
-- 2. El interruptor de Mis correos
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_correos_desactivados_validos;

alter table public.profiles
  add constraint profiles_correos_desactivados_validos check (
    correos_desactivados <@ array['recordatorio_vivo', 'invitacion_vivo', 'gratis_por_vencer', 'gratis_terminado', 'anuncio']::text[]
  );

notify pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACION
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname in ('correos_enviados_tipo_valido', 'profiles_correos_desactivados_validos');
--   -- las dos listas terminan en 'anuncio'
-- =============================================================================
