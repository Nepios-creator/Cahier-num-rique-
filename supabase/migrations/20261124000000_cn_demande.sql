-- « Demande à ton cahier » : limite de 10 réponses par jour et par cahier.
-- Table additive : ne modifie aucune table existante. Accessible uniquement par les Edge Functions (service role).
create table if not exists public.cn_demandes_jour (
  user_id     uuid not null,
  notebook_id text not null,
  jour        date not null,
  n           int  not null default 0,
  primary key (user_id, notebook_id, jour)
);
alter table public.cn_demandes_jour enable row level security;
-- Aucune policy : ni lecture ni écriture depuis le navigateur.

-- Le jour change à minuit, heure de Kinshasa.
create or replace function public.cn_demande_prendre(p_user uuid, p_nb text, p_max int)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int; v_jour date := (now() at time zone 'Africa/Kinshasa')::date;
begin
  insert into cn_demandes_jour(user_id, notebook_id, jour, n) values (p_user, p_nb, v_jour, 1)
  on conflict (user_id, notebook_id, jour)
  do update set n = cn_demandes_jour.n + 1 where cn_demandes_jour.n < p_max
  returning n into v_n;
  return coalesce(v_n, -1);          -- -1 = limite atteinte
end $$;

create or replace function public.cn_demande_rendre(p_user uuid, p_nb text)
returns void language sql security definer set search_path = public as $$
  update cn_demandes_jour set n = greatest(n - 1, 0)
  where user_id = p_user and notebook_id = p_nb and jour = (now() at time zone 'Africa/Kinshasa')::date;
$$;

create or replace function public.cn_demande_restant(p_user uuid, p_nb text, p_max int)
returns int language sql security definer set search_path = public as $$
  select greatest(p_max - coalesce((select n from cn_demandes_jour
    where user_id = p_user and notebook_id = p_nb and jour = (now() at time zone 'Africa/Kinshasa')::date), 0), 0);
$$;

revoke all on function public.cn_demande_prendre(uuid, text, int) from public, anon, authenticated;
revoke all on function public.cn_demande_rendre(uuid, text) from public, anon, authenticated;
revoke all on function public.cn_demande_restant(uuid, text, int) from public, anon, authenticated;
grant execute on function public.cn_demande_prendre(uuid, text, int) to service_role;
grant execute on function public.cn_demande_rendre(uuid, text) to service_role;
grant execute on function public.cn_demande_restant(uuid, text, int) to service_role;
