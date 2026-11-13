-- =====================================================================
-- Cahier numérique : révision, examens simulés, premium (essai 2 mois + Stripe)
-- 100 % ADDITIF : crée uniquement de nouveaux objets préfixés « cn_ ».
-- Ne modifie, ne supprime et ne renomme rien d'existant.
-- À exécuter dans le SQL Editor du projet Supabase du Cahier (pivaqcvrzwxplqtznliw).
-- =====================================================================

-- 1) ABONNEMENT ------------------------------------------------------
create table if not exists public.cn_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_ends_at timestamptz not null default (now() + interval '2 months'),
  status text not null default 'trial',        -- trial | active | past_due | canceled
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.cn_subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_subscriptions' and policyname='cn_sub_select_own') then
    create policy cn_sub_select_own on public.cn_subscriptions for select using (auth.uid() = user_id);
  end if;
end $$;
-- Aucune policy d'écriture : seules les Edge Functions (service role) modifient l'abonnement.

-- Utilisateurs EXISTANTS : essai de 2 mois à partir d'aujourd'hui
insert into public.cn_subscriptions (user_id)
select id from auth.users on conflict do nothing;

-- Nouveaux utilisateurs : essai de 2 mois dès l'inscription
create or replace function public.cn_handle_new_user_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.cn_subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='cn_on_auth_user_created_subscription') then
    create trigger cn_on_auth_user_created_subscription
      after insert on auth.users
      for each row execute function public.cn_handle_new_user_subscription();
  end if;
end $$;

create or replace function public.cn_has_premium_access(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select trial_ends_at > now()
        or (status = 'active' and coalesce(current_period_end, now()) > now())
    from public.cn_subscriptions where user_id = uid
  ), false);
$$;
revoke all on function public.cn_has_premium_access(uuid) from public, anon, authenticated;
grant execute on function public.cn_has_premium_access(uuid) to service_role;

-- État de l'abonnement de l'utilisateur connecté (crée la ligne si elle manque)
create or replace function public.cn_premium_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cn_subscriptions;
begin
  if auth.uid() is null then return jsonb_build_object('premium', false, 'status', 'anon'); end if;
  insert into public.cn_subscriptions (user_id) values (auth.uid()) on conflict do nothing;
  select * into r from public.cn_subscriptions where user_id = auth.uid();
  return jsonb_build_object('premium', public.cn_has_premium_access(auth.uid()),
    'status', r.status, 'trial_ends_at', r.trial_ends_at, 'current_period_end', r.current_period_end);
end $$;
revoke all on function public.cn_premium_status() from public, anon;
grant execute on function public.cn_premium_status() to authenticated;

-- 2) RÉVISIONS -------------------------------------------------------
create table if not exists public.cn_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id text not null,
  mode text not null check (mode in ('general','approfondie')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists cn_revisions_nb_idx on public.cn_revisions (notebook_id, mode, created_at desc);
alter table public.cn_revisions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_revisions' and policyname='cn_rev_select_own') then
    create policy cn_rev_select_own on public.cn_revisions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_revisions' and policyname='cn_rev_delete_own') then
    create policy cn_rev_delete_own on public.cn_revisions for delete using (auth.uid() = user_id);
  end if;
end $$;

-- 3) EXAMENS SIMULÉS -------------------------------------------------
create table if not exists public.cn_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id text not null,
  title text not null,
  mode text not null check (mode in ('simulation','blanc')),
  duration_minutes int,
  questions jsonb not null,                    -- SANS les réponses
  created_at timestamptz not null default now()
);
create index if not exists cn_exams_nb_idx on public.cn_exams (notebook_id, created_at desc);
alter table public.cn_exams enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_exams' and policyname='cn_exam_select_own') then
    create policy cn_exam_select_own on public.cn_exams for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_exams' and policyname='cn_exam_delete_own') then
    create policy cn_exam_delete_own on public.cn_exams for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Corrigé : RLS active et AUCUNE policy => illisible côté client (service role uniquement)
create table if not exists public.cn_exam_keys (
  exam_id uuid primary key references public.cn_exams(id) on delete cascade,
  answer_key jsonb not null
);
alter table public.cn_exam_keys enable row level security;
revoke all on public.cn_exam_keys from anon, authenticated;

create table if not exists public.cn_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.cn_exams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id text not null,
  answers jsonb not null,
  score numeric(4,2) not null,                 -- sur 20
  report jsonb not null,
  duration_seconds int,
  submitted_at timestamptz not null default now()
);
create index if not exists cn_attempts_nb_idx on public.cn_exam_attempts (notebook_id, submitted_at desc);
alter table public.cn_exam_attempts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cn_exam_attempts' and policyname='cn_att_select_own') then
    create policy cn_att_select_own on public.cn_exam_attempts for select using (auth.uid() = user_id);
  end if;
end $$;
-- Aucune policy d'écriture sur les 4 tables ci-dessus (sauf suppression de ses propres révisions/examens) :
-- les Edge Functions écrivent avec le service role.
