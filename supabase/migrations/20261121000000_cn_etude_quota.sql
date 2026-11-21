-- Limite par jour : 10 révisions + 5 examens (à lancer AVANT de déployer cn-etude). NON APPLIQUÉ.
create table if not exists public.cn_etude_usage(
  user_id uuid references auth.users on delete cascade,
  jour date, kind text check (kind in ('revision','exam')),
  n int not null default 0, primary key(user_id,jour,kind));
alter table public.cn_etude_usage enable row level security;
revoke all on public.cn_etude_usage from anon, authenticated;

create or replace function public.cn_etude_consume(p_user uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_max int := case p_kind when 'revision' then 10 when 'exam' then 5 else 0 end;
        v_jour date := (now() at time zone 'Africa/Kinshasa')::date; v_n int;
begin
  if v_max=0 then return jsonb_build_object('ok',false,'used',0,'max',0); end if;
  insert into cn_etude_usage(user_id,jour,kind,n) values(p_user,v_jour,p_kind,0) on conflict do nothing;
  update cn_etude_usage set n=n+1 where user_id=p_user and jour=v_jour and kind=p_kind and n<v_max returning n into v_n;
  if v_n is null then
    select n into v_n from cn_etude_usage where user_id=p_user and jour=v_jour and kind=p_kind;
    return jsonb_build_object('ok',false,'used',v_n,'max',v_max);
  end if;
  return jsonb_build_object('ok',true,'used',v_n,'max',v_max);
end $$;
revoke all on function public.cn_etude_consume(uuid,text) from public, anon, authenticated;
grant execute on function public.cn_etude_consume(uuid,text) to service_role;

create or replace function public.cn_etude_refund(p_user uuid, p_kind text) returns void
language sql security definer set search_path=public as $$
  update cn_etude_usage set n=greatest(n-1,0)
  where user_id=p_user and kind=p_kind and jour=(now() at time zone 'Africa/Kinshasa')::date $$;
revoke all on function public.cn_etude_refund(uuid,text) from public, anon, authenticated;
grant execute on function public.cn_etude_refund(uuid,text) to service_role;

create or replace function public.cn_etude_status() returns jsonb
language sql security definer set search_path=public as $$
  select jsonb_build_object(
   'rev_used', coalesce((select n from cn_etude_usage where user_id=auth.uid() and kind='revision' and jour=(now() at time zone 'Africa/Kinshasa')::date),0), 'rev_max',10,
   'exam_used', coalesce((select n from cn_etude_usage where user_id=auth.uid() and kind='exam' and jour=(now() at time zone 'Africa/Kinshasa')::date),0), 'exam_max',5) $$;
grant execute on function public.cn_etude_status() to authenticated;
