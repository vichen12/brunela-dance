-- Brunela Dance Trainer
-- 2026-08-06: borrar el contenido de prueba antes de abrir al publico.
--
-- ⚠️ NO ES UNA MIGRACION. No va en supabase/migrations/ a proposito: no
--    describe el esquema, borra datos de ESTA base. Reconstruir el esquema desde
--    el repo no tiene que volver a ejecutarlo.
--
-- ⚠️ PEGAR SOLO EL SQL, SIN el `begin;` ni el `commit;` de abajo. Trampa 7 de
--    CLAUDE.md: el editor de Supabase ya envuelve lo pegado, y un `commit;`
--    propio deja lo que sigue sin persistir. Aca eso seria peor que de costumbre
--    -- un borrado a medias con las claves foraneas en el medio.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 ESTO NO SE PUEDE DESHACER
-- ═══════════════════════════════════════════════════════════════════════════
--
--   Supabase Pro guarda copias diarias; en el plan Free NO HAY COPIA. Si esta
--   base es Free, lo que se borra aca se pierde para siempre.
--
--   Antes de correrlo, sacar un respaldo:
--     Panel de Supabase -> Database -> Backups   (si el plan lo permite)
--   o, desde una terminal:
--     pg_dump "postgresql://postgres:[PASS]@db.howtuhfdxgyluskrlkze.supabase.co:5432/postgres" > respaldo.sql
--
--   Lo unico regenerable es el contenido demo: `scripts/seed-demo.sql` lo vuelve
--   a crear igual. Las cuentas de prueba, sus DM y los mensajes NO.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- EL ORDEN NO ES DECORATIVO: DOS CLAVES FORANEAS FRENAN EL BORRADO
-- ═══════════════════════════════════════════════════════════════════════════
--
--   pack_purchases.pack_id  -> packs   ON DELETE RESTRICT
--   program_days.video_id   -> videos  ON DELETE RESTRICT
--
--   Borrar un pack vendido, o una clase que es dia de un programa, FALLA con un
--   error de clave foranea. Por eso van primero las compras y los dias.
--
--   Ademas hay seis columnas `created_by` / `updated_by` que apuntan a
--   `profiles` SIN `on delete`, o sea NO ACTION: si una cuenta de prueba hubiera
--   creado una clase o tocado un ajuste, no se podria borrar. El bloque 0
--   comprueba eso ANTES de tocar nada y aborta con un mensaje legible en vez de
--   dejar el borrado a medias.

begin;

-- ---------------------------------------------------------------------------
-- 0. Comprobacion previa: que nada de lo real dependa de lo que se va a borrar
-- ---------------------------------------------------------------------------

do $$
declare
  cuenta integer;
begin
  select count(*) into cuenta
    from public.videos v
    join public.profiles p on p.id in (v.created_by, v.updated_by)
   where p.email like '%@brunela.test';
  if cuenta > 0 then
    raise exception 'Hay % clase(s) creadas o modificadas por una cuenta de prueba. Reasignalas antes de borrar.', cuenta;
  end if;

  select count(*) into cuenta
    from public.site_settings s
    join public.profiles p on p.id = s.updated_by
   where p.email like '%@brunela.test';
  if cuenta > 0 then
    raise exception 'Hay % ajuste(s) con updated_by de una cuenta de prueba. Reasignalos antes de borrar.', cuenta;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Packs — la compra ANTES que el pack (RESTRICT)
-- ---------------------------------------------------------------------------

delete from public.pack_purchases;          -- 1 fila (vidallape8@gmail.com)
delete from public.pack_videos;             -- 2 filas
delete from public.packs;                   -- 1 fila ("Pack de prueba")

-- ---------------------------------------------------------------------------
-- 2. Programas — los dias ANTES que las clases (RESTRICT)
-- ---------------------------------------------------------------------------

delete from public.program_days;            -- 17 filas
delete from public.programs;                -- 3 filas (demo-*)

-- ---------------------------------------------------------------------------
-- 3. Clases
-- ---------------------------------------------------------------------------
-- ⚠️ "prueba" (la unica con archivo en Bunny) NO se borra aca: se borra desde
--    /admin/videos, porque esa accion ADEMAS la saca de Bunny
--    (src/features/admin/actions.ts llama a deleteBunnyVideo). Borrarla por SQL
--    dejaria el archivo huerfano ocupando espacio y facturando.
--
--    Las 18 `demo-*` no tienen archivo en Bunny -- son solo metadatos de
--    seed-demo.sql -- asi que por SQL no dejan basura.

delete from public.user_progress
 where video_id in (select id from public.videos where slug like 'demo-%');

delete from public.videos where slug like 'demo-%';   -- 18 filas

-- ---------------------------------------------------------------------------
-- 4. Sesiones en vivo
-- ---------------------------------------------------------------------------
-- Reservas, enlaces e invitaciones se van en cascada (hoy: 0 de cada una).

delete from public.live_sessions where slug like 'demo-%';   -- 3 filas

-- ---------------------------------------------------------------------------
-- 5. Chat
-- ---------------------------------------------------------------------------
-- ⚠️ LOS 41 MENSAJES NO SON DE LAS CUENTAS DE PRUEBA.
--    Son de brunela.dance (38) y dallapevichen12 (3), en la sala de comunidad
--    "prueba" y en la sala de tier autogenerada. Borrar las cuentas de prueba
--    NO se los lleva: hay que borrar las salas, y por eso van explicitas.
--
--    Los DM se van con sus participantes de prueba, salvo dos que quedan abajo.

delete from public.chat_rooms
 where name = 'prueba'                                  -- comunidad, 39 mensajes
    or name like 'DM: Brunela — Prueba %'               -- 5 DM con cuentas de prueba
    or name = 'DM: Brunela — Alumna de prueba';         -- DM con una cuenta ya borrada

-- ---------------------------------------------------------------------------
-- 6. Las cuentas de prueba
-- ---------------------------------------------------------------------------
-- Borrar de `auth.users` arrastra en cascada el perfil y TODO lo suyo: progreso,
-- reservas, mensajes, muteos, suscripciones, compras y eventos de actividad.
--
-- ⚠️ SOLO las cuatro @brunela.test. Las dos @brunela.local de la lista original
--    NO EXISTEN en esta base: quedaron en el proyecto viejo de Oregon.

delete from auth.users
 where email in (
   'sin-plan@brunela.test',
   'corps@brunela.test',
   'solista@brunela.test',
   'principal@brunela.test'
 );

commit;

-- =============================================================================
-- LO QUE ESTE ARCHIVO NO TOCA, Y POR QUE
-- =============================================================================
--
-- ⚠️ TRES CUENTAS QUE NO ESTABAN EN NINGUNA DE LAS DOS LISTAS.
--    Ninguna se borra: hace falta una decision explicita.
--
--    brunela.sssdance@gmail.com
--      🔴 TIENE LA UNICA SUSCRIPCION DE LA BASE: solista, en periodo de prueba,
--         con un `sub_...` real de Stripe. Borrarla deja esa suscripcion viva en
--         Stripe apuntando a un usuario que ya no existe, y el proximo webhook
--         va a fallar. Ademas hay una instruccion permanente de NO borrarla.
--
--    vidallape8@gmail.com
--      Es la que compro el pack de prueba. La compra SI se borra arriba; la
--      cuenta queda, con tier none y sin nada. Se puede borrar despues, sola.
--
--    dallapevincenzo@gmail.com
--      La que se creo sola entrando con Google. CLAUDE.md la tiene anotada como
--      "decidir si se le da admin o se borra", y sigue sin decidirse.
--
-- ⚠️ EL PROGRESO Y LOS EVENTOS QUE QUEDAN SON DE CUENTAS REALES.
--    2 filas de user_progress y 4 de activity_events, de brunela.dance y
--    dallapevichen12. Las cuentas de prueba no tienen NI UNA. Si tambien se
--    quieren limpiar, es otra decision -- y borra historial de uso real.
--
-- ⚠️ LA SALA DE TIER "brunela.dance@gmail.com's Org" NO SE BORRA.
--    Tiene 2 mensajes de cuentas reales y un nombre autogenerado feo. No es
--    contenido de prueba, pero conviene renombrarla desde /admin/chat antes de
--    abrir: es lo primero que ve una alumna al entrar a la comunidad.
--
-- ⚠️ UN PARTICIPANTE FANTASMA.
--    El DM "Alumna de prueba" tiene un uuid (32f8d88c…) que ya no esta en
--    profiles: esa cuenta se borro en algun momento. La sala se borra arriba.
--
-- ⚠️ NO SE TOCAN: las 7 categorias, los 7 ajustes (catalogo de precios,
--    access_granting_statuses, chat.dm_access) ni los 14 eventos de webhook, que
--    son el rastro de auditoria de Stripe.
--
-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- Esperado: todo en 0 salvo categorias (7), ajustes (7) y perfiles (6).
--
-- select 'videos'        as tabla, count(*) from public.videos
-- union all select 'programs',        count(*) from public.programs
-- union all select 'program_days',    count(*) from public.program_days
-- union all select 'live_sessions',   count(*) from public.live_sessions
-- union all select 'chat_rooms',      count(*) from public.chat_rooms
-- union all select 'chat_messages',   count(*) from public.chat_messages
-- union all select 'packs',           count(*) from public.packs
-- union all select 'pack_purchases',  count(*) from public.pack_purchases
-- union all select 'profiles',        count(*) from public.profiles
-- union all select 'categories',      count(*) from public.categories
-- union all select 'site_settings',   count(*) from public.site_settings;
--
-- Y que no haya quedado ninguna cuenta de prueba:
--
-- select email from public.profiles order by created_at;
