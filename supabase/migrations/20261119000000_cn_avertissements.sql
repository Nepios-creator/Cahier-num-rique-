-- Avertissements avec délai de recours (compte à rebours) — Cahier numérique / ADG.
-- Ne modifie aucune table existante. La suspension réutilise cn_profils.statut = 'suspendu' (déjà géré par l'application).
-- Les administrateurs (est_admin) ne sont jamais suspendus par ces fonctions.

create table if not exists public.cn_avertissements (
  user_id    uuid primary key,
  adg_id     uuid unique,                       -- identifiant de l'ambassadeur dans ADG (pour l'affichage côté ADG)
  nom        text,
  debut      timestamptz not null default now(),
  echeance   timestamptz not null,
  etat       text not null default 'actif' check (etat in ('actif','recours','suspendu','confirme','leve')),
  recours    text,
  recours_le timestamptz,
  decision   text,
  decide_le  timestamptz
);
alter table public.cn_avertissements enable row level security;
drop policy if exists cn_av_lecture_perso on public.cn_avertissements;
create policy cn_av_lecture_perso on public.cn_avertissements for select using (auth.uid() = user_id);

-- Suspension automatique à l'échéance (appelée à chaque lecture : ouverture du cahier, panneau admin, ADG).
create or replace function public.cn_av_appliquer() returns void
language plpgsql security definer set search_path = public as $$
begin
  with m as (
    update public.cn_avertissements set etat = 'suspendu'
    where etat in ('actif','recours') and echeance <= now() returning user_id)
  update public.cn_profils p set statut = 'suspendu'
  from m where p.user_id = m.user_id and p.est_admin = false;
end $$;

-- Mon avertissement (le client calcule le compte à rebours avec « maintenant » du serveur).
create or replace function public.cn_av_moi()
returns table(etat text, debut timestamptz, echeance timestamptz, recours text, recours_le timestamptz, decision text, maintenant timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform public.cn_av_appliquer();
  return query select a.etat, a.debut, a.echeance, a.recours, a.recours_le, a.decision, now()
    from public.cn_avertissements a where a.user_id = auth.uid();
end $$;

-- Demande d'explication (recours), modifiable tant que l'administrateur n'a pas tranché.
create or replace function public.cn_av_recours(p_texte text) returns void
language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(p_texte,''));
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  if char_length(t) < 10 then raise exception 'texte_trop_court'; end if;
  if char_length(t) > 2000 then t := left(t, 2000); end if;
  perform public.cn_av_appliquer();
  update public.cn_avertissements
     set recours = t, recours_le = now(), etat = case when etat = 'actif' then 'recours' else etat end
   where user_id = auth.uid() and etat in ('actif','recours','suspendu');
  if not found then raise exception 'aucun_avertissement'; end if;
end $$;

-- Administration : liste.
create or replace function public.cn_av_admin_liste()
returns table(user_id uuid, email text, nom text, etat text, debut timestamptz, echeance timestamptz, recours text, recours_le timestamptz, decision text, decide_le timestamptz, maintenant timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.cn_est_admin() then raise exception 'interdit'; end if;
  perform public.cn_av_appliquer();
  return query select a.user_id, p.email, a.nom, a.etat, a.debut, a.echeance, a.recours, a.recours_le, a.decision, a.decide_le, now()
    from public.cn_avertissements a left join public.cn_profils p on p.user_id = a.user_id
    order by (a.recours_le is not null and a.decide_le is null) desc, a.echeance asc;
end $$;

-- Administration : décision sur un compte (lever / prolonger / confirmer), possible avant comme après la suspension.
create or replace function public.cn_av_admin_decider(p_user uuid, p_action text, p_jours int default 4, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.cn_est_admin() then raise exception 'interdit'; end if;
  if not exists (select 1 from public.cn_avertissements where user_id = p_user) then raise exception 'aucun_avertissement'; end if;
  if p_action = 'lever' then
    update public.cn_avertissements set etat = 'leve', decision = p_note, decide_le = now() where user_id = p_user;
    update public.cn_profils set statut = 'valide', valide_le = coalesce(valide_le, now()) where user_id = p_user and est_admin = false and statut = 'suspendu';
  elsif p_action = 'prolonger' then
    update public.cn_avertissements set etat = 'actif', echeance = now() + make_interval(days => greatest(1, least(coalesce(p_jours,4), 30))), decision = p_note, decide_le = now() where user_id = p_user;
    update public.cn_profils set statut = 'valide' where user_id = p_user and est_admin = false and statut = 'suspendu';
  elsif p_action = 'confirmer' then
    update public.cn_avertissements set etat = 'confirme', decision = p_note, decide_le = now() where user_id = p_user;
    update public.cn_profils set statut = 'suspendu' where user_id = p_user and est_admin = false;
  else
    raise exception 'action invalide';
  end if;
end $$;

-- Côté ADG (lecture seule par identifiant ADG) : compte à rebours + envoi du recours.
create or replace function public.cn_av_adg(p_adg uuid)
returns table(etat text, echeance timestamptz, recours_le timestamptz, maintenant timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.cn_av_appliquer();
  return query select a.etat, a.echeance, a.recours_le, now() from public.cn_avertissements a where a.adg_id = p_adg;
end $$;

create or replace function public.cn_av_adg_recours(p_adg uuid, p_texte text) returns void
language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(p_texte,''));
begin
  if char_length(t) < 10 then raise exception 'texte_trop_court'; end if;
  perform public.cn_av_appliquer();
  update public.cn_avertissements
     set recours = left(t, 2000), recours_le = now(), etat = case when etat = 'actif' then 'recours' else etat end
   where adg_id = p_adg and etat in ('actif','recours','suspendu');
  if not found then raise exception 'aucun_avertissement'; end if;
end $$;

revoke all on function public.cn_av_appliquer() from public, anon, authenticated;
revoke all on function public.cn_av_moi() from public, anon;
revoke all on function public.cn_av_recours(text) from public, anon;
revoke all on function public.cn_av_admin_liste() from public, anon;
revoke all on function public.cn_av_admin_decider(uuid, text, int, text) from public, anon;
revoke all on function public.cn_av_adg(uuid) from public;
revoke all on function public.cn_av_adg_recours(uuid, text) from public;
grant execute on function public.cn_av_moi() to authenticated;
grant execute on function public.cn_av_recours(text) to authenticated;
grant execute on function public.cn_av_admin_liste() to authenticated;
grant execute on function public.cn_av_admin_decider(uuid, text, int, text) to authenticated;
grant execute on function public.cn_av_adg(uuid) to anon, authenticated;
grant execute on function public.cn_av_adg_recours(uuid, text) to anon, authenticated;
