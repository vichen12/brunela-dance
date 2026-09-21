-- Brunela Dance Trainer
-- 2026-09-21 (segunda del día): vaciar `planes_permitidos` deja de repararse.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- ⚠️ VA DESPUES DE `20260921_formulario_de_clases.sql`, que es la que crea la
--    funcion. Corrida antes, `create or replace` crearia la funcion sin el
--    trigger que la usa y despues la otra migracion la pisaria entera
--    (CLAUDE.md, trampa 8).
--
-- 🔴 NO PEGAR CON `begin;` / `commit;` PROPIOS (CLAUDE.md, trampa 7).
--
-- QUE ESTABA MAL
--   `videos_sincronizar_planes()` reconstruia la lista cada vez que la veia
--   vacia. Esa rama existe por un buen motivo: hay codigo y pruebas que insertan
--   clases pasando SOLO `membership_tier_required`, y sin ella la clase naceria
--   sin planes y no la veria nadie.
--
--   Pero en un UPDATE no sabe distinguir dos cosas distintas:
--
--     a) "no vino la lista"        -> hay que derivarla  (INSERT)
--     b) "la vaciaron a proposito" -> hay que rechazarla (UPDATE)
--
--   Y trataba (b) como (a). Medido contra la base el 2026-09-21:
--
--     clase con planes_permitidos = {solista}
--     update ... set planes_permitidos = '{}'
--       -> sin error
--       -> quedo {solista, principal}
--
--   O sea que vaciar la lista **ensancha el acceso en silencio**: una clase
--   exclusiva de Solista pasa a verla Principal. Es exactamente la familia de
--   error que este proyecto ya pago cuatro veces -- la columna existe, la
--   interfaz la respeta, y lo que decide de verdad hace otra cosa.
--
--   El check constraint `videos_planes_permitidos_validos` estaba bien escrito
--   y nunca llegaba a dispararse: el trigger corre ANTES y ya habia "arreglado"
--   la fila.
--
-- COMO SE ARREGLA
--   Una guarda de tres lineas: si es un UPDATE y la lista CAMBIO a vacia, no se
--   repara nada y se deja que el check constraint la rechace con 23514.
--
--   En un INSERT se sigue derivando, porque ahi "vacia" y "no vino" son
--   indistinguibles -- la columna tiene `default '{}'`.
--
-- SE REPRODUCE LA FUNCION ENTERA, como manda la trampa 8: `create or replace`
-- reemplaza el cuerpo completo, y copiar de menos borra comprobaciones en
-- silencio. Lo unico nuevo es el bloque marcado con "NUEVO".

create or replace function public.videos_sincronizar_planes()
returns trigger
language plpgsql
as $$
declare
  planes_vacios boolean;
  planes_cambiaron boolean;
begin
  planes_vacios := new.planes_permitidos is null
                   or array_length(new.planes_permitidos, 1) is null;

  planes_cambiaron := tg_op = 'INSERT'
                      or new.planes_permitidos is distinct from old.planes_permitidos;

  -- Vino la lista: es la fuente de verdad y el tier se deriva de ella.
  if not planes_vacios and planes_cambiaron then
    new.membership_tier_required := (
      select t
      from unnest(new.planes_permitidos) as t
      order by public.membership_tier_rank(t)
      limit 1
    );
    return new;
  end if;

  -- ── NUEVO ─────────────────────────────────────────────────────────────────
  -- Vaciar la lista en un UPDATE es una orden explicita, y una orden que no
  -- puede cumplirse: una clase que no ve nadie no existe. No se repara --
  -- repararla la dejaria mas ABIERTA de lo que estaba -- y se deja pasar para
  -- que `videos_planes_permitidos_validos` la rechace con 23514.
  --
  -- En INSERT no aplica: ahi `{}` es el default de la columna y no se puede
  -- distinguir de "no me mandaron nada", que es el caso que la rama de abajo
  -- tiene que seguir cubriendo.
  if tg_op = 'UPDATE' and planes_vacios and planes_cambiaron then
    return new;
  end if;
  -- ──────────────────────────────────────────────────────────────────────────

  -- No vino la lista (o cambio solo el tier): se reconstruye con la regla
  -- vieja, "de ese plan para arriba".
  if planes_vacios
     or (tg_op = 'UPDATE'
         and new.membership_tier_required is distinct from old.membership_tier_required) then
    new.planes_permitidos := (
      select coalesce(array_agg(t order by public.membership_tier_rank(t)), '{}')
      from unnest(enum_range(null::public.membership_tier)) as t
      where t <> 'none'
        and public.membership_tier_rank(t) >= public.membership_tier_rank(new.membership_tier_required)
    );
  end if;

  return new;
end;
$$;

-- El trigger NO se vuelve a crear: sigue apuntando a esta misma funcion, que
-- acaba de cambiar de cuerpo. Recrearlo no haria daño, pero tampoco nada.

-- ===========================================================================
-- VERIFICACION POST-RUN
-- ===========================================================================
-- Lo unico que prueba esto de verdad es el COMPORTAMIENTO:
--
--     npm run test:aislamiento
--
-- Tiene que dar 126/126. Antes de esta migracion daba 125 y la que fallaba era
-- "una lista vacia no entra".
--
-- A mano, si hace falta (las dos primeras tienen que SEGUIR andando):
--
--   -- a) insertar pasando solo el tier sigue derivando la lista
--   insert into public.videos (slug, title_i18n, duration_seconds, membership_tier_required)
--   values ('tmp-verif-2', '{"es":"tmp"}', 60, 'solista')
--   returning planes_permitidos;
--   -- {solista,principal}
--
--   -- b) mandar la lista sigue derivando el tier
--   update public.videos set planes_permitidos = array['principal']::public.membership_tier[]
--   where slug = 'tmp-verif-2' returning membership_tier_required;
--   -- principal
--
--   -- c) vaciarla ahora FALLA (antes devolvia exito y ensanchaba el acceso)
--   update public.videos set planes_permitidos = '{}' where slug = 'tmp-verif-2';
--   -- ERROR 23514: videos_planes_permitidos_validos
--
--   delete from public.videos where slug = 'tmp-verif-2';
