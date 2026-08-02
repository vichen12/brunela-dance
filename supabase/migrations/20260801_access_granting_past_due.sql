-- Brunela Dance Trainer
-- 2026-08-01: past_due otorga acceso (periodo de gracia).
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE EXISTE ESTA MIGRACION
--   El seed de 20260413_phase_b_subscriptions_rewards_live.sql dejo
--   access_granting_statuses en ['trialing','active']. La decision de dar
--   acceso durante past_due se tomo despues, en la fase de Stripe, y se aplico
--   A MANO sobre site_settings: nunca quedo en una migracion.
--
--   Eso significa que una base reconstruida desde el repo perdia el periodo de
--   gracia EN SILENCIO. No hay error ni log: simplemente una alumna con un
--   cobro fallido queda sin acceso el mismo dia, en vez de conservarlo durante
--   los 14 dias de reintentos de Stripe. Se detecto el 2026-08-01 preparando la
--   migracion de region, revisando que se perderia al recrear la base.
--
-- POR QUE ES SEGURO DAR ACCESO EN past_due
--   Porque va atado al ajuste de Stripe "al agotar los reintentos, CANCELAR".
--   El corte depende de que Stripe termine moviendo la suscripcion a canceled o
--   unpaid, que no otorgan acceso. Si ese ajuste se cambiara alguna vez a "no
--   hacer nada", Stripe dejaria la suscripcion en past_due para siempre y esto
--   pasaria a ser acceso gratis e indefinido. Los dos ajustes van juntos: no
--   tocar uno sin revisar el otro.
--
-- IDEMPOTENTE
--   El `and not (... ? 'past_due')` la hace inofensiva si se corre dos veces, y
--   el `||` preserva los estados que ya estuvieran cargados en vez de pisarlos.

begin;

update public.site_settings
set value = jsonb_set(
      value,
      '{access_granting_statuses}',
      (value -> 'access_granting_statuses') || '["past_due"]'::jsonb
    ),
    updated_at = timezone('utc', now())
where setting_key = 'subscriptions.access_defaults'
  and not (value -> 'access_granting_statuses' ? 'past_due');

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- Esperado: ["trialing", "active", "past_due"]
--
-- select value -> 'access_granting_statuses'
-- from public.site_settings
-- where setting_key = 'subscriptions.access_defaults';
--
-- =============================================================================
-- SI YA HAY GENTE SUSCRIPTA CUANDO SE CORRE ESTO
-- =============================================================================
--
-- El trigger solo recalcula profiles.membership_tier cuando cambia una fila de
-- subscriptions. Cambiar la lista de estados NO reevalua las filas existentes.
-- Para aplicarlo a lo que ya esta cargado hay que forzar una escritura:
--
--   update public.subscriptions set user_id = user_id;
--
-- Al 2026-08-01 hay 0 suscripciones, asi que es un no-op. Queda anotado porque
-- deja de serlo el dia del primer cobro.
