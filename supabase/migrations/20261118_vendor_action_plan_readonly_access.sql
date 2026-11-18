-- Plan de acción visible desde Perfil: vinculación explícita al código comercial.
-- No toca datos anteriores; los planes existentes se vinculan manualmente.
begin;
alter table public.project_task_action_plans
  add column if not exists viewer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_holder_name text;
create index if not exists project_action_plan_viewer_idx
  on public.project_task_action_plans(viewer_auth_user_id)
  where viewer_auth_user_id is not null;

-- Si el supervisor cambia la categoría histórica, se debe volver a elegir
-- la cuenta; nunca se hereda automáticamente una asignación previa.
create or replace function public.reset_project_action_plan_viewer_on_seller_change()
returns trigger language plpgsql set search_path=''
as $fn$
begin
 if new.branch_key is distinct from old.branch_key
    or new.seller_id is distinct from old.seller_id then
    new.viewer_auth_user_id:=null;
    new.assigned_holder_name:=null;
 end if;
 return new;
end;
$fn$;
drop trigger if exists reset_action_plan_viewer_on_seller_change
 on public.project_task_action_plans;
create trigger reset_action_plan_viewer_on_seller_change
 before update on public.project_task_action_plans
 for each row execute function public.reset_project_action_plan_viewer_on_seller_change();

-- Opciones reales del maestro de Personal comercial, no del histórico.
create or replace function public.action_plan_vendor_candidates(p_task_id bigint)
returns table(auth_user_id uuid,person_code integer,person_name text)
language plpgsql stable security definer set search_path=''
as $fn$
declare v_branch text;
begin
 if auth.uid() is null or public.my_role() not in ('admin','jdv','supervisor')
    or not public.can_edit_project_task(p_task_id)
 then raise exception 'Sin permiso para vincular vendedores' using errcode='42501';end if;
 select ap.branch_key into v_branch
 from public.project_task_action_plans ap where ap.task_id=p_task_id;
 if v_branch is null then return;end if;
 return query
 select a.auth_user_id,a.person_code,a.person_name
 from public.commercial_vendor_accounts a
 join public.profiles p on p.id=a.auth_user_id
 where a.needs_review=false and p.is_active=true and p.role='vendedor'
   and (
     (v_branch='corrientes_masivos' and a.branch='CASA CENTRAL' and p.branch='corrientes')
     or (v_branch='corrientes_refrigerados' and a.branch='CASA CENTRAL' and p.branch='refrigerados')
     or (v_branch='chaco_masivos' and a.branch='SUCURSAL RESISTENCIA' and p.branch='chaco')
     or (v_branch='misiones_masivos' and a.branch='SUCURSAL POSADAS' and p.branch='misiones')
     or (v_branch='obera_masivos' and a.branch='SUCURSAL OBERA' and p.branch='obera')
   )
 order by a.person_code,a.person_name;
end;
$fn$;

-- La cuenta elegida debe coincidir con el código/sucursal del histórico.
-- Una asignación antigua no se reinterpreta como otra persona por rotación.
create or replace function public.assign_action_plan_vendor(
 p_task_id bigint,p_vendor_auth_user_id uuid
) returns void
language plpgsql security definer set search_path=''
as $fn$
declare v_plan public.project_task_action_plans%rowtype;
v_person record;
begin
 if auth.uid() is null or public.my_role() not in ('admin','jdv','supervisor')
    or not public.can_edit_project_task(p_task_id)
 then raise exception 'Sin permiso para editar el Plan de acción' using errcode='42501';end if;
 select * into v_plan from public.project_task_action_plans
 where task_id=p_task_id for update;
 if not found then raise exception 'Seleccioná primero el histórico del vendedor' using errcode='23514';end if;
 if p_vendor_auth_user_id is null then
   update public.project_task_action_plans
   set viewer_auth_user_id=null,assigned_holder_name=null,updated_by=auth.uid()
   where task_id=p_task_id;
   return;
 end if;
 select c.* into v_person
 from public.action_plan_vendor_candidates(p_task_id) c
 where c.auth_user_id=p_vendor_auth_user_id and c.person_code::text=
   case when trim(v_plan.seller_id) ~ '^[0-9]+$'
     then (trim(v_plan.seller_id)::integer)::text else trim(v_plan.seller_id) end
 limit 1;
 if not found then
   raise exception 'La cuenta no coincide con el código y sucursal del histórico'
   using errcode='23514';
 end if;
 update public.project_task_action_plans
 set viewer_auth_user_id=p_vendor_auth_user_id,
     assigned_holder_name=v_person.person_name,updated_by=auth.uid()
 where task_id=p_task_id;
end;
$fn$;

-- No se conceden SELECT directos de Proyectos ni acceso a la RPC de RRHH.
-- Este RPC expone únicamente el plan del titular actual autenticado.
create or replace function public.my_vendor_action_plans()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_user uuid:=auth.uid();v_result jsonb;
begin
 if v_user is null or not public.commercial_vendor_membership_active(v_user)
 then raise exception 'Acceso comercial no autorizado' using errcode='42501';end if;
 select coalesce(jsonb_agg(
   jsonb_build_object(
    'action_plan_id',a.id,'task_id',t.id,'project_name',coalesce(p.name,t.project),
    'task_title',t.title,'task_summary',t.summary,'task_description',t.description,
    'task_status',t.status,'task_priority',t.priority,'task_due_date',t.due_date,
    'project_due_date',p.due_date,'branch_key',a.branch_key,'seller_id',a.seller_id,
    'assigned_holder_name',a.assigned_holder_name,
    'checklist_items',coalesce(w.todos,'[]'::jsonb),
    'checklist_total',coalesce((select count(*) from
       jsonb_array_elements(case when jsonb_typeof(w.todos)='array' then w.todos else '[]'::jsonb end) i),0),
    'checklist_done',coalesce((select count(*) from
       jsonb_array_elements(case when jsonb_typeof(w.todos)='array' then w.todos else '[]'::jsonb end) i
       where coalesce((i->>'done')::boolean,false)),0),
    'updated_at',a.updated_at
   ) order by a.updated_at desc
 ),'[]'::jsonb) into v_result
 from public.project_task_action_plans a
 join public.project_tasks t on t.id=a.task_id
 left join public.projects p on p.id=t.project_id
 left join public.project_task_workspace w on w.task_id=t.id
 join public.commercial_vendor_accounts c on c.auth_user_id=a.viewer_auth_user_id
 join public.profiles me on me.id=c.auth_user_id
 where a.viewer_auth_user_id=v_user and c.auth_user_id=v_user
   and c.needs_review=false and me.is_active=true and me.role='vendedor'
   and a.assigned_holder_name=c.person_name
   and trim(a.seller_id) ~ '^[0-9]+$'
   and trim(a.seller_id)::integer=c.person_code
   and (
     (a.branch_key='corrientes_masivos' and c.branch='CASA CENTRAL' and me.branch='corrientes')
     or (a.branch_key='corrientes_refrigerados' and c.branch='CASA CENTRAL' and me.branch='refrigerados')
     or (a.branch_key='chaco_masivos' and c.branch='SUCURSAL RESISTENCIA' and me.branch='chaco')
     or (a.branch_key='misiones_masivos' and c.branch='SUCURSAL POSADAS' and me.branch='misiones')
     or (a.branch_key='obera_masivos' and c.branch='SUCURSAL OBERA' and me.branch='obera')
   );
 return v_result;
end;
$fn$;
revoke all on function public.action_plan_vendor_candidates(bigint) from public,anon;
revoke all on function public.assign_action_plan_vendor(bigint,uuid) from public,anon;
revoke all on function public.my_vendor_action_plans() from public,anon;
grant execute on function public.action_plan_vendor_candidates(bigint),
 public.assign_action_plan_vendor(bigint,uuid),
 public.my_vendor_action_plans() to authenticated;
commit;