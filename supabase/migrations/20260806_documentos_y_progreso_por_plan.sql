-- Brunela Dance Trainer
-- 2026-08-06: los documentos empiezan a comprobar el plan, y el progreso deja
--             de poder escribirse sobre contenido inaccesible.
-- Target: Supabase Postgres.
--
-- ⚠️ PEGAR SOLO EL SQL, SIN el `begin;` ni el `commit;`. Trampa 7 de CLAUDE.md.
--
-- ⚠️ VA DESPUES de 20260421 (documents) y de 20260728 (que reescribe las tres
--    policies de user_progress). Corrida antes, esas la pisan y todo vuelve al
--    estado de hoy SIN NINGUN ERROR. Trampa 8.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 1. LOS DOCUMENTOS SE DESCARGAN SIN PAGAR — FILTRACION REAL
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Encontrado el 2026-08-06 ATACANDO la base con la sesion de una alumna sin
-- plan, no leyendo codigo. Leyendo codigo habia pasado desapercibido varias
-- veces, y el motivo esta a la vista:
--
--   app/dashboard/documents/page.tsx dice, textual:
--     "Se firma aca, del lado del servidor, DESPUES de que RLS ya filtro por
--      plan: firmar es entregar el acceso, asi que no puede pasar antes."
--
--   Y la policy vigente dice:
--     documents_select_published:  using (is_published = true or is_admin())
--
--   RLS NO FILTRA POR PLAN. El comentario describe algo que no pasa.
--
-- LA CADENA COMPLETA DEL AGUJERO
--   1. una alumna con tier 'none' abre /dashboard/documents
--   2. RLS le devuelve TODOS los documentos publicados, incluidos los de
--      'principal', con su file_url
--   3. la pagina firma una URL de descarga para CADA UNO con service_role, que
--      saltea las policies del storage
--   4. se descarga contenido pago con una cuenta gratuita
--
--   El bucket privado no la salva: la firma la hace el servidor por ella.
--
-- ES LA CUARTA VEZ DE LA MISMA FAMILIA: la columna existe, la interfaz la
-- respeta, y la policy no. Paso con `categories`, con el chat, con el chat por
-- plan, y ahora con los documentos.
--
-- ⚠️ POR QUE HAY UN CHECK CONSTRAINT ANTES DE LA POLICY
--   `documents.membership_tier_required` es TEXT, no el enum -- igual que
--   `chat_rooms.tier_required`. Un cast dentro de una policy es peligroso: si
--   UNA fila trajera un valor invalido, el cast lanza 22P02 y la policy no
--   niega el acceso, ROMPE la consulta. Los documentos dejarian de cargar para
--   todas.
--
--   Hoy la tabla esta vacia (verificado: 0 filas), asi que el constraint entra
--   sin riesgo. Y a partir de aca un valor invalido falla al INSERTARSE, que es
--   donde el error es visible y de quien lo escribio.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 2. EL PROGRESO SE PODIA ESCRIBIR SOBRE CLASES INACCESIBLES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Tambien del ataque: una alumna sin plan hizo
--
--   insert into user_progress (user_id, video_id, completion_percent)
--   values (ella, <clase de principal>, 100)
--
-- y la fila quedo escrita. La policy solo comprobaba `user_id = auth.uid()`:
-- que la fila fuera SUYA, no que la clase fuera alcanzable.
--
-- NO ES UNA FILTRACION -- no le muestra el video -- PERO NO ES INOCUO:
--   - ensucia las analiticas: "alumnas que empezaron esta clase" pasa a contar
--     a quien nunca pudo verla, y esas metricas son las que Brunela usa para
--     decidir que grabar
--   - los logros de constancia salen del progreso, asi que se pueden fabricar
--   - "seguir viendo" en el panel de la alumna le ofreceria una clase que al
--     tocarla no reproduce
--
-- Se arregla exigiendo que la clase EXISTA PARA ELLA. `exists (select 1 from
-- videos where id = video_id)` se evalua con las policies de `videos`, asi que
-- reusa exactamente la regla de acceso -- plan O pack comprado -- sin repetirla.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `current_user_membership_tier()` CONTESTABA A `anon`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sin sesion devuelve 'none', asi que no filtra datos de nadie. Pero es una
-- funcion en `public` con EXECUTE para `anon`, o sea un endpoint RPC abierto a
-- internet que no hace falta: la landing no la usa y el area privada exige
-- sesion. Se cierra por higiene, no por urgencia.

begin;

-- ---------------------------------------------------------------------------
-- 1. Documentos: el plan, por fin, en la policy
-- ---------------------------------------------------------------------------

alter table public.documents
  drop constraint if exists documents_tier_required_valido;

alter table public.documents
  add constraint documents_tier_required_valido
  check (membership_tier_required in ('none', 'corps_de_ballet', 'solista', 'principal'));

drop policy if exists "documents_select_published" on public.documents;
create policy "documents_select_published"
  on public.documents
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      is_published = true
      -- Lo mismo que hacen videos y programas desde phase_a. Los documentos de
      -- tier 'none' siguen siendo de todas: rank('none') = rank('none').
      and public.membership_tier_rank((select public.current_user_membership_tier()))
          >= public.membership_tier_rank(membership_tier_required::public.membership_tier)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Progreso: solo sobre clases que la alumna puede ver
-- ---------------------------------------------------------------------------
-- Se reproducen las dos policies vigentes (20260728, lineas 152 y 159) y se les
-- agrega la comprobacion. El SELECT no cambia: si algun dia pierde el acceso a
-- una clase, tiene que poder seguir viendo su propio historial.
--
-- ⚠️ `exists (select 1 from public.videos ...)` se evalua CON LAS POLICIES DE
--    `videos`, porque esto no es SECURITY DEFINER. Esa es toda la gracia: hereda
--    la regla de acceso completa -- plan o pack comprado -- sin copiarla, asi
--    que el dia que cambie no hay que acordarse de tocar esto tambien.

drop policy if exists "user_progress_insert_own_or_admin" on public.user_progress;
create policy "user_progress_insert_own_or_admin"
  on public.user_progress
  for insert
  to authenticated
  with check (
    (select public.is_admin())
    or (
      user_id = (select auth.uid())
      and exists (select 1 from public.videos v where v.id = video_id)
    )
  );

drop policy if exists "user_progress_update_own_or_admin" on public.user_progress;
create policy "user_progress_update_own_or_admin"
  on public.user_progress
  for update
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (
    (select public.is_admin())
    or (
      user_id = (select auth.uid())
      and exists (select 1 from public.videos v where v.id = video_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Cerrar la RPC del plan a los anonimos
-- ---------------------------------------------------------------------------
-- ⚠️ NO se toca `authenticated`: la usan las policies de videos, programas,
--    sesiones, chat y documentos, y las expresiones de una policy se evaluan con
--    los permisos del usuario. Revocarsela a authenticated rompe el sistema
--    entero.

revoke execute on function public.current_user_membership_tier() from anon;

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Las tres policies miran lo que tienen que mirar. Esperado: las tres en SI.
--
-- select nombre,
--        case when definicion like '%membership_tier_rank%'
--                  or definicion like '%from public.videos%'
--             then 'SI' else 'NO' end as comprueba
--   from (
--     select policyname as nombre, coalesce(qual,'') || coalesce(with_check,'') as definicion
--       from pg_policies
--      where schemaname = 'public'
--        and policyname in ('documents_select_published',
--                           'user_progress_insert_own_or_admin',
--                           'user_progress_update_own_or_admin')
--   ) t;
--
-- b) `anon` ya no puede ejecutar la funcion del plan. Esperado: cero filas.
--
-- select r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(p.proacl) a
--   join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname = 'current_user_membership_tier'
--    and a.privilege_type = 'EXECUTE'
--    and r.rolname = 'anon';
--
-- c) LA PRUEBA DE VERDAD, que no es SQL:
--
--      npm run test:aislamiento
--
--    tests/aislamiento/adversario.test.ts ataca la base con la sesion de una
--    alumna sin plan. Hoy da 4 rojos; con esto corrido tienen que ser cero.
--
--    ⚠️ Y el codigo de app/dashboard/documents/page.tsx hay que mirarlo igual:
--       su comentario afirma que RLS ya filtro por plan. Con esta migracion la
--       afirmacion pasa a ser cierta, pero fue falsa durante meses y nadie lo
--       noto leyendo.
