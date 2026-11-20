-- El vendedor sólo puede leer su consideración mensual, nunca datos de sus compañeros.
create or replace function public.my_commercial_vendor_category_v2(p_month text default null)
returns jsonb language plpgsql stable security definer
set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_branch text; v_code integer; v_current_scope text;
 v_month text; v_min_month text:='2026-10';
 v_allowed text[];
 v_months jsonb;
 v_row jsonb; v_row_scope text;
 v_projection jsonb;
 v_daily jsonb;
 v_scales jsonb; v_gates jsonb; v_excluded jsonb; v_monthly_consideration jsonb;
begin
 if v_user is null or not public.commercial_vendor_membership_active(v_user) then
   raise exception 'Acceso comercial no autorizado' using errcode='42501';
 end if;
 select a.branch,a.person_code,p.branch
 into v_branch,v_code,v_current_scope
 from public.commercial_vendor_accounts a
 join public.profiles p on p.id=a.auth_user_id
 where a.auth_user_id=v_user and not a.needs_review
   and p.is_active and p.role='vendedor';
 if v_code is null then raise exception 'No se encontró el código comercial' using errcode='42501';end if;
 v_allowed:=case v_branch
   when 'CASA CENTRAL' then array['corrientes_masivos','corrientes_refrigerados']
   when 'SUCURSAL RESISTENCIA' then array['chaco']
   when 'SUCURSAL POSADAS' then array['misiones']
   when 'SUCURSAL OBERA' then array['obera']
   else array[]::text[] end;
 if cardinality(v_allowed)=0 then raise exception 'Sucursal no reconocida' using errcode='22023';end if;
 v_month:=coalesce(p_month,to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM'));
 if v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or v_month<v_min_month
    or v_month>to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
 then raise exception 'Mes fuera del historial de Categorías V2' using errcode='22023';end if;
 select coalesce(jsonb_agg(m.month order by m.month desc),'[]'::jsonb)
 into v_months
 from public.category_panel_monthly m
 where m.month>=v_min_month and m.month<=to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
   and exists(
     select 1 from jsonb_array_elements(m.rows) r(value)
     where r.value->>'branch_key'=any(v_allowed)
       and r.value->>'seller_id'=v_code::text
   );
 select r.value into v_row
 from public.category_panel_monthly m
 cross join lateral jsonb_array_elements(m.rows) r(value)
 where m.month=v_month and r.value->>'branch_key'=any(v_allowed)
   and r.value->>'seller_id'=v_code::text
 order by case when r.value->>'branch_key'=case v_current_scope
      when 'refrigerados' then 'corrientes_refrigerados'
      when 'corrientes' then 'corrientes_masivos'
      else v_current_scope end then 0 else 1 end
 limit 1;
 v_row_scope:=coalesce(v_row->>'branch_key',case v_current_scope
      when 'refrigerados' then 'corrientes_refrigerados'
      when 'corrientes' then 'corrientes_masivos'
      else v_current_scope end);
 select to_jsonb(pr) into v_projection
 from public.category_kpi_projections_monthly pr
 where pr.month=v_month and pr.branch_key=v_row_scope and pr.seller_id=v_code
 limit 1;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) into v_daily
 from public.category_sigo_daily d
 where d.visit_date>=to_date(v_month||'-01','YYYY-MM-DD')
   and d.visit_date<(to_date(v_month||'-01','YYYY-MM-DD')+interval '1 month')::date
   and d.seller_id=v_code and d.branch=v_branch
   and (v_row_scope<>'corrientes_refrigerados' and v_row_scope<>'corrientes_masivos'
        or d.sales_force=case v_row_scope when 'corrientes_refrigerados'
               then 'ESQUEMA REGRIGERADOS' else 'ESQUEMA 1' end);
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',m.id,'sectionName',m.section_name,'metricName',m.metric_name,
 'valueType',m.value_type,'seniorValue',m.senior_value,
 'semiSeniorValue',m.semi_senior_value,'juniorValue',m.junior_value,
 'improvementValue',m.improvement_value,'weightPercent',m.weight_percent,
 'sortOrder',m.sort_order) order by m.sort_order,m.id),'[]'::jsonb)
 into v_scales from public.category_scale_metrics m where m.is_active=true;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',g.id,'label',g.label,'valueText',g.value_text,'sortOrder',g.sort_order)
 order by g.sort_order,g.id),'[]'::jsonb)
 into v_gates from public.category_scale_gates g where g.is_active=true;
 select coalesce(jsonb_agg(d.day::text),'[]'::jsonb)
 into v_excluded from public.category_nonworking_days d
 where d.day>=to_date(v_month||'-01','YYYY-MM-DD')
   and d.day<(to_date(v_month||'-01','YYYY-MM-DD')+interval '1 month')::date;
 select to_jsonb(c) into v_monthly_consideration
 from public.category_v2_monthly_considerations c
 where c.branch_key=v_row_scope and c.month=v_month and c.seller_id=v_code;
 return jsonb_build_object(
   'branch',v_branch,'code',v_code,'scope',v_row_scope,'month',v_month,
   'months',v_months,'row',v_row,'projection',v_projection,'daily',v_daily,
   'metrics',v_scales,'gates',v_gates,'excludedDays',v_excluded,
   'monthlyConsideration',v_monthly_consideration
 );
end;
$fn$;
revoke all on function public.my_commercial_vendor_category_v2(text) from public,anon;
grant execute on function public.my_commercial_vendor_category_v2(text) to authenticated;
