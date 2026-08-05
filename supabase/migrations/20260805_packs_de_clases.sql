-- Brunela Dance Trainer
-- 2026-08-05: packs de clases sueltas. Pago unico, sin suscripcion, acceso
--             permanente.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   PEGAR SOLO EL SQL, SIN el `begin;` ni el `commit;` de abajo. Trampa 7.
--
-- ⚠️ VA DESPUES DE phase_a. Redefine `videos_select_allowed_by_tier`, que nace
--    ahi y se reescribe en la 20260728. Corrida antes, esas la pisan y los packs
--    dejan de dar acceso SIN NINGUN ERROR. Trampa 8.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUE CAMBIA CONCEPTUALMENTE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hasta hoy el sistema pregunta "¿que plan tiene?". A partir de aca pregunta
-- "¿que plan tiene O que compro?".
--
-- Suena grande y toca UNA sola policy: `videos_select_allowed_by_tier`. El resto
-- se acomoda solo, y no por suerte -- porque el proxy de video
-- (app/api/video/[videoId]/[...path]/route.ts) hace su busqueda con el cliente
-- DE LA ALUMNA. Ahi decide RLS. Si la policy dice que si, el reproductor dice
-- que si: cero cambios en el reproductor y cero en el detalle de clase.
--
-- Los packs NO tocan programas, sesiones en vivo, chat ni anuncios. Un pack son
-- clases sueltas.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 DOS COSAS QUE CAMBIARON RESPECTO DE LO QUE SE HABIA PROPUESTO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. EL PRICE ID VA POR MODO, NO ES UNO SOLO.
--
--    Se habia propuesto `packs.stripe_price_id UNIQUE`. Esta mal: el catalogo de
--    suscripciones ya guarda los precios como `prices: {test: ..., live: ...}`
--    (src/lib/stripe/catalog.ts) justamente porque Stripe mantiene dos mundos
--    separados. Con una sola columna, el dia que se pase a `sk_live_` los packs
--    apuntarian a price ids de prueba y el checkout fallaria.
--
--    Por eso son DOS columnas con DOS unique.
--
-- 2. LA LANDING HOY NO LEE LA BASE.
--
--    `app/page.tsx` tiene los planes hardcodeados (linea 201) y `HomePage` NO es
--    async. Mostrar packs configurables desde el panel obliga a que la landing
--    lea la base por primera vez. Eso es CODIGO, no SQL, pero conviene saberlo
--    antes de correr esto: la vista `packs_publicos` que se crea aca no tiene
--    quien la consuma hasta que ese cambio exista.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE UNA VISTA Y NO UNA LISTA DE COLUMNAS EN TYPESCRIPT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La vitrina de clases (app/dashboard/library/page.tsx) trae metadatos por
-- service_role con la lista de columnas escrita a mano y un comentario 🔴 al
-- lado que dice "nunca agregar bunny_video_id". Funciona, pero la proteccion es
-- un comentario.
--
-- La landing es PUBLICA: el radio de daño no son las alumnas logueadas, es
-- internet. `packs_publicos` no puede contener un id de video porque no lo
-- selecciona. La restriccion la impone Postgres.
--
-- Y NO se le da SELECT a `anon`: la migracion 20260801_data_api_grants lo dejo
-- en cero a proposito ("anon no es visitante confiable, es cualquiera en
-- internet"), y no hace falta tocarlo porque la landing se renderiza en el
-- servidor.

begin;

-- ---------------------------------------------------------------------------
-- 1. Los packs
-- ---------------------------------------------------------------------------

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,

  -- En centimos, como Stripe. Guardar euros en un float es como se pierden
  -- centimos: 0.1 + 0.2 no da 0.3 en coma flotante.
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'eur',

  -- 🔴 UNO POR MODO. Ver la nota 1 de arriba.
  stripe_price_id_test text unique,
  stripe_price_id_live text unique,

  is_published boolean not null default false,
  -- Publicado y "sale en la landing" son cosas distintas: un pack puede estar
  -- vivo y comprable por enlace directo sin ocupar lugar en la portada.
  show_on_landing boolean not null default false,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  cover_image_url text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint packs_name_i18n_is_object check (jsonb_typeof(name_i18n) = 'object'),
  constraint packs_description_i18n_is_object check (jsonb_typeof(description_i18n) = 'object')
);

drop trigger if exists trg_packs_updated_at on public.packs;
create trigger trg_packs_updated_at
  before update on public.packs
  for each row execute procedure public.set_current_timestamp_updated_at();

-- ---------------------------------------------------------------------------
-- 2. El error que nombra al pack en conflicto
-- ---------------------------------------------------------------------------
-- El `unique` de arriba ya impide el duplicado, pero devuelve un 23505 que dice
-- el nombre del constraint y no CUAL es el otro pack. Con dos packs y cuatro
-- columnas de price id, eso es una tarde perdida.
--
-- ⚠️ POR QUE IMPORTA TANTO: el webhook, al cobrar, pregunta "¿que pack es este
--    price id?". Si dos lo compartieran, resolveria EL PRIMERO QUE ENCUENTRA.
--    La alumna paga el Pack A y recibe el B, y no se entera nadie hasta que
--    reclame.

create or replace function public.packs_price_id_unico()
returns trigger
language plpgsql
as $$
declare
  choque record;
begin
  select p.slug, p.name_i18n ->> 'es' as nombre, p.id
    into choque
    from public.packs p
   where p.id is distinct from new.id
     and (
       (new.stripe_price_id_test is not null
         and new.stripe_price_id_test in (p.stripe_price_id_test, p.stripe_price_id_live))
       or (new.stripe_price_id_live is not null
         and new.stripe_price_id_live in (p.stripe_price_id_test, p.stripe_price_id_live))
     )
   limit 1;

  if found then
    raise exception
      'Ese price id de Stripe ya lo usa el pack "%" (%). Cada pack necesita el suyo: si dos lo comparten, al cobrar el sistema no puede saber cual se compro.',
      coalesce(choque.nombre, choque.slug), choque.slug
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_packs_price_id_unico on public.packs;
create trigger trg_packs_price_id_unico
  before insert or update on public.packs
  for each row execute procedure public.packs_price_id_unico();

-- ---------------------------------------------------------------------------
-- 3. Que clases trae cada pack
-- ---------------------------------------------------------------------------

create table if not exists public.pack_videos (
  pack_id uuid not null references public.packs (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (pack_id, video_id)
);

create index if not exists pack_videos_video_idx
  on public.pack_videos (video_id);

-- ---------------------------------------------------------------------------
-- 4. Las compras
-- ---------------------------------------------------------------------------

create table if not exists public.pack_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- ⚠️ `restrict` y NO `cascade`: alguien pago por esto. Si un pack se pudiera
  --    borrar llevandose las compras, se borraria la prueba de que cobro. Para
  --    sacarlo de circulacion se despublica, que es lo que corresponde.
  pack_id uuid not null references public.packs (id) on delete restrict,

  -- 🔴 EL UNIQUE QUE EVITA COBRAR DOS VECES. Stripe REINTENTA los webhooks ante
  --    cualquier duda: un timeout, un 500, una demora. Sin esto, un reintento
  --    inserta una segunda compra del mismo pago.
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,

  -- Se guarda lo que se cobro DE VERDAD, ya con el cupon aplicado. El precio del
  -- pack puede cambiar manana; lo que ella pago, no.
  amount_total_cents integer,
  currency text,

  purchased_at timestamptz not null default timezone('utc', now()),

  -- null = para siempre, que es la decision tomada. La columna existe por si
  -- algun dia se vende algo temporal; hoy se escribe null siempre.
  expires_at timestamptz,

  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pack_purchases_user_idx
  on public.pack_purchases (user_id);

-- ---------------------------------------------------------------------------
-- 5. La regla de acceso, en un solo lugar
-- ---------------------------------------------------------------------------
-- Mismo par que invitaciones y que current_user_membership_tier /
-- membership_tier_for_user: la version que recibe un usuario NO se expone.
--
-- Una funcion en `public` con EXECUTE para `authenticated` es un endpoint RPC
-- publico. Con la de dos argumentos expuesta, cualquiera podria preguntar "¿esta
-- Fulana comprando packs?" y perfilar quien compra que.

create or replace function public.has_purchased_video(
  target_video_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pack_purchases c
    join public.pack_videos pv on pv.pack_id = c.pack_id
    where c.user_id = target_user_id
      and pv.video_id = target_video_id
      and (c.expires_at is null or c.expires_at > timezone('utc', now()))
  );
$$;

revoke all on function public.has_purchased_video(uuid, uuid) from public;
revoke all on function public.has_purchased_video(uuid, uuid) from anon;
revoke all on function public.has_purchased_video(uuid, uuid) from authenticated;
grant execute on function public.has_purchased_video(uuid, uuid) to service_role;

create or replace function public.current_user_has_purchased_video(
  target_video_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.pack_purchases c
       join public.pack_videos pv on pv.pack_id = c.pack_id
       where c.user_id = auth.uid()
         and pv.video_id = target_video_id
         and (c.expires_at is null or c.expires_at > timezone('utc', now()))
     );
$$;

revoke all on function public.current_user_has_purchased_video(uuid) from public;
revoke all on function public.current_user_has_purchased_video(uuid) from anon;
grant execute on function public.current_user_has_purchased_video(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
-- ⚠️ NINGUNA de estas policies mira `videos`. La policy de `videos` va a llamar
--    a una funcion que lee `pack_videos` y `pack_purchases`; si estas miraran
--    `videos` se cerraria el circulo. (La funcion es SECURITY DEFINER y saltea
--    RLS, asi que hoy no habria recursion igual -- pero la regla se sostiene
--    para que siga siendo cierto si alguien la cambia a INVOKER.)

alter table public.packs enable row level security;
alter table public.pack_videos enable row level security;
alter table public.pack_purchases enable row level security;

drop policy if exists "packs_select_published" on public.packs;
create policy "packs_select_published"
  on public.packs
  for select
  to authenticated
  using ((select public.is_admin()) or is_published = true);

-- Que clases trae un pack es informacion de vitrina: se ve antes de comprar,
-- igual que se ve el temario de un curso. El id de un video no reproduce nada
-- -- el proxy sigue preguntandole a RLS.
drop policy if exists "pack_videos_select_published" on public.pack_videos;
create policy "pack_videos_select_published"
  on public.pack_videos
  for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.packs p
      where p.id = pack_id and p.is_published = true
    )
  );

drop policy if exists "pack_purchases_select_own" on public.pack_purchases;
create policy "pack_purchases_select_own"
  on public.pack_purchases
  for select
  to authenticated
  using ((select public.is_admin()) or (select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 7. Permisos
-- ---------------------------------------------------------------------------
-- ⚠️ Tabla nueva NO hereda nada: 20260804_fix_default_privileges dejo los
--    privilegios por defecto en cero. Sin esto, 42501 al primer SELECT.
--
-- SOLO SELECT en las tres. Nadie con sesion escribe packs ni compras:
--   - los packs los edita Brunela por service_role (requireAdmin + admin client)
--   - las compras las escribe el webhook, tambien por service_role
-- Un INSERT para `authenticated` en pack_purchases seria regalarse packs.

grant select on public.packs          to authenticated;
grant select on public.pack_videos    to authenticated;
grant select on public.pack_purchases to authenticated;

-- ---------------------------------------------------------------------------
-- 8. La vitrina publica
-- ---------------------------------------------------------------------------
-- 🔴 LO QUE NO ESTA ACA ES EL PUNTO DE QUE ESTO EXISTA:
--      sin `id`, sin `stripe_price_id_*`, sin nada de `pack_videos`.
--    El identificador publico es el SLUG. El precio del checkout se resuelve en
--    el servidor contra `packs`, para que el navegador nunca mande un importe.
--
-- `security_invoker = true`: la vista se evalua con los permisos de quien
-- consulta y no con los del dueño. Hoy la lee service_role, que saltea RLS
-- igual; queda asi para que el dia que alguien le de SELECT a otro rol la vista
-- no se convierta sin querer en un pase para saltear las policies de `packs`.

drop view if exists public.packs_publicos;
create view public.packs_publicos
with (security_invoker = true)
as
select
  p.slug,
  p.name_i18n,
  p.description_i18n,
  p.price_cents,
  p.currency,
  p.cover_image_url,
  p.is_featured,
  p.display_order,
  (select count(*) from public.pack_videos pv where pv.pack_id = p.id) as cantidad_clases
from public.packs p
where p.is_published = true
  and p.show_on_landing = true;

revoke all on public.packs_publicos from public;
revoke all on public.packs_publicos from anon;
revoke all on public.packs_publicos from authenticated;
grant select on public.packs_publicos to service_role;

-- ---------------------------------------------------------------------------
-- 9. El unico lugar donde cambia el acceso
-- ---------------------------------------------------------------------------
-- Se reproduce la version vigente (20260728_rls_initplan_and_chat_indexes.sql,
-- linea 66) y se le agrega SOLO el `or`.
--
-- ⚠️ `status = 'published'` queda AFUERA del or a proposito: comprar un pack da
--    acceso a clases publicadas, no a borradores. Si una clase del pack se
--    despublica, deja de verse para todas -- incluida quien la compro. Es
--    correcto: despublicar es la forma de sacar algo de circulacion.
--
-- 🔴 ESTA POLICY PROTEGE EL CATALOGO ENTERO. Un `or` mal cerrado lo abre para
--    todas. Verificar por COMPORTAMIENTO, no leyendo el SQL:
--    `npm run test:aislamiento`.

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
        public.membership_tier_rank((select public.current_user_membership_tier()))
            >= public.membership_tier_rank(membership_tier_required)
        or public.current_user_has_purchased_video(id)
      )
    )
  );

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Las tres tablas con SELECT y NADA MAS para authenticated.
--    Esperado: 3 filas, las tres SELECT. Si aparece INSERT en pack_purchases,
--    cualquiera con sesion puede regalarse un pack.
--
-- select table_name, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name in ('packs','pack_videos','pack_purchases')
--    and grantee = 'authenticated'
--  order by table_name, privilege_type;
--
-- b) La vista NO es alcanzable por anon ni authenticated.
--    Esperado: solo service_role.
--
-- select r.rolname, a.privilege_type
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   cross join lateral aclexplode(c.relacl) a
--   join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public' and c.relname = 'packs_publicos';
--
-- c) La vista NO expone nada que permita construir una URL de reproduccion.
--    Esperado: CERO filas.
--
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'packs_publicos'
--    and column_name in ('id','stripe_price_id_test','stripe_price_id_live',
--                        'video_id','bunny_video_id','stream_playback_id');
--
-- d) La funcion de dos argumentos NO es alcanzable por una alumna.
--    Esperado: CERO filas.
--
-- select r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(p.proacl) a
--   join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname = 'has_purchased_video'
--    and a.privilege_type = 'EXECUTE'
--    and r.rolname in ('anon','authenticated');
--
-- e) La policy de videos mira la compra. Esperado: una fila, en SI.
--
-- select policyname,
--        case when coalesce(qual,'') like '%has_purchased_video%'
--             then 'SI' else 'NO' end as mira_la_compra
--   from pg_policies
--  where schemaname = 'public' and policyname = 'videos_select_allowed_by_tier';
--
-- f) El mensaje del price id duplicado nombra al otro pack. Esperado: que el
--    segundo insert falle diciendo "ya lo usa el pack ...".
--
-- insert into public.packs (slug, name_i18n, price_cents, stripe_price_id_test)
-- values ('zz-prueba-a', '{"es":"Prueba A"}', 1000, 'price_zz_duplicado');
-- insert into public.packs (slug, name_i18n, price_cents, stripe_price_id_test)
-- values ('zz-prueba-b', '{"es":"Prueba B"}', 1000, 'price_zz_duplicado');
-- delete from public.packs where slug like 'zz-prueba-%';
--
-- g) LA PRUEBA DE VERDAD, que no es SQL:
--
--      npm run test:aislamiento
--
--    tests/aislamiento/packs.test.ts comprueba, con el JWT de cada alumna:
--      - sin plan y sin compra: no ve la clase ni por REST ni por el proxy
--      - sin plan y CON la compra: la ve
--      - la compra de otra no le sirve a nadie
--      - una clase que NO esta en el pack sigue cerrada
--      - una compra vencida no da acceso
--      - nadie puede escribirse una compra
