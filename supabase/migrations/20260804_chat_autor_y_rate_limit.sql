-- Brunela Dance Trainer
-- 2026-08-04: fase B del plan de escalabilidad, piezas 1 y 4.
--             Autor desnormalizado en chat_messages + limite de envio.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- ═══ PIEZA 1 · POR QUE DESNORMALIZAR EL AUTOR ═══
--
--   Hoy, por CADA mensaje que llega por realtime, el navegador vuelve a pedirle
--   la fila al servidor para poder resolver el nombre del autor:
--
--     components/chat-room.tsx
--       .on('postgres_changes', ..., async (payload) => {
--         const { data: fila } = await supabase
--           .from('chat_messages')
--           .select('*, profiles(full_name, email, is_admin)')
--           .eq('id', payload.new.id)
--
--   O sea que una sala con 50 personas y 20 mensajes por minuto genera 1000
--   consultas por minuto SOLO para pintar nombres. Es un N+1 que escala con el
--   producto de gente por mensajes, y es la parte que no se arregla pagando un
--   plan mas grande: el cuello es la cantidad de viajes, no el tamano de la base.
--
--   Con el nombre guardado en la propia fila, el payload de realtime ya trae
--   todo lo necesario y esa consulta desaparece por completo.
--
--   ES UNA COPIA A PROPOSITO, Y NO SE SINCRONIZA
--     Si una alumna cambia su nombre, sus mensajes viejos conservan el que
--     tenia al escribirlos. Eso es lo correcto para un historial de chat: es un
--     registro de lo que paso, no una vista del presente. Ademas evita
--     reescribir miles de filas por un cambio de perfil.
--
-- ═══ PIEZA 4 · POR QUE EL LIMITE VA EN LA BASE ═══
--
--   Un limite en el cliente no es un limite: la insercion se puede disparar
--   desde la consola del navegador con la misma sesion. Y una server action o
--   un insert por PostgREST son endpoints publicos.
--
--   Aca va como trigger BEFORE INSERT, que es el unico lugar por el que pasan
--   TODOS los caminos de escritura.
--
--   El limite es deliberadamente holgado: 10 mensajes en 10 segundos. No busca
--   moderar conversacion -- eso es trabajo de las admin con mute y ban -- sino
--   que un bucle no pueda llenar la tabla ni saturar el canal de realtime.

begin;

-- ---------------------------------------------------------------------------
-- 1. Las columnas
-- ---------------------------------------------------------------------------

alter table public.chat_messages
  add column if not exists author_name     text,
  add column if not exists author_is_admin boolean not null default false;

comment on column public.chat_messages.author_name is
  'Copia del nombre del autor AL MOMENTO de escribir. No se sincroniza con '
  'profiles a proposito: un historial registra lo que paso. Ver el encabezado '
  'de 20260804_chat_autor_y_rate_limit.sql.';

-- ---------------------------------------------------------------------------
-- 2. El trigger que las llena
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque tiene que leer `profiles` sin depender de las
-- policies de quien escribe. Con INVOKER funcionaria para el mensaje propio
-- (profiles_select_self_or_admin permite leer el de una misma), pero fallaria
-- en silencio dejando el nombre en null si algun dia se inserta por otro
-- camino. Un nombre vacio no da error: solo se ve feo, meses despues.

create or replace function public.fill_chat_message_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si ya vienen puestos (backfill, migracion de datos), se respetan.
  if new.author_name is not null then
    return new;
  end if;

  select coalesce(p.full_name, split_part(p.email, '@', 1)), p.is_admin
    into new.author_name, new.author_is_admin
  from public.profiles p
  where p.id = new.user_id;

  -- El perfil siempre existe (FK), pero si algo raro pasara, mejor un nombre
  -- generico que un insert que falla y le corta el chat a alguien.
  if new.author_name is null then
    new.author_name := 'Alumna';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_chat_message_author on public.chat_messages;
create trigger trg_fill_chat_message_author
  before insert on public.chat_messages
  for each row
  execute function public.fill_chat_message_author();

-- ---------------------------------------------------------------------------
-- 3. Backfill de lo que ya existe
-- ---------------------------------------------------------------------------

update public.chat_messages m
   set author_name     = coalesce(p.full_name, split_part(p.email, '@', 1), 'Alumna'),
       author_is_admin = p.is_admin
  from public.profiles p
 where p.id = m.user_id
   and m.author_name is null;

-- ---------------------------------------------------------------------------
-- 4. El limite de envio
-- ---------------------------------------------------------------------------

create or replace function public.chat_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recientes integer;
begin
  -- service_role (auth.uid() null) no se limita: es el camino de
  -- administracion y de las migraciones, y limitarlo romperia el backfill.
  if auth.uid() is null then
    return new;
  end if;

  select count(*) into recientes
  from public.chat_messages
  where user_id = new.user_id
    and created_at > now() - interval '10 seconds';

  if recientes >= 10 then
    raise exception 'Estas escribiendo muy rapido. Espera unos segundos.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_message_rate_limit on public.chat_messages;
create trigger trg_chat_message_rate_limit
  before insert on public.chat_messages
  for each row
  execute function public.chat_message_rate_limit();

-- El conteo del trigger filtra por (user_id, created_at). Sin este indice hace
-- un recorrido de toda la tabla EN CADA MENSAJE, que es exactamente el
-- problema que la fase B viene a resolver.
create index if not exists idx_chat_messages_user_created
  on public.chat_messages (user_id, created_at desc);

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- a) Ninguna fila vieja quedo sin autor. Esperado: cero.
--
-- select count(*) from public.chat_messages where author_name is null;
--
-- b) El trigger llena las nuevas. Desde la aplicacion, mandar un mensaje y:
--
-- select author_name, author_is_admin, content, created_at
--   from public.chat_messages order by created_at desc limit 3;
--
--    author_name tiene que venir lleno SIN que la aplicacion lo haya mandado.
--
-- c) El limite corta. Desde la consola del navegador, ya logueada, mandar 12
--    mensajes seguidos: los primeros 10 entran y el resto falla con
--    "Estas escribiendo muy rapido".
--
-- d) Que el indice se use y no haya recorrido completo:
--
-- explain analyze
-- select count(*) from public.chat_messages
--  where user_id = '<un uuid>' and created_at > now() - interval '10 seconds';
--
--    Esperado: Index Scan usando idx_chat_messages_user_created.
--    Si dice Seq Scan, el indice no se creo.
