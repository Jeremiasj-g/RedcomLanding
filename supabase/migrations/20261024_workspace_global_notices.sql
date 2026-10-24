create table if not exists public.workspace_notices (
 id integer primary key default 1 check (id=1),
 title text not null,
 message text not null,
 is_active boolean not null default true,
 repeat_hours integer not null default 12 check (repeat_hours between 1 and 720),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint workspace_notices_title_length check(char_length(title) between 1 and 120),
 constraint workspace_notices_message_length check(char_length(message) between 1 and 2000)
);
alter table public.workspace_notices enable row level security;
drop policy if exists workspace_notices_read on public.workspace_notices;
create policy workspace_notices_read on public.workspace_notices for select to authenticated using (true);
drop policy if exists workspace_notices_admin_insert on public.workspace_notices;
create policy workspace_notices_admin_insert on public.workspace_notices for insert to authenticated with check(public.my_role()='admin');
drop policy if exists workspace_notices_admin_update on public.workspace_notices;
create policy workspace_notices_admin_update on public.workspace_notices for update to authenticated using (public.my_role()='admin') with check(public.my_role()='admin');
insert into public.workspace_notices(id,title,message,is_active,repeat_hours)
values (1,'Aviso de mantenimiento','Estamos realizando ajustes en el espacio de trabajo. Durante este período, la información del módulo Categorías podría diferir de la planilla oficial. Para consultar los datos exactos y actualizados, verificá la planilla de Categorías.',true,12)
on conflict (id) do nothing;
create or replace function public.update_workspace_notice(p_title text,p_message text,p_active boolean,p_repeat_hours integer)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.my_role()<>'admin' then raise exception 'Solo administradores pueden actualizar avisos' using errcode='42501'; end if;
 if length(trim(p_title)) not between 1 and 120 or length(trim(p_message)) not between 1 and 2000 or p_repeat_hours not between 1 and 720 then
  raise exception 'Título, texto o frecuencia inválidos' using errcode='22023';
 end if;
 update public.workspace_notices set title=trim(p_title),message=trim(p_message),is_active=p_active,
 repeat_hours=p_repeat_hours,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=1;
end $$;
revoke all on function public.update_workspace_notice(text,text,boolean,integer) from public,anon;
grant execute on function public.update_workspace_notice(text,text,boolean,integer) to authenticated;