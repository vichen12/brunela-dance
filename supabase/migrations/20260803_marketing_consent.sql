-- Brunela Dance Trainer
-- 2026-08-03: consentimiento de marketing y token de baja.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE
--   Brunela quiere avisar por correo cada vez que sube una clase nueva. Ese
--   correo NO es transaccional: no responde a ninguna accion de la alumna. Es
--   marketing, y con alumnas en la UE eso exige dos cosas concretas:
--
--     1. consentimiento explicito -- una casilla que la alumna MARCA, nunca
--        una premarcada ni un "al registrarte aceptas"
--     2. una via de baja en cada envio, que funcione SIN iniciar sesion
--
--   Y hay que poder demostrar el consentimiento, no solo tenerlo: por eso se
--   guarda CUANDO se dio, no solo que esta dado.
--
--   Seria incoherente haber movido la base a Frankfurt por residencia de datos
--   y despues mandar correo comercial sin consentimiento.
--
-- ESTA MIGRACION NO MANDA NINGUN CORREO
--   Prepara el terreno: columnas, sellado de fechas y token de baja. El envio
--   todavia no existe (no hay dominio ni SMTP). Se hace en este orden a
--   proposito -- la casilla tiene que estar recogiendo consentimiento ANTES
--   del primer envio, porque a quien se registro sin verla no se le puede
--   escribir.
--
-- POR QUE UN TOKEN Y NO EL id DEL PERFIL
--   El enlace de baja viaja en un correo y termina en historiales, reenvios y
--   registros de servidores. Con el id del perfil, cualquiera que vea ese
--   enlace puede dar de baja a esa persona, y peor: el id es la misma clave que
--   usa el resto del sistema. El token es de un solo proposito y no sirve para
--   nada mas.

begin;

alter table public.profiles
  add column if not exists marketing_opt_in     boolean not null default false,
  add column if not exists marketing_opt_in_at  timestamptz,
  add column if not exists marketing_opt_out_at timestamptz,
  add column if not exists unsubscribe_token    uuid;

comment on column public.profiles.marketing_opt_in is
  'Consentimiento explicito para avisos de clase nueva. Por defecto FALSE: '
  'quien no marco la casilla no recibe nada.';
comment on column public.profiles.unsubscribe_token is
  'Token de un solo proposito para el enlace de baja. No sirve para autenticar.';

-- Backfill en dos pasos y no con un default volatil en el ADD COLUMN: asi es
-- evidente que cada fila recibe SU propio token. Con un default de
-- gen_random_uuid() el resultado es el mismo, pero depende de conocer un
-- detalle del optimizador, y aca eso no se puede mirar a ojo.
update public.profiles
   set unsubscribe_token = gen_random_uuid()
 where unsubscribe_token is null;

alter table public.profiles
  alter column unsubscribe_token set not null,
  alter column unsubscribe_token set default gen_random_uuid();

-- Unico: la baja resuelve token -> perfil. Dos perfiles con el mismo token
-- daria de baja a la persona equivocada.
create unique index if not exists uq_profiles_unsubscribe_token
  on public.profiles (unsubscribe_token);

-- Solo las que dijeron que si. Es el indice de la consulta que va a hacer el
-- envio, y parcial porque la inmensa mayoria de las filas no interesan.
create index if not exists idx_profiles_marketing_opt_in
  on public.profiles (marketing_opt_in)
  where marketing_opt_in = true;

-- ---------------------------------------------------------------------------
-- Sellado automatico de las fechas
-- ---------------------------------------------------------------------------
-- La fecha no se deja en manos de quien escriba el formulario. Si el dia de
-- manana alguien agrega otra pantalla que toque marketing_opt_in y se olvida
-- de sellar la fecha, el consentimiento queda sin prueba y no se nota hasta
-- que alguien lo reclama. Aca no puede pasar: lo sella la base.

create or replace function public.stamp_marketing_consent()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.marketing_opt_in then
      new.marketing_opt_in_at = coalesce(new.marketing_opt_in_at, now());
    end if;
    return new;
  end if;

  -- Solo en la TRANSICION. Un update que no toca el consentimiento no debe
  -- mover la fecha: si lo hiciera, cada edicion de perfil reescribiria la
  -- prueba y se perderia el dato de cuando se dio de verdad.
  if new.marketing_opt_in is distinct from old.marketing_opt_in then
    if new.marketing_opt_in then
      new.marketing_opt_in_at = now();
    else
      new.marketing_opt_out_at = now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stamp_marketing_consent on public.profiles;
create trigger trg_stamp_marketing_consent
  before insert or update on public.profiles
  for each row
  execute function public.stamp_marketing_consent();

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Las cuatro columnas, y ningun token nulo ni repetido:
--
-- select count(*)                             as perfiles,
--        count(unsubscribe_token)             as con_token,
--        count(distinct unsubscribe_token)    as tokens_unicos,
--        count(*) filter (where marketing_opt_in) as aceptaron
--   from public.profiles;
--
--    esperado: perfiles = con_token = tokens_unicos, y aceptaron = 0
--    (nadie dio consentimiento todavia: la casilla recien se estrena).
--
-- b) El trigger sella al cambiar. Sobre una cuenta de prueba, NO sobre la de
--    Brunela:
--
-- update public.profiles set marketing_opt_in = true
--  where email = 'una-cuenta-de-prueba@ejemplo.com';
--
-- select marketing_opt_in, marketing_opt_in_at, marketing_opt_out_at
--   from public.profiles where email = 'una-cuenta-de-prueba@ejemplo.com';
--    esperado: true | (ahora) | null
--
-- c) Y que un update que NO toca el consentimiento no mueva la fecha:
--
-- update public.profiles set full_name = full_name
--  where email = 'una-cuenta-de-prueba@ejemplo.com';
--    marketing_opt_in_at tiene que seguir siendo el mismo instante de (b).
--
-- d) El trigger NO necesita grants nuevos: profiles ya tiene UPDATE para
--    authenticated (migracion 18) y protect_profile_admin_fields solo revierte
--    membership_tier, is_admin, email e is_studio_owner, asi que una alumna
--    puede cambiar su propio consentimiento pero nada de lo que importa.
