-- Separate external category workbooks from the internal V1 route using existing resource role settings.
update public.branch_resources
set allowed_roles=ARRAY(select code from public.user_types where code <> 'vendedor' and (code='admin' or exists(select 1 from public.role_module_permissions rp where rp.role_key=code and rp.module_key='branch_categories' and rp.can_access)) order by code), permission_key=null
where title='Categorías' and branch_key in ('corrientes_masivos','corrientes_refrigerados','chaco','misiones','obera') and permission_key='branch_categories' and allowed_roles is null;