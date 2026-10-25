-- Brunela Dance Trainer
-- 2026-10-25: un dia de un plan de trabajo puede ser DESCANSO en vez de clase.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7). El editor
--    ya envuelve lo pegado en su transaccion. Este archivo no trae ninguno: se
--    pega entero.
--
-- ⚠️ ORDEN: va al FINAL. Solo necesita phase_a (donde nace program_days). No
--    redefine ninguna funcion ni ninguna policy, asi que la trampa 8 no aplica.
--    Trae una guarda que falla ruidosamente si la tabla no existe.
--
-- QUE HACE
--   1. program_days.video_id pasa a aceptar NULL (un dia de descanso no tiene
--      clase).
--   2. program_days.es_descanso boolean not null default false.
--   3. program_days.nota text: lo que lee la alumna ese dia ("Estirá suave").
--      Opcional; vacia, la pantalla pone el texto por defecto. Hasta 300
--      caracteres.
--   4. CHECK: un dia es EXACTAMENTE una de las dos cosas -- o tiene clase, o es
--      descanso. Nunca las dos, nunca ninguna.
--
-- POR QUE NO SE TOCA NINGUNA POLICY
--   program_days_select_allowed_by_program_tier (20260728) mira SOLO el plan
--   (programs.status + rango de membresia). No hace join a videos, asi que un
--   video_id NULL no abre ni cierra nada: la nota de un descanso la ve quien ve
--   el dia por dia del plan, y nadie mas. program_days_admin_manage es solo
--   is_admin(). Ninguna funcion de la base lee program_days (verificado con
--   grep sobre supabase/migrations el 2026-10-25): el progreso
--   (guardar_progreso, user_progress) va por video_id de user_progress, que
--   sigue NOT NULL -- un descanso no genera progreso en la base.
--
-- POR QUE EL CHECK NO SE "REPARA" CON UN TRIGGER
--   Leccion de 20260921_2: un trigger que arregla la fila tapa al constraint.
--   Si alguien pone una clase en un dia que era descanso sin bajar es_descanso,
--   el CHECK lo rechaza (23514) y la accion lo dice. La accion del panel
--   (guardarDiaDePlanAction) escribe SIEMPRE las tres columnas juntas.
--
-- PERMISOS
--   Ninguno nuevo: authenticated ya tiene solo SELECT sobre program_days
--   (20260801_authenticated_least_privilege.sql) y las columnas nuevas lo
--   heredan. Escribe solo service_role, desde acciones con requireAdmin().

-- ---------------------------------------------------------------------------
-- 0. Guarda
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.program_days') is null then
    raise exception 'Falta phase_a (program_days no existe): correr esa primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------

alter table public.program_days
  add column if not exists es_descanso boolean not null default false;

alter table public.program_days
  add column if not exists nota text;

alter table public.program_days
  alter column video_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. Reglas
-- ---------------------------------------------------------------------------
-- Las filas que ya existen tienen video_id y es_descanso = false: cumplen las
-- dos. `add constraint` las valida, asi que si alguna no cumpliera la migracion
-- entera fallaria -- que es lo que tiene que pasar.

alter table public.program_days
  drop constraint if exists program_days_clase_o_descanso;
alter table public.program_days
  add constraint program_days_clase_o_descanso
  check ((video_id is not null) <> es_descanso);

alter table public.program_days
  drop constraint if exists program_days_nota_corta;
alter table public.program_days
  add constraint program_days_nota_corta
  check (nota is null or char_length(nota) <= 300);

comment on column public.program_days.es_descanso is
  'Dia de descanso: sin clase (video_id null). Lo ve como "Dia de descanso" quien tiene el plan.';
comment on column public.program_days.nota is
  'Texto del dia de descanso para la alumna. Null = texto por defecto de la pantalla.';
comment on table public.program_days is
  'Each program day is either a video (video_id) or a rest day (es_descanso), never both.';

-- ---------------------------------------------------------------------------
-- 3. Verificacion (correr aparte, despues)
-- ---------------------------------------------------------------------------
-- a) Las columnas:
--    select column_name, is_nullable, data_type from information_schema.columns
--     where table_schema = 'public' and table_name = 'program_days'
--       and column_name in ('video_id', 'es_descanso', 'nota');
--    -> video_id YES, es_descanso NO boolean, nota YES text
--
-- b) El CHECK, por COMPORTAMIENTO (trampa 7), dentro de un rollback:
--    ninguna de las dos      -> 23514
--    las dos a la vez        -> 23514
--    solo descanso           -> entra
--
-- c) Cero filas fuera de la regla:
--    select count(*) from public.program_days
--     where (video_id is not null) = es_descanso;   -> 0
