-- Brunela Dance Trainer
-- 2026-09-17: la portada editable desde el panel.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   PEGAR SOLO EL SQL, SIN el `begin;` ni el `commit;` de abajo. Trampa 7: el
--   editor ya envuelve lo pegado en su transaccion, y un `commit;` propio la
--   cierra antes de tiempo. Lo que sigue se ejecuta SIN ERROR VISIBLE y no
--   persiste. El editor dice "Success" y la base queda igual.
--
-- ⚠️ ORDEN: va al final, despues de todo. No redefine ninguna funcion ni
--    ninguna policy existente, asi que no puede pisar comprobaciones de otra
--    migracion (trampa 8). Solo necesita que ya existan `public.profiles`,
--    `public.is_admin()` y `public.set_current_timestamp_updated_at()`, las
--    tres de phase_a.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUE CAMBIA CONCEPTUALMENTE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hasta hoy los textos de la portada viven en `src/i18n/public.ts`: 181 claves
-- por idioma, cuatro idiomas, compiladas dentro del bundle. Cambiar una coma
-- es un deploy.
--
-- 🔴 ESTO NO REEMPLAZA ESE DICCIONARIO. LO PISA.
--
--    Es la decision central de todo el cambio y conviene entenderla antes de
--    correr nada. `landing_texts` es una CAPA DE OVERRIDE: nace vacia, y una
--    tabla vacia significa "la portada de siempre". El diccionario estatico se
--    queda donde esta y sigue siendo el piso.
--
--    De ahi sale, gratis, la respuesta a "¿y si la base no responde?": la capa
--    de override llega vacia y se renderiza exactamente la landing de hoy. No
--    existe el estado en que la portada quede en blanco o muestre nombres de
--    claves. Lo mismo si alguien borra una fila por accidente: vuelve el texto
--    original, no un hueco.
--
--    Por eso ESTA MIGRACION NO SIEMBRA NADA. Sembrar los textos actuales seria
--    duplicarlos en dos lugares que despues se desincronizan en silencio, que
--    es la familia de errores que ya costo cuatro veces en este proyecto.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE `auto_i18n` GUARDA EL TEXTO EN ESPAÑOL Y NO UN BOOLEANO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El panel tiene que contestar DOS preguntas distintas sobre cada idioma:
--
--   1. ¿Esto lo tradujo la maquina o lo escribio Brunela?
--   2. ¿Sigue estando al dia, o el español cambio despues?
--
-- La segunda es la importante, y es la que se resuelve mal por defecto. El
-- escenario: Brunela reescribe "Sobre mi", lo ve perfecto en español, y en
-- frances queda para siempre la version anterior. Nada avisa. La portada
-- miente en tres idiomas y no hay error en ningun log.
--
-- `auto_i18n` guarda, por idioma, EL TEXTO EN ESPAÑOL DEL QUE SE TRADUJO. Con
-- eso las dos preguntas salen de una sola columna:
--
--   traducido a maquina  ⟺  auto_i18n ? 'fr'
--   quedo desactualizado ⟺  auto_i18n ->> 'fr' <> value_i18n ->> 'es'
--
-- Y si Brunela corrige el frances a mano, se borra esa clave de `auto_i18n`:
-- deja de ser automatico y deja de avisar. Guardar el texto entero en vez de un
-- hash es a proposito -- son frases cortas, y un hash obliga a elegir algoritmo
-- y a que las dos puntas coincidan para siempre.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE LOS CERTIFICADOS NO LLEVAN TABLA PROPIA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Son cinco etiquetas cortas ("Ballet", "Pilates", "PBT", "PCT", "RAD CPD
-- Credits"), hoy un array pelado en app/page.tsx:223 sin traduccion de ningun
-- tipo. No tienen estado propio: no se publican ni se despublican, no tienen
-- fecha, no los referencia nadie.
--
-- Una tabla entera con su RLS, su policy, su grant y sus pruebas de aislamiento
-- no se paga sola para eso. Van como lista JSON en `landing_texts`, bajo la
-- clave `about.highlights`. Reordenar es mover un array.
--
-- Por eso `value_i18n` admite un array ademas de una cadena: ver el check.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- EL FAQ SI LLEVA TABLA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Porque tiene lo que los certificados no: orden, estado de publicacion, y
-- respuestas largas. "Despublicar una pregunta" es un concepto de fila. Meterlo
-- en un JSON obligaria a reescribir el blob entero para mover una pregunta de
-- lugar.

begin;

-- ---------------------------------------------------------------------------
-- 1. Los textos de la portada
-- ---------------------------------------------------------------------------

create table if not exists public.landing_texts (
  key text primary key,

  -- { "es": "...", "en": "...", "fr": "...", "it": "..." }
  -- o, para las listas: { "es": ["Ballet", "Pilates"], ... }
  value_i18n jsonb not null default '{}'::jsonb,

  -- Por idioma, el texto en español del que se tradujo. Ver la nota de arriba.
  auto_i18n jsonb not null default '{}'::jsonb,

  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint landing_texts_value_is_object check (jsonb_typeof(value_i18n) = 'object'),
  constraint landing_texts_auto_is_object  check (jsonb_typeof(auto_i18n) = 'object'),

  -- La lista blanca de claves editables vive en el codigo
  -- (src/features/admin/portada/campos.ts), no aca: cada campo nuevo lleva
  -- etiqueta en español, seccion y tipo de control, y eso no entra en un check
  -- constraint sin volver una migracion cada texto nuevo.
  --
  -- Lo que SI impone Postgres es la forma: nada de claves con espacios, comillas
  -- ni rutas. Es la red de contencion, no la puerta.
  constraint landing_texts_key_format check (key ~ '^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$')
);

drop trigger if exists trg_landing_texts_updated_at on public.landing_texts;
create trigger trg_landing_texts_updated_at
  before update on public.landing_texts
  for each row execute procedure public.set_current_timestamp_updated_at();

-- ---------------------------------------------------------------------------
-- 2. El FAQ
-- ---------------------------------------------------------------------------

create table if not exists public.landing_faq (
  id uuid primary key default gen_random_uuid(),

  display_order integer not null default 0,
  is_published boolean not null default false,

  question_i18n jsonb not null default '{}'::jsonb,
  answer_i18n   jsonb not null default '{}'::jsonb,

  -- Dos columnas y no una: pregunta y respuesta se traducen por separado y se
  -- desactualizan por separado. Ver la nota sobre `auto_i18n`.
  question_auto_i18n jsonb not null default '{}'::jsonb,
  answer_auto_i18n   jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint landing_faq_question_is_object check (jsonb_typeof(question_i18n) = 'object'),
  constraint landing_faq_answer_is_object   check (jsonb_typeof(answer_i18n) = 'object'),
  constraint landing_faq_q_auto_is_object   check (jsonb_typeof(question_auto_i18n) = 'object'),
  constraint landing_faq_a_auto_is_object   check (jsonb_typeof(answer_auto_i18n) = 'object'),

  -- 🔴 NO SE PUEDE PUBLICAR UNA PREGUNTA VACIA.
  --    Sin esto, un enter de mas en el panel mete un acordeon en blanco en la
  --    portada. Es publico: lo ve quien todavia no es clienta. La validacion
  --    esta tambien en la accion, con un mensaje legible; esta es la que no se
  --    puede saltear fabricando el POST a mano.
  constraint landing_faq_publicada_tiene_contenido check (
    not is_published
    or (
      coalesce(btrim(question_i18n ->> 'es'), '') <> ''
      and coalesce(btrim(answer_i18n ->> 'es'), '') <> ''
    )
  )
);

create index if not exists landing_faq_orden_idx
  on public.landing_faq (display_order)
  where is_published;

drop trigger if exists trg_landing_faq_updated_at on public.landing_faq;
create trigger trg_landing_faq_updated_at
  before update on public.landing_faq
  for each row execute procedure public.set_current_timestamp_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS, policies y grants
-- ---------------------------------------------------------------------------
--
-- Las dos tablas las escribe el panel con `service_role`, que saltea RLS. Las
-- policies de abajo NO son decorativas por eso: son la red para el dia que
-- alguien lea estas tablas con el cliente de sesion, que es como se cuelan los
-- agujeros en este proyecto (la interfaz respeta la columna, la policy no).
--
-- `anon` no recibe nada, y no le hace falta: la portada se renderiza en el
-- servidor. Es la misma decision que en `packs_publicos`, y el motivo tambien:
-- anon no es "la visitante", es cualquiera en internet con la clave publicable
-- que esta en el HTML.

alter table public.landing_texts enable row level security;
alter table public.landing_faq   enable row level security;

drop policy if exists "landing_texts_admin_manage" on public.landing_texts;
create policy "landing_texts_admin_manage"
  on public.landing_texts
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "landing_faq_admin_manage" on public.landing_faq;
create policy "landing_faq_admin_manage"
  on public.landing_faq
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nacen despues del grant global de 20260801_data_api_grants, asi que los
-- privilegios por defecto estan en CERO: sin grant propio, el primer SELECT
-- devuelve 42501. Lo comprueba `npm run verificar`.
--
-- Se le da a `authenticated` porque la policy de arriba ya filtra por admin: el
-- grant abre la puerta, la policy dice quien pasa. Sin DELETE en el grant, la
-- policy `for all` no podria borrar ni siendo admin.
grant select, insert, update, delete on public.landing_texts to authenticated;
grant select, insert, update, delete on public.landing_faq   to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Las vistas que consume la portada
-- ---------------------------------------------------------------------------
--
-- POR QUE UNA VISTA Y NO UNA LISTA DE COLUMNAS EN TYPESCRIPT
--
--   Mismo motivo que `packs_publicos`, mas uno nuevo que es de rendimiento y no
--   de seguridad:
--
--   1. SEGURIDAD. `landing_faq` tiene preguntas SIN PUBLICAR -- borradores que
--      Brunela esta escribiendo. La vista filtra por `is_published`, asi que un
--      borrador no puede llegar a la portada ni por un `select *` distraido.
--      La restriccion la impone Postgres y no un comentario.
--
--   2. PESO. `auto_i18n` guarda una copia del español por cada idioma
--      traducido: es contabilidad del panel y, si viajara, PRACTICAMENTE
--      DUPLICARIA el payload que se inyecta en el HTML de cada visitante. La
--      vista no lo selecciona, asi que no puede viajar.
--
-- `security_invoker = true`: la vista se evalua con los permisos de quien la
-- consulta, no del dueño. Sin eso seria un agujero con forma de vista.

drop view if exists public.landing_textos_publicos;
create view public.landing_textos_publicos
with (security_invoker = true)
as
select
  t.key,
  t.value_i18n
from public.landing_texts t;

drop view if exists public.landing_faq_publico;
create view public.landing_faq_publico
with (security_invoker = true)
as
select
  f.id,
  f.display_order,
  f.question_i18n,
  f.answer_i18n
from public.landing_faq f
where f.is_published
order by f.display_order, f.created_at;

revoke all on public.landing_textos_publicos from public;
revoke all on public.landing_textos_publicos from anon;
revoke all on public.landing_textos_publicos from authenticated;
grant select on public.landing_textos_publicos to service_role;

revoke all on public.landing_faq_publico from public;
revoke all on public.landing_faq_publico from anon;
revoke all on public.landing_faq_publico from authenticated;
grant select on public.landing_faq_publico to service_role;

-- ---------------------------------------------------------------------------
-- 5. El bucket del trailer
-- ---------------------------------------------------------------------------
--
-- 🔴 ESTE BUCKET ES PUBLICO, Y ES EL UNICO DEL PROYECTO QUE LO ES.
--
--    `studio-documents` es privado porque son contenido PAGO y una URL se
--    comparte por WhatsApp en dos segundos. Aca es al reves: el trailer es
--    material de marketing, esta en la portada, y el objetivo literal es que lo
--    vea cualquiera. Firmarlo seria firmar un cartel de la calle.
--
-- ⚠️ LO QUE HAY QUE VIGILAR NO ES EL ACCESO, ES EL EGRESS.
--    El proyecto esta en plan Free: 5 GB de trafico de Storage al mes. Un video
--    que arranca solo en la portada los consume rapido -- a 8 MB por visita, son
--    ~600 visitas. No rompe nada cuando se pasa: Supabase corta el bucket, el
--    <video> cae en su `poster` y la seccion se ve como hoy. Pero conviene
--    saberlo antes y no descubrirlo por un correo.
--
--    El limite por archivo son 50 MiB, que es el techo del plan Free. Un trailer
--    de portada deberia pesar bastante menos: si no entra, el problema es el
--    archivo, no el limite.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-media',
  'landing-media',
  true,
  52428800,
  array[
    'video/mp4',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leer no necesita policy: en un bucket publico la lectura va por
-- /storage/v1/object/public/... y no pasa por RLS. Esta policy es solo para
-- ESCRIBIR, y solo la admin escribe.
drop policy if exists "landing_media_admin_write" on storage.objects;
create policy "landing_media_admin_write"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'landing-media' and public.is_admin())
  with check (bucket_id = 'landing-media' and public.is_admin());

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- Correrlas DESPUES, en una ejecucion aparte. Y verificar tambien por
-- COMPORTAMIENTO con `npm run test:aislamiento`, no solo por metadatos: una
-- consulta mal escrita sobre pg_policies tambien engaña (paso con
-- '%tier_required%', que es substring de 'membership_tier_required').
--
-- 1. Las dos tablas existen, con RLS:
--
--    select relname, relrowsecurity
--      from pg_class
--     where relname in ('landing_texts', 'landing_faq');
--    esperado: las dos en true
--
-- 2. Una policy por tabla:
--
--    select tablename, policyname from pg_policies
--     where tablename in ('landing_texts', 'landing_faq');
--    esperado: landing_texts_admin_manage, landing_faq_admin_manage
--
-- 3. Los grants: `authenticated` con los cuatro, `anon` con NINGUNO.
--
--    select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
--      from information_schema.role_table_grants
--     where table_name in ('landing_texts', 'landing_faq')
--       and grantee in ('anon', 'authenticated')
--     group by table_name, grantee;
--    esperado: SOLO filas de authenticated, con DELETE, INSERT, SELECT, UPDATE.
--              Ninguna fila de anon. Si aparece anon, algo salio mal.
--
-- 4. Las vistas responden solo a service_role:
--
--    select table_name, grantee, privilege_type
--      from information_schema.role_table_grants
--     where table_name in ('landing_textos_publicos', 'landing_faq_publico');
--    esperado: solo service_role / SELECT
--
-- 5. El bucket quedo publico:
--
--    select id, public, file_size_limit from storage.buckets where id = 'landing-media';
--    esperado: landing-media | true | 52428800
--
-- 6. El conteo de tablas sube de 25 a 27. Si no da 27, revisar ANTES de seguir:
--
--    select count(*) from pg_tables where schemaname = 'public';
--
-- 7. Control de que el check del FAQ muerde de verdad (tiene que FALLAR):
--
--    insert into public.landing_faq (is_published, question_i18n, answer_i18n)
--    values (true, '{"es": "   "}'::jsonb, '{"es": "algo"}'::jsonb);
--    esperado: error landing_faq_publicada_tiene_contenido.
--    Si esto entra, el check no esta puesto y una pregunta vacia puede llegar a
--    la portada.
