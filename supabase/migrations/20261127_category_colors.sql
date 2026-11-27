create table public.category_colors (
 category_key text primary key check (category_key in ('SENIOR','SEMI_SENIOR','JUNIOR','PLAN_MEJORA')),
 hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$')
);
insert into public.category_colors values ('SENIOR','#065F46'),('SEMI_SENIOR','#A7F3D0'),('JUNIOR','#FDE68A'),('PLAN_MEJORA','#FECACA');
alter table public.category_colors enable row level security;
revoke all on public.category_colors from public,anon,authenticated;
grant select on public.category_colors to authenticated;
grant update(hex) on public.category_colors to authenticated;
create policy category_colors_read on public.category_colors for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active));
create policy category_colors_admin_update on public.category_colors for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
create function public.save_category_colors(p_colors jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if jsonb_typeof(p_colors) is distinct from 'object' then raise exception 'Invalid colors'; end if;
 if (select count(*) from jsonb_each_text(p_colors))<>4 or exists(select 1 from jsonb_each_text(p_colors) e where e.key not in ('SENIOR','SEMI_SENIOR','JUNIOR','PLAN_MEJORA') or e.value is null or e.value !~ '^#[0-9A-Fa-f]{6}$') then raise exception 'Invalid colors'; end if;
 update public.category_colors c set hex=upper(p_colors->>c.category_key);
 get diagnostics changed=row_count;
 if changed<>4 then raise exception 'No autorizado o configuración incompleta'; end if;
 return changed;
end;
$$;
revoke all on function public.save_category_colors(jsonb) from public,anon,authenticated;
grant execute on function public.save_category_colors(jsonb) to authenticated;
-- Rollback: drop function public.save_category_colors(jsonb); drop table public.category_colors;
