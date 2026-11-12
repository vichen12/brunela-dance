-- =============================================================================
-- 20261112_aviso_admin_registrado.sql
--
-- El aviso a Brunela ("Nueva alta: ...") pasa a quedar asentado en
-- correos_enviados, como los correos a las alumnas.
--
-- POR QUE: el 2026-11-12 Brunela compro un pack de prueba y no habia forma de
-- saber si el aviso habia salido: no quedaba en la base, la clave de Resend
-- solo puede enviar (no listar) y los logs de Vercel no tenian ese momento.
--
-- Solo agrega 'aviso_admin' a la lista de tipos. Va DESPUES de
-- 20261026_2_anuncios_por_mail.sql, que es la que define la lista vigente.
--
-- ⚠️ Pegar tal cual en el SQL Editor, SIN begin/commit (trampa 7).
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'correos_enviados_tipo_valido'
       and conrelid = 'public.correos_enviados'::regclass
       and pg_get_constraintdef(oid) like '%''anuncio''%'
  ) then
    raise exception 'Falta 20261026_2_anuncios_por_mail.sql: correr esa primero.';
  end if;
end;
$$;

alter table public.correos_enviados
  drop constraint if exists correos_enviados_tipo_valido;

alter table public.correos_enviados
  add constraint correos_enviados_tipo_valido check (
    tipo in ('bienvenida', 'gratis_por_vencer', 'gratis_terminado', 'recordatorio_vivo', 'invitacion_vivo', 'clase_nueva', 'volver_al_estudio', 'anuncio', 'aviso_admin')
  );

-- Verificacion: tiene que devolver una fila que incluya 'aviso_admin'.
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'correos_enviados_tipo_valido';
