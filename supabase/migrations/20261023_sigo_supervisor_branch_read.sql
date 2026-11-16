-- Supervisors see the full branch table but may only edit their assigned sellers via sigo_update_correction.
drop policy if exists "Category SIGO assigned managers select" on public.category_sigo_daily;
create policy "Category SIGO assigned managers select" on public.category_sigo_daily
for select to authenticated using (public.sigo_allowed_team(branch,sales_force));
