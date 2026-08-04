-- Brunela Dance Trainer
-- 2026-08-04: fase C. Guardado de progreso en UN viaje en vez de dos.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE
--   /api/progress hace hoy DOS viajes a la base por cada guardado:
--
--     1. select id, max_position_seconds ... para saber el maximo anterior
--     2. upsert con el maximo ya calculado en JavaScript
--
--   Con el reproductor guardando cada 10 segundos, una clase de 45 minutos son
--   270 idas y vueltas por alumna. Con 50 alumnas mirando a la vez, 13.500.
--   Y la mitad existe solo para leer un numero que Postgres puede calcular
--   solo con greatest().
--
-- POR QUE UNA FUNCION Y NO .upsert() DE POSTGREST
--   Porque los indices unicos son PARCIALES:
--
--     uq_user_progress_video_without_program  (user_id, video_id)
--       where program_id is null
--     uq_user_progress_video_with_program_day (user_id, video_id, program_id,
--                                              program_day_number)
--       where program_id is not null
--
--   PostgREST no puede deducir el conflict target de un indice parcial: manda
--   `on conflict (columnas)` sin el `where`, y Postgres no lo hace coincidir
--   con ninguno de los dos indices. Falla con "no unique or exclusion
--   constraint matching the ON CONFLICT specification". Por eso el `on conflict`
--   con su predicado tiene que estar escrito a mano, o sea en una funcion.
--
-- SECURITY INVOKER, NO DEFINER
--   A proposito. La funcion corre con los permisos de quien la llama, asi que
--   las policies de user_progress se siguen evaluando igual que hoy: nadie
--   puede escribir el progreso de otra persona. Con DEFINER la autorizacion se
--   mudaria de RLS al cuerpo de esta funcion, que es exactamente el tipo de
--   traslado silencioso que ya nos costo caro con las server actions.
--
--   El user_id ni siquiera se acepta como parametro: sale de auth.uid(). Un
--   parametro se puede falsificar; auth.uid() no.

begin;

create or replace function public.guardar_progreso(
  p_video_id              uuid,
  p_program_id            uuid,
  p_program_day_number    integer,
  p_last_position_seconds integer,
  p_completion_percent    numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  completa boolean := p_completion_percent >= 90;
begin
  if uid is null then
    raise exception 'sin sesion' using errcode = '42501';
  end if;

  if p_program_id is null then
    insert into public.user_progress (
      user_id, video_id, program_id, program_day_number,
      last_position_seconds, max_position_seconds, completion_percent, is_completed
    )
    values (
      uid, p_video_id, null, null,
      p_last_position_seconds, p_last_position_seconds, p_completion_percent, completa
    )
    -- El `where` repite el predicado del indice parcial. Sin el, Postgres no
    -- encuentra a que restriccion corresponde este on conflict.
    on conflict (user_id, video_id) where program_id is null
    do update set
      last_position_seconds = excluded.last_position_seconds,
      -- Esto es lo que antes obligaba a leer primero. El maximo NUNCA baja:
      -- si la alumna vuelve a mirar desde el principio, no pierde el avance.
      max_position_seconds  = greatest(user_progress.max_position_seconds, excluded.last_position_seconds),
      completion_percent    = excluded.completion_percent,
      is_completed          = user_progress.is_completed or excluded.is_completed,
      updated_at            = timezone('utc', now());

  else
    insert into public.user_progress (
      user_id, video_id, program_id, program_day_number,
      last_position_seconds, max_position_seconds, completion_percent, is_completed
    )
    values (
      uid, p_video_id, p_program_id, p_program_day_number,
      p_last_position_seconds, p_last_position_seconds, p_completion_percent, completa
    )
    on conflict (user_id, video_id, program_id, program_day_number) where program_id is not null
    do update set
      last_position_seconds = excluded.last_position_seconds,
      max_position_seconds  = greatest(user_progress.max_position_seconds, excluded.last_position_seconds),
      completion_percent    = excluded.completion_percent,
      is_completed          = user_progress.is_completed or excluded.is_completed,
      updated_at            = timezone('utc', now());
  end if;
end;
$$;

comment on function public.guardar_progreso is
  'Guarda el progreso en UN viaje. SECURITY INVOKER: las policies de '
  'user_progress se siguen aplicando. El user_id sale de auth.uid(), nunca de '
  'un parametro.';

-- Las funciones nuevas nacen con EXECUTE para public en Postgres, pero se
-- otorga explicito para que quede declarado en el repo y no dependa del
-- default del proyecto -- que es justo lo que fallo con los grants de tabla.
revoke all on function public.guardar_progreso(uuid, uuid, integer, integer, numeric) from public;
grant execute on function public.guardar_progreso(uuid, uuid, integer, integer, numeric) to authenticated;

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) La funcion existe y es INVOKER. Esperado: prosecdef = false.
--
-- select proname, prosecdef
--   from pg_proc where proname = 'guardar_progreso';
--
-- b) Quien puede ejecutarla. Esperado: authenticated, y NO anon.
--
-- select grantee, privilege_type
--   from information_schema.role_routine_grants
--  where routine_name = 'guardar_progreso';
--
-- c) LA PRUEBA QUE IMPORTA -- que el maximo no baje. Reproducir una clase
--    hasta el minuto 10, volver al principio y dejarla correr 30 segundos:
--
-- select last_position_seconds, max_position_seconds, completion_percent
--   from public.user_progress
--  where video_id = '<uuid de la clase>' order by updated_at desc limit 1;
--
--    Esperado: last_position ~30, max_position ~600. Si max_position bajo a
--    30, el greatest() no esta funcionando y la alumna perdio su avance.
--
-- d) Que las dos ramas funcionen: probar una clase suelta (program_id null) y
--    una clase DENTRO de un programa. Son dos indices distintos y el bug
--    tipico aparece solo en una de las dos.
--
-- e) Que RLS siga cerrada. Con la sesion de una alumna, en la consola:
--
--    await supabase.rpc('guardar_progreso', {
--      p_video_id: '<uuid>', p_program_id: null, p_program_day_number: null,
--      p_last_position_seconds: 10, p_completion_percent: 5 })
--
--    Tiene que escribir SU fila. No hay forma de pedir la de otra persona
--    porque el user_id no es parametro.
