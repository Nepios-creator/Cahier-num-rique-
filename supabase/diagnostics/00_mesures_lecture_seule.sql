-- LECTURE SEULE : rien n'est modifié.
select policyname, cmd, permissive, roles from pg_policies where schemaname='storage' and tablename='objects';
select pg_size_pretty(pg_database_size(current_database())) as taille_base;
select count(*) pages_avec_images, pg_size_pretty(sum(octet_length(html))) taille from public.cn_pages where html ~* 'data:(image|application|audio|video)';
select bucket_id, count(*) fichiers, pg_size_pretty(sum((metadata->>'size')::bigint)) taille from storage.objects group by bucket_id;
select count(*) cahiers_supprimes from public.cn_cahiers where del is true;
-- Cahiers supprimés depuis plus de 30 jours (proposition de nettoyage, SUPPRESSION NON FAITE) :
-- select count(*) from public.cn_cahiers where del is true and updated_at < (extract(epoch from now() - interval '30 days')*1000)::bigint;
