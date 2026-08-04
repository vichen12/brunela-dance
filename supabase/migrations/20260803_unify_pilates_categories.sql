-- Brunela Dance Trainer
-- 2026-08-03: "Reformer" y "Mat" se unifican en una sola categoria "Pilates".
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE
--   Pedido de Brunela. Separar reformer de mat obliga a la alumna a saber en
--   que maquina se hace algo antes de poder buscarlo, que es una distincion de
--   la profesora, no de quien entrena.
--
-- POR QUE ESTA MIGRACION Y NO SOLO UN CAMBIO DE CODIGO
--   El slug de una categoria vive en CUATRO lugares, y tres son datos:
--
--     1. public.categories.slug          la categoria en si
--     2. public.videos.category_slugs    text[] -- por eso es el caso dificil
--     3. public.documents.category_slug  text
--     4. public.chat_rooms.category_slug text  -- salas por categoria
--
--   Si se cambia solo el codigo, las clases quedan con category_slugs = 'mat'
--   apuntando a una categoria que la interfaz ya no ofrece: dejan de aparecer
--   en todos los filtros y se vuelven invisibles sin dar ningun error.
--
-- LA PARTE QUE PUEDE SALIR MAL
--   `videos.category_slugs` es un ARRAY. Una clase puede estar en 'reformer' Y
--   en 'mat' a la vez; el reemplazo ingenuo la dejaria con
--   {'pilates','pilates'}, o sea la categoria repetida. Por eso el update de
--   abajo desarma el array, reemplaza, DEDUPLICA y lo vuelve a armar,
--   conservando el orden original.
--
-- IDEMPOTENTE
--   Se puede correr dos veces. La segunda no encuentra nada que cambiar.

begin;

-- ---------------------------------------------------------------------------
-- 1. La categoria destino
-- ---------------------------------------------------------------------------
-- sort_order 2, que es el que tenia 'reformer': queda donde la alumna ya
-- esperaba encontrar pilates, entre Ballet y Stretching.

insert into public.categories (slug, name_i18n, description_i18n, sort_order, is_active)
values (
  'pilates',
  '{"es":"Pilates","en":"Pilates","fr":"Pilates","it":"Pilates"}',
  '{"es":"Pilates en suelo y en maquina reformer.","en":"Mat and reformer pilates."}',
  2,
  true
)
on conflict (slug) do update
  set is_active  = true,
      sort_order = 2;

-- ---------------------------------------------------------------------------
-- 2. videos.category_slugs (array) -- reemplazar y deduplicar
-- ---------------------------------------------------------------------------
-- El with ordinality preserva el orden en que estaban los slugs: sin el, una
-- clase de {'ballet','reformer'} podria terminar como {'pilates','ballet'} y
-- cambiaria el degrade de su tarjeta, que se elige por el PRIMER slug.

update public.videos v
set category_slugs = sub.slugs
from (
  select
    x.id,
    array_agg(distinct_slug order by min_ord) as slugs
  from (
    select
      vid.id,
      case when s.slug in ('reformer', 'mat') then 'pilates' else s.slug end as distinct_slug,
      min(s.ord) as min_ord
    from public.videos vid,
         lateral unnest(vid.category_slugs) with ordinality as s(slug, ord)
    where vid.category_slugs && array['reformer', 'mat']
    group by vid.id,
             case when s.slug in ('reformer', 'mat') then 'pilates' else s.slug end
  ) x
  group by x.id
) sub
where v.id = sub.id;

-- ---------------------------------------------------------------------------
-- 3. Las dos columnas de texto simple
-- ---------------------------------------------------------------------------

update public.documents
   set category_slug = 'pilates'
 where category_slug in ('reformer', 'mat');

update public.chat_rooms
   set category_slug = 'pilates'
 where category_slug in ('reformer', 'mat');

-- ---------------------------------------------------------------------------
-- 4. Retirar las viejas
-- ---------------------------------------------------------------------------
-- Se DESACTIVAN, no se borran. Un delete perderia el nombre y la descripcion
-- si mas adelante hay que auditar por que una clase quedo donde quedo, y no
-- gana nada: is_active = false ya las saca de toda la interfaz.

update public.categories
   set is_active = false
 where slug in ('reformer', 'mat');

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) No queda ninguna referencia viva a las viejas. Esperado: cero filas.
--
-- select 'videos' as tabla, count(*) from public.videos
--  where category_slugs && array['reformer','mat']
-- union all
-- select 'documents', count(*) from public.documents
--  where category_slug in ('reformer','mat')
-- union all
-- select 'chat_rooms', count(*) from public.chat_rooms
--  where category_slug in ('reformer','mat');
--
-- b) Ninguna clase quedo con la categoria repetida. Esperado: cero filas.
--
-- select id, slug, category_slugs
--   from public.videos
--  where array_length(category_slugs, 1)
--        <> (select count(distinct s) from unnest(category_slugs) s);
--
-- c) Las categorias activas, en orden:
--
-- select slug, sort_order, is_active from public.categories order by sort_order;
--   esperado activas: ballet(1), pilates(2), stretching(4), pbt(5), pct(6)
--            inactivas: reformer, mat
--
-- d) A ojo, en la aplicacion: /dashboard/library tiene que mostrar el chip
--    "Pilates" y ninguna clase puede haber desaparecido del listado "Todas".
