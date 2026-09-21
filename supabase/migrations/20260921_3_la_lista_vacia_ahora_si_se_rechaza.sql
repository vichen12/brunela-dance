-- Brunela Dance Trainer
-- 2026-09-21 (tercera del día): el check de la lista vacía nunca funcionó.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- ⚠️ VA DESPUES de `20260921_formulario_de_clases.sql` y de
--    `20260921_2_vaciar_planes_no_se_repara.sql`.
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7).
--
-- QUE ESTABA MAL
--   El constraint decia:
--
--     array_length(planes_permitidos, 1) >= 1
--
--   y `array_length('{}', 1)` en Postgres **no devuelve 0: devuelve NULL**.
--   Entonces la comparacion da NULL, y un CHECK solo rechaza cuando da FALSE:
--   con NULL **deja pasar**.
--
--   O sea que esa mitad del constraint fue un adorno desde el primer dia. La
--   otra mitad -- `not (planes @> array['none'])` -- si funciona, y por eso la
--   prueba de 'none' siempre estuvo en verde: el constraint existe y anda, solo
--   que no controlaba lo que decia controlar.
--
-- POR QUE NADIE LO VIO HASTA HOY
--   Porque el trigger lo tapaba. Antes de `20260921_2`, cualquier lista vacia
--   era "reparada" antes de que el CHECK llegara a mirarla, asi que el caso
--   nunca se ejercitaba. La migracion 2 hizo lo correcto -- dejar de reparar un
--   vaciado explicito -- y al hacerlo destapo esto:
--
--     update ... set planes_permitidos = '{}'
--       -> sin error
--       -> la fila queda guardada como {}
--
--   Una clase publicada con la lista vacia: no la ve NADIE, y no hay ningun
--   error que lo diga. Es el mismo modo de fallo de siempre, una capa mas abajo.
--
-- ⚠️ ESTO NO ES UN ERROR DE `20260921_2`. La 2 esta bien y hay que dejarla: sin
--    ella, vaciar la lista ENSANCHABA el acceso, que es peor que rechazarlo.
--    Las dos hacen falta.
--
-- LA LECCION, PARA LA PROXIMA
--   `array_length(x, 1)` es NULL con el arreglo vacio. Para contar elementos va
--   `cardinality(x)`, que devuelve 0. En un CHECK la diferencia es entre
--   rechazar y no rechazar, y no la avisa nadie.

-- ===========================================================================
-- 1. Primero, reparar lo que ya haya entrado
-- ===========================================================================
-- `alter table ... add constraint` valida las filas existentes: con una sola
-- fila en {} la migracion falla entera. Y puede haberlas, porque desde que
-- corrio la 2 el vaciado se guardaba sin quejarse.
--
-- Se reconstruye con la regla vieja -- "de este plan para arriba" -- que es la
-- misma que usa el trigger cuando no le mandan lista. No se puede adivinar cual
-- era la intencion; esto al menos deja la clase visible para alguien y
-- consistente con su `membership_tier_required`.

do $$
declare
  arregladas integer;
begin
  update public.videos v
  set planes_permitidos = (
    select coalesce(array_agg(t order by public.membership_tier_rank(t)), '{}')
    from unnest(enum_range(null::public.membership_tier)) as t
    where t <> 'none'
      and public.membership_tier_rank(t) >= public.membership_tier_rank(v.membership_tier_required)
  )
  where cardinality(v.planes_permitidos) = 0;

  get diagnostics arregladas = row_count;

  if arregladas > 0 then
    raise notice
      'Se repararon % clase(s) que tenian la lista de planes vacia. Revisar en /admin/videos que el plan que les quedo sea el que corresponde.',
      arregladas;
  end if;
end;
$$;

-- ===========================================================================
-- 2. El constraint, ahora con cardinality
-- ===========================================================================
-- Se reproduce ENTERO, incluida la mitad de 'none' que ya andaba: un
-- `add constraint` reemplaza la definicion completa, y copiar de menos borraria
-- esa comprobacion en silencio (CLAUDE.md, trampa 8, misma idea).

alter table public.videos
  drop constraint if exists videos_planes_permitidos_validos;

alter table public.videos
  add constraint videos_planes_permitidos_validos
  check (
    -- ANTES: array_length(planes_permitidos, 1) >= 1   <- NULL con {}, no rechazaba
    cardinality(planes_permitidos) >= 1
    and not (planes_permitidos @> array['none'::public.membership_tier])
  );

comment on constraint videos_planes_permitidos_validos on public.videos is
  'La lista no puede estar vacia (nadie veria la clase) ni contener none (la veria quien no paga). cardinality y NO array_length: array_length({},1) es NULL y un CHECK con NULL deja pasar.';

-- ===========================================================================
-- VERIFICACION POST-RUN
-- ===========================================================================
-- Lo unico que lo prueba de verdad:
--
--     npm run test:aislamiento     -> 126/126
--
-- A mano:
--
--   -- a) INSERT con '{}' -> ENTRA, y la lista queda derivada. NO es un error:
--   --    en un insert '{}' es el default de la columna y no se puede
--   --    distinguir de "no me mandaron nada", que es el caso que tiene que
--   --    seguir andando (tests/aislamiento/ayudantes.ts inserta asi).
--   insert into public.videos (slug, title_i18n, duration_seconds, planes_permitidos)
--   values ('tmp-verif-3', '{"es":"tmp"}', 60, '{}')
--   returning planes_permitidos;
--   -- {corps_de_ballet,solista,principal}   (derivado del tier por defecto)
--
--   -- b) UPDATE a vacio -> TIENE QUE FALLAR con 23514.
--   --    🔴 ESTA es la que antes pasaba en silencio y dejaba la fila en {}.
--   update public.videos set planes_permitidos = '{}' where slug = 'tmp-verif-3';
--
--   -- c) 'none' en la lista -> TIENE QUE FALLAR con 23514. Esta ya andaba.
--   update public.videos set planes_permitidos = array['none']::public.membership_tier[]
--     where slug = 'tmp-verif-3';
--
--   delete from public.videos where slug = 'tmp-verif-3';
--
-- ⚠️ Si (b) sigue entrando, el constraint no se reemplazo: fijate que el editor
--    no haya cortado la transaccion (trampa 7).
--
-- Y que no haya quedado ninguna vacia:
--
--   select count(*) from public.videos where cardinality(planes_permitidos) = 0;
--   -- 0
