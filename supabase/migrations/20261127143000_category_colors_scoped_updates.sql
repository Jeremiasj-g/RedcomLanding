-- Scope both color save RPCs to validated category keys; preserve RLS and atomicity.
create or replace function public.save_category_colors(p_colors jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if jsonb_typeof(p_colors) is distinct from 'object' then raise exception 'Invalid colors'; end if;
 if (select count(*) from jsonb_each_text(p_colors))<>4 or exists(select 1 from jsonb_each_text(p_colors) e where e.key not in ('SENIOR','SEMI_SENIOR','JUNIOR','PLAN_MEJORA') or e.value is null or e.value !~ '^#[0-9A-Fa-f]{6}$') then raise exception 'Invalid colors'; end if;
 update public.category_colors c set hex=upper(p_colors->>c.category_key)
 where c.category_key in ('SENIOR','SEMI_SENIOR','JUNIOR','PLAN_MEJORA') and p_colors ? c.category_key;
 get diagnostics changed=row_count;
 if changed<>4 then raise exception 'No autorizado o configuración incompleta'; end if;
 return changed;
end;
$$;
create or replace function public.save_category_color_styles(p_colors jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if jsonb_typeof(p_colors) is distinct from 'object' then raise exception 'Invalid colors'; end if;
 if (select count(*) from jsonb_each(p_colors))<>4 or exists(select 1 from jsonb_each(p_colors) e where e.key not in ('SENIOR','SEMI_SENIOR','JUNIOR','PLAN_MEJORA') or jsonb_typeof(e.value) is distinct from 'object' or coalesce(e.value->>'hex','') !~ '^#[0-9A-Fa-f]{6}$' or (e.value->>'text_hex' is not null and e.value->>'text_hex' !~ '^#[0-9A-Fa-f]{6}$')) then raise exception 'Invalid colors'; end if;
 update public.category_colors c set hex=upper(p_colors->c.category_key->>'hex'),text_hex=upper(p_colors->c.category_key->>'text_hex')
 where c.category_key in ('SENIOR','SEMI_SENIOR','JUNIOR','PLAN_MEJORA') and p_colors ? c.category_key;
 get diagnostics changed=row_count;
 if changed<>4 then raise exception 'No autorizado o configuración incompleta'; end if;
 return changed;
end; $$;
