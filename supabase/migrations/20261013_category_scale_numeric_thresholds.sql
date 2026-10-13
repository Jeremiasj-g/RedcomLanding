alter table public.category_scale_metrics
  add column if not exists value_type text not null default 'number';

alter table public.category_scale_metrics
  drop constraint if exists category_scale_metrics_value_type_check;

alter table public.category_scale_metrics
  add constraint category_scale_metrics_value_type_check
  check (value_type in ('number','percent','currency','count'));

alter table public.category_scale_metrics
  add column if not exists senior_value numeric null,
  add column if not exists semi_senior_value numeric null,
  add column if not exists junior_value numeric null,
  add column if not exists improvement_value numeric null;

update public.category_scale_metrics
set
  value_type = case
    when lower(metric_name) like '%factur%' then 'currency'
    when lower(metric_name) like '%eficiencia%' then 'percent'
    when lower(metric_name) like '%pdv%' then 'percent'
    when lower(metric_name) like '%objetivos%' then 'count'
    else value_type
  end,
  senior_value = case
    when lower(metric_name) like '%eficiencia%' then 70
    when lower(metric_name) like '%pdv con pop%' then 85
    when lower(metric_name) like '%exhib%' then 70
    when lower(metric_name) like '%objetivos%' then 12
    else senior_value
  end,
  semi_senior_value = case
    when lower(metric_name) like '%eficiencia%' then 65
    when lower(metric_name) like '%pdv con pop%' then 80
    when lower(metric_name) like '%exhib%' then 60
    when lower(metric_name) like '%objetivos%' then 8
    else semi_senior_value
  end,
  junior_value = case
    when lower(metric_name) like '%eficiencia%' then 60
    when lower(metric_name) like '%pdv con pop%' then 75
    when lower(metric_name) like '%exhib%' then 50
    when lower(metric_name) like '%objetivos%' then 6
    else junior_value
  end,
  improvement_value = case
    when lower(metric_name) like '%eficiencia%' then 0
    when lower(metric_name) like '%pdv con pop%' then 0
    when lower(metric_name) like '%exhib%' then 0
    when lower(metric_name) like '%objetivos%' then 0
    else improvement_value
  end;
