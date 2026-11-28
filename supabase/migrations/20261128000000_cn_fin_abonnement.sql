-- =====================================================================
-- Cahier numerique : fin d'abonnement (administration)
-- 100 % ADDITIF : cree uniquement 3 nouvelles fonctions prefixees cn_admin_.
-- Ne modifie, ne supprime et ne renomme aucune table ni fonction existante.
-- A executer UNE FOIS dans le SQL Editor du projet Supabase du Cahier.
-- =====================================================================

-- Verification : si une colonne attendue manque, rien n'est cree et le message dit laquelle.
do $$
declare m text;
begin
  select string_agg(c, ', ') into m
    from unnest(array['user_id','statut','est_admin','acces_jusqu']) c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'cn_profils' and column_name = c);
  if m is not null then
    raise exception 'Colonne(s) absente(s) de public.cn_profils : %. Rien na ete cree : envoyez ce message a Claude.', m;
  end if;
end $$;

-- Comptes dont l'abonnement est termine (liste automatique pour l'administrateur)
create or replace function public.cn_admin_abonnements_termines()
returns table (user_id uuid, email text, statut text, acces_jusqu timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cn_profils a where a.user_id = auth.uid() and a.est_admin is true) then
    raise exception 'interdit';
  end if;
  return query
    select p.user_id, u.email::text, p.statut::text, p.acces_jusqu::timestamptz
      from public.cn_profils p join auth.users u on u.id = p.user_id
     where p.est_admin is not true
       and p.acces_jusqu is not null
       and p.acces_jusqu::timestamptz <= now()
       and p.statut::text <> 'suspendu'
     order by p.acces_jusqu::timestamptz desc;
end $$;

-- Provoque la fin d'abonnement d'un compte (essai) : acces en attente, date limite depassee
create or replace function public.cn_admin_forcer_fin(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cn_profils a where a.user_id = auth.uid() and a.est_admin is true) then
    raise exception 'interdit';
  end if;
  if exists (select 1 from public.cn_profils b where b.user_id = p_user and b.est_admin is true) then
    raise exception 'compte_admin';
  end if;
  update public.cn_profils set statut = 'en_attente', acces_jusqu = now() - interval '1 minute'
   where user_id = p_user;
  if not found then raise exception 'introuvable'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Retablit l'acces d'un compte pour N jours (defaut 30)
create or replace function public.cn_admin_retablir_abo(p_user uuid, p_jours int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cn_profils a where a.user_id = auth.uid() and a.est_admin is true) then
    raise exception 'interdit';
  end if;
  update public.cn_profils
     set statut = 'valide', acces_jusqu = now() + make_interval(days => greatest(coalesce(p_jours, 30), 1))
   where user_id = p_user;
  if not found then raise exception 'introuvable'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cn_admin_abonnements_termines() from public, anon;
revoke all on function public.cn_admin_forcer_fin(uuid) from public, anon;
revoke all on function public.cn_admin_retablir_abo(uuid, int) from public, anon;
grant execute on function public.cn_admin_abonnements_termines() to authenticated;
grant execute on function public.cn_admin_forcer_fin(uuid) to authenticated;
grant execute on function public.cn_admin_retablir_abo(uuid, int) to authenticated;

notify pgrst, 'reload schema';
