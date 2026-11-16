create or replace function public.sigo_seller_allowed(p_branch text,p_force text,p_seller_id integer)
returns boolean language sql stable security definer set search_path=public as $$
select exists (
 select 1 from public.profiles p
 where p.id=auth.uid() and p.is_active=true and
 ((p.role='admin') or
 (p.role='jdv' and public.sigo_allowed_team(p_branch,p_force)) or
 (p.role='supervisor' and public.sigo_allowed_team(p_branch,p_force) and exists (
  select 1 from public.category_commercial_personnel c,
  lateral jsonb_array_elements(c.people) person
  where c.id=1 and person->>'role'='VENDEDOR'
   and person->>'branch'=p_branch and person->>'force'=p_force
   and person->>'id'=p_seller_id::text
   and (
      upper(trim(person->>'superior'))=upper(trim(p.full_name))
      or (
       split_part(translate(upper(trim(person->>'superior')),'ÁÉÍÓÚÜ','AEIOUU'),' ',1)
       =split_part(translate(upper(trim(p.full_name)),'ÁÉÍÓÚÜ','AEIOUU'),' ',1)
       and (regexp_split_to_array(translate(upper(trim(person->>'superior')),'ÁÉÍÓÚÜ','AEIOUU'),' +'))[
        array_length(regexp_split_to_array(translate(upper(trim(person->>'superior')),'ÁÉÍÓÚÜ','AEIOUU'),' +'),1)]
       =(regexp_split_to_array(translate(upper(trim(p.full_name)),'ÁÉÍÓÚÜ','AEIOUU'),' +'))[
        array_length(regexp_split_to_array(translate(upper(trim(p.full_name)),'ÁÉÍÓÚÜ','AEIOUU'),' +'),1)]
      )
   )
 )))
) $$;
revoke all on function public.sigo_seller_allowed(text,text,integer) from public,anon;
grant execute on function public.sigo_seller_allowed(text,text,integer) to authenticated;