-- Brunela Dance Trainer
-- 2026-08-01: la duena del estudio se DECLARA, no se deduce del created_at.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- EL PROBLEMA
--   20260730_chat_studio_admin_lookup.sql resolvia "quien es la duena del
--   estudio" con `order by created_at asc limit 1` sobre las admins. Pero
--   created_at significa CUANDO SE INSERTO LA FILA, no quien es la duena: son
--   dos hechos distintos metidos en un campo.
--
--   La prueba de que no funciona es como se sostuvo hasta hoy: hubo que
--   forzarle created_at = 2020 a una cuenta demo para que ganara el orden. Esa
--   falsificacion ERA el sintoma.
--
--   Y el fallo es silencioso. Un restore, un re-seed o una admin nueva cambian
--   la respuesta sin que nada se rompa: la funcion devuelve una fila igual, el
--   chat carga igual, y las alumnas le escriben a otra persona. Al 2026-08-01
--   la funcion devolvia brunela.demo@brunela.local -- una cuenta demo a la que
--   Brunela no tiene acceso.
--
-- LA SOLUCION
--   Una columna explicita, con tres garantias que hace cumplir la base:
--     1. indice unico parcial   -> como mucho UNA duena
--     2. check constraint       -> la duena no puede quedar sin is_admin
--     3. trigger de proteccion  -> una alumna no puede auto-designarse
--
-- FALLBACK DELIBERADO
--   El order by deja is_studio_owner primero y created_at despues. Si algun dia
--   nadie tiene la bandera puesta, degrada al comportamiento anterior (la admin
--   mas antigua) en vez de devolver cero filas -- que seria revivir el
--   "Cargando chat..." eterno que arreglo la migracion del 30/07.
--   Es estrictamente mejor que antes, nunca peor.

begin;

alter table public.profiles
  add column if not exists is_studio_owner boolean not null default false;

comment on column public.profiles.is_studio_owner is
  'Exactly one profile is the studio owner: the person a member reaches when they open the studio DM. Declared, never inferred from created_at.';

-- 1. Como mucho UNA duena. Indice parcial: solo indexa las filas en true, asi
--    que las (muchas) filas en false no compiten entre si.
create unique index if not exists uniq_profiles_studio_owner
  on public.profiles (is_studio_owner)
  where is_studio_owner;

-- 2. La duena no puede quedar sin is_admin. Para sacarle admin hay que sacarle
--    primero la propiedad del estudio, que pasa a ser una decision explicita en
--    vez de un efecto colateral.
alter table public.profiles
  drop constraint if exists profiles_studio_owner_is_admin;

alter table public.profiles
  add constraint profiles_studio_owner_is_admin
  check (not is_studio_owner or is_admin);

-- 3. Defensa en profundidad. El check constraint de arriba ya bloquearia a una
--    alumna que intentara marcarse duena (su is_admin sigue en false y la fila
--    violaria el check), pero el lugar donde se declara "esto una alumna no lo
--    toca" es este trigger. Que quede como efecto colateral de un constraint
--    seria accidental.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.membership_tier = old.membership_tier;
    new.is_admin        = old.is_admin;
    new.email           = old.email;
    new.is_studio_owner = old.is_studio_owner;
  end if;

  return new;
end;
$$;

-- 4. La funcion, ahora con la duena declarada primero.
create or replace function public.get_studio_admin()
returns table (admin_id uuid, admin_name text)
language sql
stable
security definer
set search_path = public
as $$
  -- La duena declarada gana. Si no hay ninguna, la admin mas antigua: degrada
  -- al comportamiento anterior en vez de devolver vacio.
  select p.id, p.full_name
  from public.profiles p
  where p.is_admin = true
  order by p.is_studio_owner desc, p.created_at asc
  limit 1;
$$;

comment on function public.get_studio_admin() is
  'Returns only the id and display name of the studio owner (falling back to the oldest admin), so a member can open their DM. Deliberately excludes email and every other column; profiles RLS stays closed.';

revoke all on function public.get_studio_admin() from public;
revoke all on function public.get_studio_admin() from anon;
grant execute on function public.get_studio_admin() to authenticated;

commit;

-- =============================================================================
-- ESTA MIGRACION NO ASIGNA LA DUENA
-- =============================================================================
--
-- Marcar a una persona concreta es un cambio de DATOS, no de esquema, y el uuid
-- es distinto en cada proyecto. Va aparte, y OJO con el trigger:
--
--   El SQL Editor corre sin JWT, asi que auth.uid() es null, is_admin() da
--   FALSE y trg_profiles_protect_admin_fields REVIERTE is_admin, is_studio_owner
--   y membership_tier. El update responde "UPDATE 1" y no cambia NADA.
--
--   Por eso hay que asumir la identidad de una admin existente en la misma
--   transaccion (ver scripts/, o el bloque que se uso el 2026-08-01):
--
--     begin;
--     set local request.jwt.claims = '{"sub":"<UUID_DE_UNA_ADMIN_ACTUAL>"}';
--     update public.profiles
--        set is_admin = true, is_studio_owner = true, membership_tier = 'principal'
--      where email = 'brunela.dance@gmail.com';
--     commit;
--
-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) La columna, el indice y el constraint existen:
--
-- select column_name from information_schema.columns
--  where table_name='profiles' and column_name='is_studio_owner';
-- select indexname from pg_indexes where indexname='uniq_profiles_studio_owner';
-- select conname from pg_constraint where conname='profiles_studio_owner_is_admin';
--
-- b) La funcion devuelve UNA fila, y es quien tiene que ser:
--
-- select * from public.get_studio_admin();
--
-- c) Permisos intactos: authenticated si, anon no.
--
-- select grantee, privilege_type from information_schema.routine_privileges
--  where routine_name='get_studio_admin';
--
-- d) El conteo de policies NO cambia: esta migracion no crea ninguna.
--    Deberia seguir en 43 public + 1 storage.
--
-- select schemaname, count(*) from pg_policies
--  where schemaname in ('public','storage') group by schemaname order by 1;
