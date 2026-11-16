do $migration$
declare fn text;
begin
 select pg_get_functiondef('public.sigo_update_correction(date,text,text,text,text,text,text)'::regprocedure) into fn;
 if position('if actor_role=''supervisor'' and not public.sigo_seller_allowed(p_branch,p_force,v_seller_id)' in fn)=0 then
  raise exception 'Expected supervisor seller restriction not found; no change applied';
 end if;
 fn:=replace(fn,
 'if actor_role=''supervisor'' and not public.sigo_seller_allowed(p_branch,p_force,v_seller_id) then'||chr(10)||' raise exception ''No tenés permiso para corregir este vendedor'' using errcode=''42501''; end if;',
 '');
 execute fn;
end $migration$;