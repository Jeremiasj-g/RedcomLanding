create or replace function public.sigo_personnel_for_team(p_branch text,p_force text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(
  select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true
   and (p.role='admin' or (p.role in ('supervisor','jdv') and public.sigo_allowed_team(p_branch,p_force)))
 ) then raise exception 'Sin permiso para consultar personal SIGO' using errcode='42501'; end if;
 select coalesce(jsonb_agg(person),'[]'::jsonb) into result
 from public.category_commercial_personnel c,
 lateral jsonb_array_elements(c.people) person
 where c.id=1 and person->>'branch'=p_branch
 and (p_force='all' or person->>'force'=p_force or person->>'role'='SUPERVISOR');
 return result;
end $$;
revoke all on function public.sigo_personnel_for_team(text,text) from public,anon;
grant execute on function public.sigo_personnel_for_team(text,text) to authenticated;
