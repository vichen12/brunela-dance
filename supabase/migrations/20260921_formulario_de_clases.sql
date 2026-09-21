-- Brunela Dance Trainer
-- 2026-09-21: el formulario de clases deja de ser texto libre.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- ⚠️ VA AL FINAL DE TODO. Redefine `videos_select_allowed_by_tier`, que nace en
--    phase_a, se reescribe en 20260728_rls_initplan y se vuelve a reescribir en
--    20260805_packs_de_clases. Corrida ANTES que packs, la version de packs la
--    pisa y las clases compradas sueltas dejan de verse -- sin ningun error.
--    Ver CLAUDE.md, trampa 8.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS. El SQL Editor de Supabase ya
--    envuelve lo pegado en su transaccion; un commit propio la cierra antes de
--    tiempo y lo que sigue se ejecuta sin error visible y NO PERSISTE. El
--    editor igual dice "Success". Ver CLAUDE.md, trampa 7.
--
-- QUE HACE
--   1. `videos.content_type`      Clase / Mini Training (columna nueva)
--   2. `videos.planes_permitidos` que planes ven la clase (columna nueva)
--   3. reescribe la policy del catalogo para que lea la lista, no el rango
--   4. reemplaza el vocabulario de categorias por las 11 nuevas
--
-- QUE NO HACE
--   Nivel y materiales NO necesitan migracion: ya existen
--   `recommended_min_level` / `recommended_max_level` y `equipment text[]`. Lo
--   que cambia ahi es solo el formulario, que pasa de texto libre a listas
--   cerradas.
--
-- IDEMPOTENTE. Se puede correr dos veces; la segunda no cambia nada.

-- ===========================================================================
-- 0. Guarda de orden
-- ===========================================================================
-- Si packs no corrio todavia, esta migracion reescribiria la policy SIN la
-- rama de packs y despues packs la volveria a escribir sin la rama de planes.
-- Cualquiera de los dos ordenes pierde la mitad del acceso, en silencio. Mejor
-- fallar ruidosamente aca.

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_user_has_purchased_video'
  ) then
    raise exception
      'Falta 20260805_packs_de_clases.sql. Correr esa PRIMERO: esta migracion reescribe la misma policy y sin la rama de packs las clases compradas sueltas dejan de verse.';
  end if;
end;
$$;

-- ===========================================================================
-- 1. Tipo de contenido
-- ===========================================================================
-- Texto con check y no un enum nuevo: agregar un valor a un enum es una
-- migracion con `alter type`, y el dia que aparezca un tercer tipo esto es un
-- solo `alter constraint`.

alter table public.videos
  add column if not exists content_type text not null default 'clase';

alter table public.videos
  drop constraint if exists videos_content_type_valido;

alter table public.videos
  add constraint videos_content_type_valido
  check (content_type in ('clase', 'mini_training'));

comment on column public.videos.content_type is
  'Clase o Mini Training. La lista vive tambien en src/features/studio/catalogo-clases.ts.';

-- ===========================================================================
-- 2. Los planes que pueden ver la clase
-- ===========================================================================
-- 🔴 ESTA COLUMNA ES EL CONTROL DE ACCESO AL CATALOGO, no una etiqueta.
--
-- POR QUE UNA LISTA Y NO EL RANGO QUE YA HABIA
--   Hasta hoy el acceso era "de este plan para arriba": una sola columna
--   (`membership_tier_required`) y una comparacion de rangos. Pedido del
--   2026-09-21: poder elegir CUALQUIER combinacion, incluida "Corps y
--   Principal pero no Solista", que un rango no puede representar.
--
-- QUE PASA CON `membership_tier_required`
--   SIGUE VIVA Y SIGUE SIENDO CORRECTA, pero ya no manda: pasa a ser el plan
--   MAS BAJO de la lista, derivado por trigger. La usan la insignia de la
--   tarjeta, el filtro de la biblioteca y las consultas del panel; dejarla
--   quieta evita tocar una docena de pantallas.
--
--   ⚠️ Es DERIVADA, no autoritativa. Quien quiera saber quien ve una clase
--      tiene que mirar `planes_permitidos`. Con {corps, principal} esta columna
--      dice 'corps_de_ballet' y Solista NO la ve: la insignia simplifica, la
--      policy no. Es el precio de la combinacion libre y fue elegido sabiendolo.

alter table public.videos
  add column if not exists planes_permitidos public.membership_tier[] not null default '{}';

-- Backfill con la regla vieja exacta, para que ninguna clase existente cambie
-- de manos: "los planes de rango mayor o igual al que pedia".
update public.videos v
set planes_permitidos = (
  select coalesce(array_agg(t order by public.membership_tier_rank(t)), '{}')
  from unnest(enum_range(null::public.membership_tier)) as t
  where t <> 'none'
    and public.membership_tier_rank(t) >= public.membership_tier_rank(v.membership_tier_required)
)
where array_length(v.planes_permitidos, 1) is null;

-- `none` no puede estar en la lista: seria el catalogo abierto a quien no paga.
-- La lista vacia tampoco, porque una clase publicada que no ve nadie es un
-- error de carga disfrazado de clase.
alter table public.videos
  drop constraint if exists videos_planes_permitidos_validos;

alter table public.videos
  add constraint videos_planes_permitidos_validos
  check (
    array_length(planes_permitidos, 1) >= 1
    and not (planes_permitidos @> array['none'::public.membership_tier])
  );

-- `@>` sobre un array usa GIN, no btree. Sin este indice la policy hace un
-- scan de `videos` por cada consulta de la biblioteca.
create index if not exists idx_videos_planes_permitidos
  on public.videos using gin (planes_permitidos);

comment on column public.videos.planes_permitidos is
  'Planes que pueden ver la clase. Es lo que lee videos_select_allowed_by_tier. membership_tier_required se deriva de aca por trigger y es solo para mostrar.';

-- ===========================================================================
-- 3. El trigger que mantiene las dos columnas de acuerdo
-- ===========================================================================
-- POR QUE HACE FALTA, Y POR QUE VA EN LOS DOS SENTIDOS
--
--   Hacia abajo: el formulario manda `planes_permitidos`, y sin esto
--   `membership_tier_required` quedaria en el valor viejo. La insignia de la
--   tarjeta diria "Principal" en una clase que ya es para todas.
--
--   Hacia arriba: hay codigo y pruebas que insertan clases pasando SOLO
--   `membership_tier_required` (tests/aislamiento/ayudantes.ts, por ejemplo).
--   Sin esta rama la clase nace con la lista vacia, la policy no la muestra a
--   nadie, y el sintoma es "la clase existe pero no aparece" -- que es
--   exactamente el modo de fallo silencioso que este proyecto ya pago cuatro
--   veces.
--
-- REGLA DE DESEMPATE: si la escritura trae la LISTA, gana la lista.

create or replace function public.videos_sincronizar_planes()
returns trigger
language plpgsql
as $$
declare
  planes_vacios boolean;
  planes_cambiaron boolean;
begin
  planes_vacios := new.planes_permitidos is null
                   or array_length(new.planes_permitidos, 1) is null;

  planes_cambiaron := tg_op = 'INSERT'
                      or new.planes_permitidos is distinct from old.planes_permitidos;

  -- Vino la lista: es la fuente de verdad y el tier se deriva de ella.
  if not planes_vacios and planes_cambiaron then
    new.membership_tier_required := (
      select t
      from unnest(new.planes_permitidos) as t
      order by public.membership_tier_rank(t)
      limit 1
    );
    return new;
  end if;

  -- No vino la lista (o cambio solo el tier): se reconstruye con la regla
  -- vieja, "de ese plan para arriba".
  if planes_vacios
     or (tg_op = 'UPDATE'
         and new.membership_tier_required is distinct from old.membership_tier_required) then
    new.planes_permitidos := (
      select coalesce(array_agg(t order by public.membership_tier_rank(t)), '{}')
      from unnest(enum_range(null::public.membership_tier)) as t
      where t <> 'none'
        and public.membership_tier_rank(t) >= public.membership_tier_rank(new.membership_tier_required)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists videos_sincronizar_planes on public.videos;
create trigger videos_sincronizar_planes
  before insert or update on public.videos
  for each row execute function public.videos_sincronizar_planes();

-- ===========================================================================
-- 4. La policy del catalogo
-- ===========================================================================
-- Se reproduce ENTERA la version vigente (20260805_packs_de_clases.sql, linea
-- 378) y se cambia UNA sola linea: la comparacion de rangos pasa a ser
-- pertenencia a la lista. Todo lo demas queda igual, incluida la rama de packs.
--
-- LO QUE NO CAMBIA Y ES A PROPOSITO:
--   · `status = 'published'` sigue AFUERA del or de packs: comprar un pack da
--     acceso a clases publicadas, no a borradores.
--   · los `(select ...)` alrededor de las funciones son la optimizacion de
--     initplan de 20260728: sin ellos Postgres evalua la funcion una vez POR
--     FILA en vez de una por consulta.
--
-- 🔴 ESTA POLICY PROTEGE EL CATALOGO ENTERO. Verificar por COMPORTAMIENTO, no
--    leyendo el SQL ni mirando pg_policies: `npm run test:aislamiento`.

drop policy if exists "videos_select_allowed_by_tier" on public.videos;
create policy "videos_select_allowed_by_tier"
  on public.videos
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      status = 'published'
      and (
        -- ANTES: membership_tier_rank(current_user_membership_tier())
        --          >= membership_tier_rank(membership_tier_required)
        planes_permitidos @> array[(select public.current_user_membership_tier())]
        or public.current_user_has_purchased_video(id)
      )
    )
  );

-- ===========================================================================
-- 5. El vocabulario de categorias
-- ===========================================================================
-- Las 11 de la lista nueva reemplazan a las que habia (ballet, pilates,
-- stretching, pbt, pct). Momento barato para hacerlo: la base tiene 0 clases,
-- 0 documentos y 0 salas de chat, asi que no hay ni una fila que reapuntar.
--
-- Las viejas se DESACTIVAN, no se borran: `documents.category_slug` y
-- `chat_rooms.category_slug` guardan el slug suelto, y borrar la fila dejaria
-- esos punteros colgados el dia que si haya datos. `is_active = false` las saca
-- de la interfaz y deja el rastro.
--
-- ⚠️ Esta lista tiene que coincidir EXACTO con CATEGORIAS en
--    src/features/studio/catalogo-clases.ts. Si se agrega una alla y no aca, el
--    formulario la ofrece y no existe la categoria detras.

insert into public.categories (slug, name_i18n, description_i18n, sort_order, is_active)
values
  ('ballet',                      '{"es":"Ballet","en":"Ballet"}',                                               '{}',  1, true),
  ('tecnica',                     '{"es":"Técnica","en":"Technique"}',                                           '{}',  2, true),
  ('dehors',                      '{"es":"Dehors","en":"Turnout"}',                                              '{}',  3, true),
  ('movilidad',                   '{"es":"Movilidad","en":"Mobility"}',                                          '{}',  4, true),
  ('stretching',                  '{"es":"Stretching","en":"Stretching"}',                                       '{}',  5, true),
  ('pies-y-tobillos',             '{"es":"Pies y Tobillos","en":"Feet and Ankles"}',                              '{}',  6, true),
  ('equilibrio',                  '{"es":"Equilibrio","en":"Balance"}',                                          '{}',  7, true),
  ('abdominales-para-bailarines', '{"es":"Abdominales para Bailarines","en":"Core for Dancers"}',                 '{}',  8, true),
  ('linea-y-control',             '{"es":"Línea y Control","en":"Line and Control"}',                             '{}',  9, true),
  ('giros',                       '{"es":"Giros","en":"Turns"}',                                                 '{}', 10, true),
  ('preparacion-fisica',          '{"es":"Preparación Física","en":"Physical Conditioning"}',                     '{}', 11, true)
on conflict (slug) do update
  set name_i18n  = excluded.name_i18n,
      sort_order = excluded.sort_order,
      is_active  = true;

update public.categories
set is_active = false
where is_active = true
  and slug <> all (array[
    'ballet', 'tecnica', 'dehors', 'movilidad', 'stretching',
    'pies-y-tobillos', 'equilibrio', 'abdominales-para-bailarines',
    'linea-y-control', 'giros', 'preparacion-fisica'
  ]);

-- ===========================================================================
-- VERIFICACION POST-RUN
-- ===========================================================================
-- Copiar y correr aparte. Ninguna de estas reemplaza a `npm run
-- test:aislamiento`, que es lo unico que prueba el acceso por COMPORTAMIENTO.
--
-- a) Las dos columnas nuevas, y ninguna clase con la lista vacia:
--
--    select count(*) filter (where array_length(planes_permitidos,1) is null) as sin_planes,
--           count(*) filter (where content_type not in ('clase','mini_training')) as tipo_raro,
--           count(*) as total
--    from public.videos;
--    -- sin_planes = 0, tipo_raro = 0
--
-- b) El trigger deriva bien en los dos sentidos:
--
--    -- de la lista al tier
--    insert into public.videos (slug, title_i18n, duration_seconds, planes_permitidos)
--    values ('tmp-verif', '{"es":"tmp"}', 60, array['principal','corps_de_ballet']::public.membership_tier[])
--    returning membership_tier_required, planes_permitidos;
--    -- membership_tier_required = corps_de_ballet  (el mas bajo de la lista)
--
--    -- del tier a la lista
--    update public.videos set membership_tier_required = 'solista' where slug = 'tmp-verif'
--    returning planes_permitidos;
--    -- {solista,principal}
--
--    delete from public.videos where slug = 'tmp-verif';
--
-- c) El check rechaza lo que tiene que rechazar (las dos tienen que FALLAR):
--
--    update public.videos set planes_permitidos = '{}' where slug is not null;
--    update public.videos set planes_permitidos = array['none']::public.membership_tier[] where slug is not null;
--
-- d) Las 11 categorias activas y ninguna vieja:
--
--    select slug, is_active from public.categories order by is_active desc, sort_order;
--    -- 11 activas; pilates / pbt / pct en false
--
-- e) La policy quedo con LAS DOS ramas (planes Y packs):
--
--    select pg_get_expr(polqual, polrelid) from pg_policy
--    where polname = 'videos_select_allowed_by_tier';
--    -- tiene que nombrar planes_permitidos Y current_user_has_purchased_video.
--    -- Si falta la segunda, esta migracion corrio antes que packs: volver a
--    -- correr packs y despues esta.
