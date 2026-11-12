-- =====================================================================
-- Cahier numérique : révisions, examens simulés, premium, dessins
-- À exécuter dans Supabase > SQL Editor (ou `supabase db push`)
-- =====================================================================

-- 1) ABONNEMENT : 2 mois d'essai gratuit, puis Stripe ------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_ends_at timestamptz not null default (now() + interval '2 months'),
  status text not null default 'trial',          -- trial | active | past_due | canceled
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "sub_select_own" on public.subscriptions;
create policy "sub_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Aucune policy insert/update/delete : seules les Edge Functions (service role) écrivent.

-- Chaque nouvel utilisateur reçoit son essai de 2 mois
create or replace function public.handle_new_user_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Utilisateurs existants : essai de 2 mois à partir d'aujourd'hui
insert into public.subscriptions (user_id)
select id from auth.users on conflict do nothing;

create or replace function public.has_premium_access(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select trial_ends_at > now()
        or (status = 'active' and coalesce(current_period_end, now()) > now())
    from public.subscriptions where user_id = uid
  ), false);
$$;
revoke all on function public.has_premium_access(uuid) from public, anon;
grant execute on function public.has_premium_access(uuid) to authenticated, service_role;

-- 2) RÉVISIONS ---------------------------------------------------------
create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null,
  mode text not null check (mode in ('general','approfondie')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists revisions_nb_idx on public.revisions (notebook_id, mode, created_at desc);
alter table public.revisions enable row level security;
drop policy if exists "rev_select_own" on public.revisions;
create policy "rev_select_own" on public.revisions for select using (auth.uid() = user_id);
drop policy if exists "rev_delete_own" on public.revisions;
create policy "rev_delete_own" on public.revisions for delete using (auth.uid() = user_id);

-- 3) EXAMENS SIMULÉS ---------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null,
  title text not null,
  mode text not null check (mode in ('simulation','blanc')),
  duration_minutes int,                -- 120 pour l'examen blanc
  questions jsonb not null,            -- SANS les réponses
  created_at timestamptz not null default now()
);
create index if not exists exams_nb_idx on public.exams (notebook_id, created_at desc);
alter table public.exams enable row level security;
drop policy if exists "exam_select_own" on public.exams;
create policy "exam_select_own" on public.exams for select using (auth.uid() = user_id);
drop policy if exists "exam_delete_own" on public.exams;
create policy "exam_delete_own" on public.exams for delete using (auth.uid() = user_id);

-- Corrigé : AUCUNE policy => illisible côté client, uniquement via service role
create table if not exists public.exam_keys (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  answer_key jsonb not null
);
alter table public.exam_keys enable row level security;

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null,
  answers jsonb not null,
  score numeric(4,2) not null,         -- sur 20
  report jsonb not null,
  duration_seconds int,
  submitted_at timestamptz not null default now()
);
create index if not exists attempts_nb_idx on public.exam_attempts (notebook_id, submitted_at desc);
alter table public.exam_attempts enable row level security;
drop policy if exists "att_select_own" on public.exam_attempts;
create policy "att_select_own" on public.exam_attempts for select using (auth.uid() = user_id);

-- 4) DESSINS / SCHÉMAS (cours techniques) ------------------------------
create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null,
  page_id uuid,
  strokes jsonb not null default '[]',
  caption text,                         -- description lue par l'IA (révisions / examens)
  updated_at timestamptz not null default now()
);
create index if not exists drawings_nb_idx on public.drawings (notebook_id);
alter table public.drawings enable row level security;
drop policy if exists "draw_all_own" on public.drawings;
create policy "draw_all_own" on public.drawings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
