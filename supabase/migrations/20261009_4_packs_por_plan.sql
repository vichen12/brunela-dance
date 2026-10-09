-- Brunela Dance Trainer
-- 2026-10-09: packs restringidos a planes (opcional, por pack).
-- Target: Supabase Postgres.
--
-- Pedido de la duena: "poder crear un pack para un determinado plan, pero que
-- por defecto se pueda comprar en todos los planes".
--
-- ⚠️ COMO CORRERLA EN EL SQL EDITOR DE SUPABASE
--   Pegar el archivo tal cual. NO lleva `begin;` ni `commit;` a proposito: el
--   editor ya envuelve lo pegado en su transaccion, y un `commit;` propio la
--   corta y lo que sigue "anda" sin persistir (trampa 7).
--
-- ⚠️ ORDEN: DESPUES de 20260805_packs_de_clases.sql (crea `packs`). No
--    redefine ninguna funcion, policy ni vista: solo agrega una columna y su
--    CHECK. Se puede correr sola, en cualquier momento.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- QUE SIGNIFICA LA COLUMNA
-- ═══════════════════════════════════════════════════════════════════════════
--
--   planes_que_pueden_comprar  membership_tier[]  NULL por defecto
--
--     NULL          -> lo compra cualquiera, TAMBIEN quien no tiene plan.
--                      Es lo que eran todos los packs hasta hoy, asi que las
--                      filas existentes no cambian de comportamiento.
--     {solista,...} -> solo quien TIENE HOY uno de esos planes
--                      (profiles.membership_tier).
--
-- Decide quien PUEDE PAGAR, no quien ve las clases: una vez comprado, el acceso
-- lo sigue dando la compra (current_user_has_purchased_video), aunque despues
-- cambie de plan. Por eso esta migracion NO toca ninguna policy.
--
-- DONDE SE IMPONE: src/lib/stripe/crear-checkout.ts -> crearCheckoutDePack,
-- la unica puerta a Stripe para un pack. Si su plan no esta en la lista,
-- 403 "Este pack es solo para alumnas de ...". La tienda, la portada y el
-- registro solo muestran el candado.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE NO SE TOCA LA VISTA packs_publicos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Redefinir una vista es reescribirla ENTERA (trampa 8), y su lista de
-- columnas es justamente lo que protege a la portada. La portada lee el dato
-- aparte (slug + lista, con service_role, en el servidor) igual que ya lee que
-- packs se pueden cobrar. No es un dato sensible: es lo que la portada muestra.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- EL CHECK, Y POR QUE cardinality()
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Una lista vacia no significa nada razonable ("nadie lo puede comprar"? ese
-- pack se despublica), asi que no se deja guardar. Para contar elementos va
-- `cardinality()`: `array_length('{}', 1)` devuelve NULL, un CHECK con NULL
-- DEJA PASAR, y ese mismo error ya estuvo en este repo un mes entero
-- (20260921_3_la_lista_vacia_ahora_si_se_rechaza.sql).
--
-- Tampoco se aceptan 'none' (no es un plan que se pueda "tener" para comprar:
-- para eso esta NULL) ni elementos NULL dentro de la lista.
--
-- Ninguna de las tres condiciones puede dar NULL con una lista no nula:
-- cardinality() devuelve un entero, @> un booleano y `array_position(...) is
-- null` un booleano. Si alguna diera NULL, el CHECK no rechazaria nada.

alter table public.packs
  add column if not exists planes_que_pueden_comprar public.membership_tier[];

comment on column public.packs.planes_que_pueden_comprar is
  'NULL = lo compra cualquiera (por defecto). Lista = solo alumnas cuyo plan actual esta en la lista. Lo impone crearCheckoutDePack (src/lib/stripe/crear-checkout.ts). No da ni quita acceso a clases: eso lo da la compra.';

alter table public.packs
  drop constraint if exists packs_planes_que_pueden_comprar_validos;

alter table public.packs
  add constraint packs_planes_que_pueden_comprar_validos check (
    planes_que_pueden_comprar is null
    or (
      cardinality(planes_que_pueden_comprar) >= 1
      and not (planes_que_pueden_comprar @> array['none']::public.membership_tier[])
      and array_position(planes_que_pueden_comprar, null) is null
    )
  );

-- Sin grants nuevos: `authenticated` ya tiene SELECT sobre `packs` a nivel de
-- tabla (20260805), asi que la columna nueva se lee sola, y nadie con sesion
-- escribe packs (los edita Brunela por service_role con requireAdmin()).

-- =============================================================================
-- VERIFICACION POST-RUN (por comportamiento, no solo por metadatos)
-- =============================================================================
--
-- a) La columna existe y todas las filas siguen en NULL (= para todas).
--    Esperado: una fila por pack, todas con planes NULL.
--
-- select slug, planes_que_pueden_comprar from public.packs order by slug;
--
-- b) El CHECK rechaza lo que tiene que rechazar. Cada UPDATE de abajo tiene
--    que FALLAR con 23514 (check_violation). Se prueba dentro de un bloque que
--    deshace todo, asi no queda nada escrito:
--
-- do $$
-- declare p uuid;
-- begin
--   select id into p from public.packs limit 1;
--   if p is null then raise notice 'sin packs: crear uno de prueba para verificar'; return; end if;
--
--   begin update public.packs set planes_que_pueden_comprar = '{}' where id = p;
--         raise exception 'MAL: aceptó la lista vacía';
--   exception when check_violation then raise notice 'ok: lista vacía rechazada'; end;
--
--   begin update public.packs set planes_que_pueden_comprar = '{none}' where id = p;
--         raise exception 'MAL: aceptó none';
--   exception when check_violation then raise notice 'ok: none rechazado'; end;
--
--   begin update public.packs set planes_que_pueden_comprar = array[null]::public.membership_tier[] where id = p;
--         raise exception 'MAL: aceptó un NULL adentro';
--   exception when check_violation then raise notice 'ok: NULL adentro rechazado'; end;
--
--   -- Control positivo: lo valido SI entra (y se deshace al final).
--   update public.packs set planes_que_pueden_comprar = '{solista,principal}' where id = p;
--   raise notice 'ok: {solista,principal} aceptado';
--   raise exception 'fin de la prueba: se deshace todo a proposito';
-- end $$;
--
--    Esperado: los cuatro "ok" en los avisos y al final el error "fin de la
--    prueba" (que es el que deshace el control positivo).
