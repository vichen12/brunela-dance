-- Brunela Dance Trainer
-- 2026-08-03: bucket para los documentos del estudio.
-- Target: Supabase Postgres. Correr en el SQL Editor.
--
-- POR QUE
--   /admin/documents pedia pegar una URL a mano: "Subi el archivo a Supabase
--   Storage o cualquier CDN y pega la URL aca". Brunela no puede publicar un
--   PDF con eso -- la seccion entera era inutilizable para ella.
--
-- POR QUE EL BUCKET ES PRIVADO
--   Los documentos son contenido PAGO: se muestran segun membership_tier_required.
--   Un bucket publico da una URL que funciona para cualquiera que la tenga, y
--   una URL se comparte por WhatsApp en dos segundos. Con el bucket privado, la
--   descarga se firma en el servidor para cada alumna, despues de comprobar su
--   plan, y el enlace caduca.
--
--   Es la misma decision que en la vitrina de clases: la interfaz puede ocultar,
--   pero lo que tiene que frenar es el acceso.
--
-- LIMITE DE TAMANO
--   50 MiB, el techo por archivo del plan Free de Supabase. Un PDF de coreografia
--   o una tabla de ejercicios entra de sobra.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-documents',
  'studio-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'audio/mpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Solo las admin escriben. Las alumnas NUNCA leen del bucket directamente: la
-- descarga se firma del lado del servidor despues de comprobar el plan, igual
-- que el proxy de manifests de video.
drop policy if exists "studio_documents_admin_all" on storage.objects;
create policy "studio_documents_admin_all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'studio-documents' and public.is_admin())
  with check (bucket_id = 'studio-documents' and public.is_admin());

commit;

-- =============================================================================
-- VERIFICACION POST-RUN
-- =============================================================================
--
-- select id, public, file_size_limit from storage.buckets where id = 'studio-documents';
--   esperado: studio-documents | false | 52428800
--
-- select policyname from pg_policies
--  where schemaname = 'storage' and policyname = 'studio_documents_admin_all';
--
-- El conteo de policies de storage sube de 1 a 2.
