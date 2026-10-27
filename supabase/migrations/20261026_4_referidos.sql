-- Brunela Dance Trainer
-- 2026-10-26: programa de referidos.
-- Target: Supabase Postgres.
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   Pegar tal cual: no trae `begin;` ni `commit;` (trampa 7 de CLAUDE.md).
--
-- LA REGLA (decidida con la duena, 2026-10-26)
--   Cada alumna tiene un enlace propio. Quien se registra con ese enlace queda
--   como "referida" de ella. Cuando la referida PAGA POR PRIMERA VEZ (fin de la
--   prueba con cobro, o la compra de un pack), la que la invito gana UN MES
--   GRATIS: un credito en su cliente de Stripe por el valor de un mes de su
--   plan, que se descuenta solo de su proximo cobro. La referida no gana nada.
--
-- QUIEN ESCRIBE
--   Solo el servidor (service_role): el alta de la referida y el premio. Una
--   alumna NO puede anotarse como referida de nadie ni marcarse premios: si
--   pudiera, se inventaria meses gratis. Por eso `authenticated` tiene solo
--   SELECT, y solo de lo suyo.
--
-- UNA SOLA VEZ
--   referidos.referida_id es la clave: una alumna es referida de una sola. Y el
--   premio se reclama con un UPDATE condicionado a `premiado_at is null`, asi
--   que aunque Stripe reintente el webhook, se paga una vez.

create table if not exists public.referidos_codigos (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  codigo text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint referidos_codigo_valido check (codigo ~ '^[a-z0-9]{4,20}$')
);

comment on table public.referidos_codigos is
  'El codigo de invitacion de cada alumna (bruneladance.com/?ref=<codigo>). 20261026_4_referidos.sql';

create table if not exists public.referidos (
  referida_id uuid primary key references public.profiles (id) on delete cascade,
  referente_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  -- El premio: se reclama poniendo premiado_at; estado dice como termino.
  premiado_at timestamptz,
  estado text not null default 'pendiente',
  premio_cents integer,
  stripe_balance_txn text,
  detalle text,
  constraint referidos_no_a_si_misma check (referida_id <> referente_id),
  constraint referidos_estado_valido check (estado in ('pendiente', 'otorgado', 'error'))
);

comment on table public.referidos is
  'Quien invito a quien, y si ya se dio el premio (un mes gratis para la que invito). 20261026_4_referidos.sql';

create index if not exists referidos_referente_idx on public.referidos (referente_id, created_at desc);

alter table public.referidos_codigos enable row level security;
alter table public.referidos enable row level security;

drop policy if exists "referidos_codigos_select_propio_o_admin" on public.referidos_codigos;
create policy "referidos_codigos_select_propio_o_admin" on public.referidos_codigos
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "referidos_select_propios_o_admin" on public.referidos;
create policy "referidos_select_propios_o_admin" on public.referidos
  for select to authenticated
  using (referente_id = (select auth.uid()) or public.is_admin());

revoke all on public.referidos_codigos from anon, authenticated;
revoke all on public.referidos from anon, authenticated;
grant select on public.referidos_codigos to authenticated;
grant select on public.referidos to authenticated;
grant all on public.referidos_codigos to service_role;
grant all on public.referidos to service_role;

notify pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACION
--   select count(*) from public.referidos_codigos;  -- 0, sin error
--   select count(*) from public.referidos;          -- 0, sin error
-- =============================================================================
