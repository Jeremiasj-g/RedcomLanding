CREATE OR REPLACE FUNCTION public.can_edit_project(p_project_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.has_module_permission('projects')
    and (
      public.my_role() in ('admin', 'jdv', 'supervisor')
      or exists (
        select 1
        from public.projects p
        where p.id = p_project_id
          and (
            p.created_by = auth.uid()
            or p.owner_id = auth.uid()
          )
      )
    );
$function$
;
CREATE OR REPLACE FUNCTION public.can_edit_project_task(p_task_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.has_module_permission('projects')
    and (
      public.my_role() in ('admin', 'jdv', 'supervisor')
      or exists (
        select 1
        from public.project_tasks t
        where t.id = p_task_id
          and t.created_by = auth.uid()
      )
      or exists (
        select 1
        from public.project_task_assignees a
        where a.task_id = p_task_id
          and a.user_id = auth.uid()
      )
    )
    and exists (
      select 1
      from public.project_tasks t
      where t.id = p_task_id
        and coalesce(t.is_locked, false) = false
        and (
          t.due_date is null
          or t.due_date >= public.project_task_argentina_today()
        )
    );
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_project_task(p_task_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.has_module_permission('projects')
    and (
      public.my_role() in ('admin', 'jdv', 'supervisor')
      or exists (
        select 1
        from public.project_tasks t
        where t.id = p_task_id
          and t.created_by = auth.uid()
      )
    );
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.has_module_permission('projects')
 and (public.my_role() in ('admin', 'jdv', 'supervisor')
   or exists(select 1 from public.project_members pm
      where pm.project_id=p_project_id and pm.user_id=auth.uid()));
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_project_task(p_task_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.has_module_permission('projects')
 and (public.my_role() in ('admin', 'jdv', 'supervisor')
   or exists(select 1 from public.project_task_assignees a
      where a.task_id=p_task_id and a.user_id=auth.uid()));
$function$
;
drop policy if exists projects_insert_allowed on public.projects;
create policy projects_insert_allowed on public.projects for insert to authenticated with check(public.has_module_permission('projects') and public.my_role() in ('admin','jdv','supervisor') and created_by=auth.uid());
