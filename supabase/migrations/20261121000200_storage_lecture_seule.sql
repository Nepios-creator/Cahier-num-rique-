-- Plus d'envoi ni de modification de fichiers dans cn-files et cn-partages ; lecture et suppression conservées. NON APPLIQUÉ.
-- Lancer d'abord supabase/diagnostics/00_mesures_lecture_seule.sql pour voir les règles existantes.
drop policy if exists cn_texte_seul_no_insert on storage.objects;
drop policy if exists cn_texte_seul_no_update on storage.objects;
create policy cn_texte_seul_no_insert on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id not in ('cn-files','cn-partages'));
create policy cn_texte_seul_no_update on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id not in ('cn-files','cn-partages')) with check (bucket_id not in ('cn-files','cn-partages'));
