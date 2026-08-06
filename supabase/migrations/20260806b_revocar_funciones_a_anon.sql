-- Brunela Dance Trainer
-- 2026-08-06: cerrarle a `anon` las tres funciones que todavia le contestaban.
-- Target: Supabase Postgres.
--
-- ⚠️ PEGAR SOLO EL SQL, SIN el `begin;` ni el `commit;`. Trampa 7.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE HACE FALTA UNA SEGUNDA MIGRACION PARA ESTO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La 20260806 traia:
--
--   revoke execute on function public.current_user_membership_tier() from anon;
--
-- y NO ALCANZO. La prueba adversarial lo mostro: corrida la migracion, un
-- anonimo sigue recibiendo 'none' en vez de un error.
--
-- EL MOTIVO, que es una trampa clasica de Postgres:
--   toda funcion nace con EXECUTE otorgado a **PUBLIC**. `anon` no tiene el
--   permiso a titulo propio: lo hereda de PUBLIC. Revocarselo a `anon` le quita
--   algo que no tenia, y el heredado sigue intacto.
--
--   Hay que revocar de PUBLIC. Y como PUBLIC incluye a TODOS los roles, revocar
--   ahi deja tambien sin permiso a `authenticated` y a `service_role`, asi que
--   en la misma transaccion hay que devolverselo explicitamente.
--
--   En 20260805_invitaciones_a_sesiones.sql esto quedo bien -- ahi se revoca de
--   `public` primero. En la 20260806 se escribio solo el `from anon` y por eso
--   no hizo nada.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 ESTA ES LA MIGRACION MAS PELIGROSA DEL PROYECTO. LEER ANTES DE CORRER.
-- ═══════════════════════════════════════════════════════════════════════════
--
--   `is_admin()` aparece 188 veces en las policies. `current_user_membership_tier()`
--   35 veces. `can_start_dm()` 7.
--
--   Las expresiones de una policy se evaluan CON LOS PERMISOS DEL USUARIO, no
--   con los del dueño de la tabla. Si `authenticated` se queda sin EXECUTE sobre
--   estas tres, TODAS esas policies fallan y el sistema entero deja de leer:
--   biblioteca, programas, sesiones, chat, documentos, panel. Todo.
--
--   Por eso cada `revoke ... from public` va seguido INMEDIATAMENTE de su
--   `grant ... to authenticated, service_role`, y por eso van juntos en una
--   transaccion: si algo falla en el medio, no queda nada aplicado.
--
--   ⚠️ SI SE PEGA A MEDIAS -- solo los revoke -- LA APP SE CAE ENTERA.
--      Pegar el bloque COMPLETO, de una sola vez.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUE SE GANA, HONESTAMENTE
-- ═══════════════════════════════════════════════════════════════════════════
--
--   Ninguna de las tres filtra un solo dato hoy: sin sesion, `auth.uid()` es
--   null y devuelven `false`, `'none'` y `false`. Se comprobo llamandolas.
--
--   Lo que se gana es superficie: son endpoints RPC alcanzables desde internet
--   con la clave que esta en el HTML de la landing, y no hacen falta ahi. Si
--   alguna cambia mañana -- por ejemplo, que `is_admin()` acepte un uuid -- la
--   exposicion pasaria de inofensiva a util para enumerar.
--
--   Es higiene, no una urgencia. Si algo de esto se pone raro al correrlo,
--   revertir es tan simple como volver a otorgar a public.

begin;

-- ---------------------------------------------------------------------------
-- is_admin()  —  la mas usada del esquema: 188 policies
-- ---------------------------------------------------------------------------

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- current_user_membership_tier()  —  35 policies
-- ---------------------------------------------------------------------------

revoke execute on function public.current_user_membership_tier() from public;
revoke execute on function public.current_user_membership_tier() from anon;
grant execute on function public.current_user_membership_tier() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- can_start_dm()  —  7 policies
-- ---------------------------------------------------------------------------

revoke execute on function public.can_start_dm() from public;
revoke execute on function public.can_start_dm() from anon;
grant execute on function public.can_start_dm() to authenticated, service_role;

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- ⚠️ (a) ES LA IMPORTANTE, Y ES UN CONTROL POSITIVO. Comprobar solo que `anon`
--        quedo afuera no dice nada: revocarle a TODO EL MUNDO tambien pasaria
--        esa prueba, y con el sistema caido.
--
-- a) `authenticated` y `service_role` CONSERVAN el permiso.
--    Esperado: SEIS filas -- las tres funciones por los dos roles.
--
-- select p.proname, r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(p.proacl) a
--   join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname in ('is_admin','current_user_membership_tier','can_start_dm')
--    and a.privilege_type = 'EXECUTE'
--    and r.rolname in ('authenticated','service_role')
--  order by p.proname, r.rolname;
--
-- b) `anon` y PUBLIC quedaron afuera. Esperado: CERO filas.
--    (grantee 0 = PUBLIC en pg_proc.proacl)
--
-- select p.proname, coalesce(r.rolname, 'PUBLIC') as quien
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(p.proacl) a
--   left join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname in ('is_admin','current_user_membership_tier','can_start_dm')
--    and a.privilege_type = 'EXECUTE'
--    and (a.grantee = 0 or r.rolname = 'anon');
--
-- c) LA PRUEBA DE VERDAD, y la unica que cubre el riesgo real:
--
--      npm run test:aislamiento
--
--    Tiene que dar 109/109. Si `authenticated` se quedo sin EXECUTE, no va a
--    fallar solo la prueba de anon: se van a caer DECENAS, porque ninguna alumna
--    podra leer nada. Ese estropicio es la señal de que hay que volver a
--    otorgar a public y avisar.
--
-- d) Y una mirada humana: entrar como alumna y abrir la biblioteca. Si carga,
--    las 188 policies siguen funcionando.
