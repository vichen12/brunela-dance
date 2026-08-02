-- Brunela Dance Trainer — datos de DEMO para evaluar diseño
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- QUE ES ESTO
--   Contenido falso para poder mirar la grilla de clases, los programas y las
--   sesiones en vivo con volumen real, en vez de con una o dos filas. Sirve
--   para evaluar el diseño, NO es contenido de producción.
--
-- POR QUE VIVE EN scripts/ Y NO EN supabase/migrations/
--   Una migración describe el ESQUEMA y se corre siempre, en todos los
--   entornos. Esto son DATOS descartables que se corren cuando uno quiere.
--   Mezclarlos haría que cualquier base reconstruida desde el repo naciera con
--   18 clases falsas adentro.
--
-- IDEMPOTENTE
--   Todo va con `on conflict (slug) do update`. Correrlo dos veces no duplica
--   nada: refresca las filas existentes. Las fechas de las sesiones en vivo se
--   recalculan desde now(), así que volver a correrlo las devuelve al futuro.
--
-- COMO SE BORRA (todo junto, al final del archivo hay un bloque listo)
--   Cada fila de contenido lleva slug con prefijo `demo-`, así que se limpia
--   con un `delete ... where slug like 'demo-%'`.
--
-- ============================================================================
-- DOS LIMITACIONES, A PROPOSITO
-- ============================================================================
--
--   1. NO CREA USUARIOS. Las cuentas viven en auth.users y se crean por la API
--      de Auth, no por SQL del esquema public. Este script sólo siembra
--      contenido.
--
--   2. LOS VIDEOS DEMO NO REPRODUCEN. No tienen bunny_video_id, así que el
--      reproductor no va a levantar nada. Es para ver la grilla, las tarjetas,
--      los filtros y los estados vacíos — no el player.
--
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Categorías
-- ----------------------------------------------------------------------------
-- OJO: estas van SIN prefijo demo-, a propósito.
--
-- Los slugs de categoría son taxonomía del producto, no contenido descartable:
-- `videos.category_slugs` los referencia y la pantalla de programas los traduce
-- a etiquetas de foco por slug (FOCO_LABEL en app/dashboard/programs/page.tsx).
-- Si acá se llamaran `demo-ballet`, la interfaz mostraría "demo-ballet" crudo en
-- vez de "Tecnica". Son las mismas seis categorías que usa el producto real.
--
-- Por eso van con `do nothing`: si ya existen, no se tocan.

insert into public.categories (slug, name_i18n, description_i18n, sort_order, is_active)
values
  ('ballet',     '{"es":"Ballet","en":"Ballet"}',          '{"es":"Tecnica clasica en barra y centro."}',   1, true),
  ('reformer',   '{"es":"Reformer","en":"Reformer"}',      '{"es":"Pilates en maquina reformer."}',          2, true),
  ('mat',        '{"es":"Mat","en":"Mat"}',                '{"es":"Pilates en suelo, sin maquina."}',        3, true),
  ('stretching', '{"es":"Stretching","en":"Stretching"}',  '{"es":"Movilidad y elongacion."}',               4, true),
  ('pbt',        '{"es":"PBT","en":"PBT"}',                '{"es":"Progressing Ballet Technique."}',         5, true),
  ('pct',        '{"es":"PCT","en":"PCT"}',                '{"es":"Control y alineacion postural."}',        6, true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Clases (18)
-- ----------------------------------------------------------------------------

insert into public.videos (
  slug, title_i18n, description_i18n, status, membership_tier_required,
  duration_seconds, recommended_min_level, recommended_max_level,
  equipment, category_slugs, thumbnail_url, is_featured, sort_order, published_at
)
select
  v.slug,
  jsonb_build_object('es', v.title_es, 'en', v.title_en),
  jsonb_build_object('es', v.desc_es),
  'published'::public.video_status,
  v.tier::public.membership_tier,
  v.mins * 60,
  v.min_level::public.technical_level,
  'maestro'::public.technical_level,
  case when v.equip = '' then '{}'::text[] else array[v.equip] end,
  array[v.cat],
  'https://picsum.photos/seed/' || v.slug || '/900/600',
  v.featured,
  v.sort,
  timezone('utc', now()) - (v.sort || ' days')::interval
from (values
  ('demo-barra-suelo-i',       'Barra de suelo I',        'Floor barre I',        'Barra clasica trabajada en el suelo, sin carga en las articulaciones.', 'corps_de_ballet', 32, 'principiante', '',          'ballet',     true,   1),
  ('demo-barra-suelo-ii',      'Barra de suelo II',       'Floor barre II',       'Continuacion de la barra de suelo, con mas rango y control.',           'solista',         38, 'intermedio',   '',          'ballet',     false,  2),
  ('demo-centro-adagio',       'Centro y adagio',         'Center and adagio',    'Trabajo de centro con enfasis en equilibrio y linea sostenida.',        'solista',         44, 'intermedio',   '',          'ballet',     false,  3),
  ('demo-puntas-iniciacion',   'Puntas: iniciacion',      'Pointe: beginners',    'Primeros ejercicios en puntas, con foco en el tobillo y el empeine.',   'principal',       28, 'avanzado',     'puntas',    'ballet',     true,   4),
  ('demo-reformer-fundamentos','Reformer: fundamentos',   'Reformer basics',      'Los principios del reformer: respiracion, alineacion y muelles.',       'corps_de_ballet', 35, 'principiante', 'reformer',  'reformer',   true,   5),
  ('demo-reformer-piernas',    'Reformer: piernas',       'Reformer: legs',       'Secuencia de piernas en reformer, fuerza y estabilidad de cadera.',     'solista',         42, 'intermedio',   'reformer',  'reformer',   false,  6),
  ('demo-reformer-core',       'Reformer: centro',        'Reformer: core',       'Centro profundo en reformer, con progresiones por nivel.',              'solista',         40, 'intermedio',   'reformer',  'reformer',   false,  7),
  ('demo-mat-basico',          'Mat basico',              'Basic mat',            'Serie de suelo clasica, ideal para empezar.',                           'corps_de_ballet', 25, 'principiante', 'mat',       'mat',        false,  8),
  ('demo-mat-abdominal',       'Mat: abdominal profundo', 'Mat: deep core',       'Trabajo abdominal sin comprometer la zona lumbar.',                     'corps_de_ballet', 30, 'principiante', 'mat',       'mat',        false,  9),
  ('demo-mat-espalda-sana',    'Mat: espalda sana',       'Mat: healthy back',    'Fortalecimiento de la cadena posterior para cuidar la espalda.',        'solista',         36, 'intermedio',   'mat',       'mat',        false, 10),
  ('demo-stretch-caderas',     'Apertura de caderas',     'Hip opening',          'Movilidad de cadera progresiva, sin forzar el rango.',                  'corps_de_ballet', 22, 'principiante', 'banda',     'stretching', false, 11),
  ('demo-stretch-isquios',     'Isquiotibiales',          'Hamstrings',           'Elongacion de isquios con y sin banda.',                                'corps_de_ballet', 18, 'principiante', 'banda',     'stretching', false, 12),
  ('demo-stretch-espalda',     'Espalda y dorsales',      'Back and lats',        'Apertura toracica y trabajo de dorsales.',                              'solista',         24, 'intermedio',   '',          'stretching', false, 13),
  ('demo-pbt-nivel-1',         'PBT nivel 1',             'PBT level 1',          'Progressing Ballet Technique: memoria muscular con pelota.',            'solista',         45, 'intermedio',   'pelota',    'pbt',        true,  14),
  ('demo-pbt-nivel-2',         'PBT nivel 2',             'PBT level 2',          'PBT avanzado: control en releve y trabajo de en dehors.',               'principal',       50, 'avanzado',     'pelota',    'pbt',        false, 15),
  ('demo-pct-alineacion',      'PCT: alineacion',         'PCT: alignment',       'Control postural y conciencia de eje.',                                 'solista',         33, 'intermedio',   '',          'pct',        false, 16),
  ('demo-pct-control',         'PCT: control avanzado',   'PCT: advanced control','Transferencias de peso y control en desequilibrio.',                    'principal',       47, 'avanzado',     '',          'pct',        false, 17),
  ('demo-cool-down',           'Vuelta a la calma',       'Cool down',            'Quince minutos de cierre para despues de cualquier clase.',             'corps_de_ballet', 15, 'principiante', '',          'stretching', false, 18)
) as v(slug, title_es, title_en, desc_es, tier, mins, min_level, equip, cat, featured, sort)
on conflict (slug) do update set
  title_i18n               = excluded.title_i18n,
  description_i18n         = excluded.description_i18n,
  status                   = excluded.status,
  membership_tier_required = excluded.membership_tier_required,
  duration_seconds         = excluded.duration_seconds,
  recommended_min_level    = excluded.recommended_min_level,
  equipment                = excluded.equipment,
  category_slugs           = excluded.category_slugs,
  thumbnail_url            = excluded.thumbnail_url,
  is_featured              = excluded.is_featured,
  sort_order               = excluded.sort_order,
  published_at             = excluded.published_at,
  updated_at               = timezone('utc', now());

-- ----------------------------------------------------------------------------
-- 3. Programas (3)
-- ----------------------------------------------------------------------------

insert into public.programs (
  slug, title_i18n, description_i18n, status, membership_tier_required,
  duration_days, cover_image_url, is_featured, published_at
)
select
  p.slug,
  jsonb_build_object('es', p.title_es, 'en', p.title_en),
  jsonb_build_object('es', p.desc_es),
  'published'::public.program_status,
  p.tier::public.membership_tier,
  p.days,
  'https://picsum.photos/seed/' || p.slug || '/1200/800',
  p.featured,
  timezone('utc', now()) - (p.sort || ' days')::interval
from (values
  ('demo-fundamentos-7-dias',    'Fundamentos en 7 dias',   'Fundamentals in 7 days', 'Una semana para ordenar la base: alineacion, centro y respiracion.', 'corps_de_ballet', 7, true,  1),
  ('demo-fuerza-reformer-5',     'Fuerza en reformer',      'Reformer strength',      'Cinco dias de reformer progresivo, de fundamentos a centro profundo.', 'solista',        5, false, 2),
  ('demo-movilidad-5-dias',      'Movilidad en 5 dias',     'Mobility in 5 days',     'Cinco sesiones cortas para ganar rango sin perder control.',          'corps_de_ballet', 5, false, 3)
) as p(slug, title_es, title_en, desc_es, tier, days, featured, sort)
on conflict (slug) do update set
  title_i18n               = excluded.title_i18n,
  description_i18n         = excluded.description_i18n,
  status                   = excluded.status,
  membership_tier_required = excluded.membership_tier_required,
  duration_days            = excluded.duration_days,
  cover_image_url          = excluded.cover_image_url,
  is_featured              = excluded.is_featured,
  published_at             = excluded.published_at,
  updated_at               = timezone('utc', now());

-- ----------------------------------------------------------------------------
-- 4. Días de cada programa
-- ----------------------------------------------------------------------------

insert into public.program_days (program_id, day_number, video_id)
select pr.id, d.day_number, vi.id
from (values
  ('demo-fundamentos-7-dias', 1, 'demo-mat-basico'),
  ('demo-fundamentos-7-dias', 2, 'demo-barra-suelo-i'),
  ('demo-fundamentos-7-dias', 3, 'demo-stretch-caderas'),
  ('demo-fundamentos-7-dias', 4, 'demo-mat-abdominal'),
  ('demo-fundamentos-7-dias', 5, 'demo-reformer-fundamentos'),
  ('demo-fundamentos-7-dias', 6, 'demo-stretch-isquios'),
  ('demo-fundamentos-7-dias', 7, 'demo-cool-down'),

  ('demo-fuerza-reformer-5',  1, 'demo-reformer-fundamentos'),
  ('demo-fuerza-reformer-5',  2, 'demo-reformer-piernas'),
  ('demo-fuerza-reformer-5',  3, 'demo-reformer-core'),
  ('demo-fuerza-reformer-5',  4, 'demo-mat-espalda-sana'),
  ('demo-fuerza-reformer-5',  5, 'demo-cool-down'),

  ('demo-movilidad-5-dias',   1, 'demo-stretch-caderas'),
  ('demo-movilidad-5-dias',   2, 'demo-stretch-isquios'),
  ('demo-movilidad-5-dias',   3, 'demo-stretch-espalda'),
  ('demo-movilidad-5-dias',   4, 'demo-pct-alineacion'),
  ('demo-movilidad-5-dias',   5, 'demo-cool-down')
) as d(program_slug, day_number, video_slug)
join public.programs pr on pr.slug = d.program_slug
join public.videos   vi on vi.slug = d.video_slug
on conflict (program_id, day_number) do update set
  video_id   = excluded.video_id,
  updated_at = timezone('utc', now());

-- ----------------------------------------------------------------------------
-- 5. Sesiones en vivo (3, siempre en el futuro)
-- ----------------------------------------------------------------------------
-- Las fechas se calculan desde now(), así que volver a correr el script las
-- reprograma hacia adelante en vez de dejarlas vencidas.

insert into public.live_sessions (
  slug, title_i18n, description_i18n, status, membership_tier_required,
  starts_at, ends_at, session_timezone, capacity,
  booking_opens_at, booking_closes_at, cover_image_url, published_at
)
select
  s.slug,
  jsonb_build_object('es', s.title_es, 'en', s.title_en),
  jsonb_build_object('es', s.desc_es),
  'scheduled'::public.live_session_status,
  s.tier::public.membership_tier,
  timezone('utc', now()) + (s.in_days || ' days')::interval,
  timezone('utc', now()) + (s.in_days || ' days')::interval + (s.mins || ' minutes')::interval,
  'Europe/Madrid',
  s.capacity,
  timezone('utc', now()) - interval '1 day',
  timezone('utc', now()) + (s.in_days || ' days')::interval - interval '2 hours',
  'https://picsum.photos/seed/' || s.slug || '/1200/800',
  timezone('utc', now()) - interval '3 days'
from (values
  ('demo-live-barra-abierta',  'Barra abierta en vivo',   'Open barre live',    'Clase de barra en directo, con correcciones personalizadas.', 'corps_de_ballet',  3, 60, 25),
  ('demo-live-reformer-grupo', 'Reformer en grupo',       'Group reformer',     'Sesion de reformer en vivo para grupo reducido.',             'solista',          8, 50, 12),
  ('demo-live-taller-puntas',  'Taller de puntas',        'Pointe workshop',    'Taller intensivo de puntas, plazas muy limitadas.',           'principal',       15, 90,  8)
) as s(slug, title_es, title_en, desc_es, tier, in_days, mins, capacity)
on conflict (slug) do update set
  title_i18n               = excluded.title_i18n,
  description_i18n         = excluded.description_i18n,
  status                   = excluded.status,
  membership_tier_required = excluded.membership_tier_required,
  starts_at                = excluded.starts_at,
  ends_at                  = excluded.ends_at,
  session_timezone         = excluded.session_timezone,
  capacity                 = excluded.capacity,
  booking_opens_at         = excluded.booking_opens_at,
  booking_closes_at        = excluded.booking_closes_at,
  cover_image_url          = excluded.cover_image_url,
  published_at             = excluded.published_at,
  updated_at               = timezone('utc', now());

commit;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--
-- select 'videos' t, count(*) from public.videos where slug like 'demo-%'
-- union all select 'programs',      count(*) from public.programs      where slug like 'demo-%'
-- union all select 'live_sessions', count(*) from public.live_sessions where slug like 'demo-%'
-- union all select 'program_days',  count(*) from public.program_days pd
--             join public.programs p on p.id = pd.program_id where p.slug like 'demo-%';
--
-- Esperado: 18 videos, 3 programs, 3 live_sessions, 17 program_days.

-- ============================================================================
-- LIMPIEZA — borra TODO lo sembrado por este script
-- ============================================================================
--
-- El orden importa: program_days y las reservas cuelgan de programas y
-- sesiones. user_progress referencia videos, y videos tiene `on delete
-- restrict` desde program_days, así que los días se van primero.
--
-- begin;
--
-- delete from public.program_days pd
--  using public.programs p
--  where p.id = pd.program_id and p.slug like 'demo-%';
--
-- delete from public.live_session_bookings b
--  using public.live_sessions s
--  where s.id = b.live_session_id and s.slug like 'demo-%';
--
-- delete from public.live_session_access_links l
--  using public.live_sessions s
--  where s.id = l.live_session_id and s.slug like 'demo-%';
--
-- delete from public.user_progress up
--  using public.videos v
--  where v.id = up.video_id and v.slug like 'demo-%';
--
-- delete from public.live_sessions where slug like 'demo-%';
-- delete from public.programs      where slug like 'demo-%';
-- delete from public.videos        where slug like 'demo-%';
--
-- commit;
--
-- Las categorías NO se borran acá: son taxonomía real del producto, no data
-- demo. Ver la nota del bloque 1.
