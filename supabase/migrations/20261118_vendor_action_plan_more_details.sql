-- Amplía el expediente de solo lectura con metadatos ya existentes;
-- conserva el mismo filtro de cuenta, código, sucursal y titular.
begin;
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
    'project_description',p.description,'project_status',p.status,
    'project_start_date',p.start_date,'project_due_date',p.due_date,
    'task_is_locked',coalesce(t.is_locked,false),
    'task_title',t.title,'task_summary',t.summary,'task_description',t.description,
    'task_status',t.status,'task_priority',t.priority,'task_due_date',t.due_date,
    'branch_key',a.branch_key,'seller_id',a.seller_id,
    'assigned_holder_name',a.assigned_holder_name,
    'checklist_items',coalesce(w.todos,'[]'::jsonb),
    'todo_groups',coalesce(w.todo_groups,'[]'::jsonb),
    'assignees',coalesce(assignees.names,'[]'::jsonb),
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
 left join lateral (
   select jsonb_agg(jsonb_build_object(
     'name',coalesce(nullif(trim(pr.full_name),''),'Sin nombre'),
     'role',pr.role
   ) order by pr.full_name) as names
   from public.project_task_assignees x
   join public.profiles pr on pr.id=x.user_id
   where x.task_id=t.id and pr.role in ('admin','jdv','supervisor')
 ) assignees on true
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

revoke all on function public.my_vendor_action_plans() from public,anon;
grant execute on function public.my_vendor_action_plans() to authenticated;
commit;