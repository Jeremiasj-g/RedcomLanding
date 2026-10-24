drop policy if exists project_tasks_insert_allowed on public.project_tasks;
create policy project_tasks_insert_allowed on public.project_tasks
for insert to authenticated
with check (
 public.has_module_permission('projects')
 and public.my_role() in ('admin','jdv','supervisor')
 and created_by = auth.uid()
);
