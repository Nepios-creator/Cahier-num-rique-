-- Refuse toute page contenant une image/fichier intégré ou dépassant 150 000 octets. NON APPLIQUÉ.
create or replace function public.cn_pages_texte_seul() returns trigger language plpgsql as $$
declare re text := '(data:(image|application|audio|video)|<\s*(img|video|audio))';
begin
  if tg_op='INSERT' or new.html is distinct from old.html or new.cpl is distinct from old.cpl then
    if coalesce(new.html,'') ~* re or coalesce(new.cpl::text,'') ~* re
       or octet_length(coalesce(new.html,''))>150000 or octet_length(coalesce(new.cpl::text,''))>150000 then
      raise exception 'cn_texte_seul: texte uniquement, 150 000 octets maximum' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cn_pages_texte_seul on public.cn_pages;
create trigger cn_pages_texte_seul before insert or update on public.cn_pages
for each row execute function public.cn_pages_texte_seul();
