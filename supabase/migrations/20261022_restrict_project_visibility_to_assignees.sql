-- Only administrators can read all projects/tasks. Other users need explicit assignment.
-- Preserve existing creation and management permissions.
create or replace function public.can_view_project(p_project_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_module_permission('projects')
 and (public.my_role()='admin'
   or exists(select 1 from public.project_members pm
      where pm.project_id=p_project_id and pm.user_id=auth.uid()));
$$;

create or replace function public.can_view_project_task(p_task_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_module_permission('projects')
 and (public.my_role()='admin'
   or exists(select 1 from public.project_task_assignees a
      where a.task_id=p_task_id and a.user_id=auth.uid()));
$$;