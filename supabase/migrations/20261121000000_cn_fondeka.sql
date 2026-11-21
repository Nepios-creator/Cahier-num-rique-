-- =====================================================================
-- Cahier numérique : paiement premium par Fondeka (mobile money)
-- 100 % ADDITIF : crée uniquement de nouveaux objets préfixés « cn_fondeka_ ».
-- À exécuter dans le SQL Editor du projet Supabase du Cahier.
-- =====================================================================

create table if not exists public.cn_fondeka_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_reference text not null unique,          -- référence envoyée à Fondeka (cn-xxxxxxxx)
  fondeka_reference text,                        -- référence renvoyée par Fondeka
  amount numeric(12,2) not null,                 -- montant NET attendu (fixé côté serveur)
  currency text not null,
  months int not null default 1,
  status text not null default 'pending',        -- pending | completed | failed
  event_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists cn_fondeka_payments_user_idx on public.cn_fondeka_payments (user_id, created_at desc);
alter table public.cn_fondeka_payments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_fondeka_payments' and policyname='cn_fk_select_own') then
    create policy cn_fk_select_own on public.cn_fondeka_payments for select using (auth.uid() = user_id);
  end if;
end $$;
-- Aucune policy d'écriture : seules les Edge Functions (service role) écrivent.

-- Valide un paiement ET prolonge l'abonnement dans UNE transaction
-- (idempotent : un webhook reçu deux fois ne prolonge jamais deux fois).
create or replace function public.cn_fondeka_complete(p_order text, p_fondeka_ref text, p_event text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.cn_fondeka_payments; base timestamptz;
begin
  select * into p from public.cn_fondeka_payments where order_reference = p_order for update;
  if not found then return 'inconnu'; end if;
  if p.status = 'completed' then return 'deja_traite'; end if;

  update public.cn_fondeka_payments
     set status = 'completed', fondeka_reference = coalesce(fondeka_reference, p_fondeka_ref),
         event_id = p_event, completed_at = now()
   where id = p.id;

  select greatest(now(), case when status = 'active' then coalesce(current_period_end, now()) else now() end)
    into base from public.cn_subscriptions where user_id = p.user_id;
  if base is null then base := now(); end if;

  insert into public.cn_subscriptions (user_id, status, current_period_end, updated_at)
  values (p.user_id, 'active', base + make_interval(days => 30 * p.months), now())
  on conflict (user_id) do update
    set status = 'active', current_period_end = excluded.current_period_end, updated_at = now();
  return 'applique';
end $$;
revoke all on function public.cn_fondeka_complete(text, text, text) from public, anon, authenticated;
grant execute on function public.cn_fondeka_complete(text, text, text) to service_role;
