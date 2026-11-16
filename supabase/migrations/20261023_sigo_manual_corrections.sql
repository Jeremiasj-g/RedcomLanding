alter table public.category_sigo_daily
 add column if not exists corrected_start time without time zone,
 add column if not exists corrected_end time without time zone,
 add column if not exists reason text,
 add column if not exists comments text;
alter table public.category_sigo_daily drop constraint if exists category_sigo_reason_valid;
alter table public.category_sigo_daily add constraint category_sigo_reason_valid
 check (reason is null or reason in ('Vacaciones','Desvinculado','Suspendido','Médico','Duelo','Otro'));
comment on column public.category_sigo_daily.corrected_start is 'Hora de inicio corregida manualmente; hora original conservada en first_visit.';
comment on column public.category_sigo_daily.corrected_end is 'Hora de fin corregida manualmente; hora original conservada en last_visit.';
comment on column public.category_sigo_daily.reason is 'Motivo de exclusión del promedio de horarios, sin borrar el día del histórico.';
