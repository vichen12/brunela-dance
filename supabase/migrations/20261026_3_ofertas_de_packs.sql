-- Brunela Dance Trainer
-- 2026-10-26: ofertas por tiempo limitado en los packs ("flash sales").
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   Pegar tal cual: no trae `begin;` ni `commit;` (trampa 7 de CLAUDE.md).
--
-- POR QUE EXISTE
--   Pedido de la duena: "flash sales, una oferta por tiempo limitado", en los
--   packs de clases. Brunela pone un precio de oferta y hasta cuando dura; la
--   tienda, la portada y Mi plan muestran el precio tachado y una cuenta
--   regresiva, y el cobro aplica la diferencia con un cupon de Stripe.
--
-- QUE CAMBIA
--   Dos columnas en `packs` y un CHECK. NO toca la vista packs_publicos: la
--   portada lee la oferta en una consulta aparte (igual que los packs "solo
--   para"), asi no hay que reescribir la vista entera (trampa 8).
--
--   La oferta vence sola: fuera de fecha, nadie la muestra ni la cobra. No hace
--   falta ningun cron que la apague.
--
-- SIN ESTA MIGRACION
--   Nada cambia: los packs se venden a precio normal y el panel avisa que la
--   oferta todavia no se puede cargar.

alter table public.packs
  add column if not exists oferta_precio_cents integer,
  add column if not exists oferta_hasta timestamptz;

comment on column public.packs.oferta_precio_cents is
  'Precio de oferta por tiempo limitado, en centimos. Vale hasta oferta_hasta. 20261026_3_ofertas_de_packs.sql';
comment on column public.packs.oferta_hasta is
  'Hasta cuando vale la oferta. Pasada la fecha, el pack vuelve solo a su precio.';

-- Las dos juntas o ninguna, y una oferta tiene que ser MAS BARATA que el
-- precio: un "precio de oferta" mayor o igual cobraria de mas o daria un cupon
-- negativo. Se valida aca y no solo en el panel: es plata.
alter table public.packs
  drop constraint if exists packs_oferta_valida;

alter table public.packs
  add constraint packs_oferta_valida check (
    (oferta_precio_cents is null and oferta_hasta is null)
    or (oferta_precio_cents > 0 and oferta_precio_cents < price_cents and oferta_hasta is not null)
  );

notify pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACION
--   select slug, price_cents, oferta_precio_cents, oferta_hasta from public.packs;
--   -- columnas nuevas en null para todos
-- =============================================================================
