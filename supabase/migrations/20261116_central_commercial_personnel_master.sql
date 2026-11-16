-- Fuente maestra de DetallePersonal. Aplicar antes de habilitar /admin/personal-comercial.
-- Los archivos de versiones no se sobrescriben. No se modifican snapshots históricos CCC.
begin;
create table if not exists public.commercial_personnel_versions(
 id uuid primary key default gen_random_uuid(),
 storage_path text not null unique,
 original_name text not null,
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=26214400),
 uploaded_by uuid references auth.users(id) on delete set null,
 uploaded_by_name text,
 created_at timestamptz not null default now(),
 people_count integer not null check(people_count>0 and people_count<=15000),
 people jsonb not null check(jsonb_typeof(people)='array')
);
create index if not exists commercial_personnel_versions_created_at_idx
 on public.commercial_personnel_versions(created_at desc);
create table if not exists public.commercial_personnel_monthly_versions(
 effective_month text primary key check(effective_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])
create policy "Administrators can read personnel versions"
 on public.commercial_personnel_versions for select to authenticated
 using(public.my_role()='admin');
grant select on public.commercial_personnel_versions to authenticated;

create or replace function public.publish_commercial_personnel_master(
 p_storage_path text,p_original_name text,p_size_bytes bigint,
 p_uploaded_by_name text,p_people jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists (
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 if p_storage_path !~ '^global/versions/[0-9a-f-]{36}\.xlsx$' or
    p_original_name is null or length(trim(p_original_name))=0 or
    p_size_bytes not between 1 and 26214400 or
    jsonb_typeof(p_people) is distinct from 'array' or
    jsonb_array_length(p_people) not between 1 and 15000 then
  raise exception 'Datos de DetallePersonal inválidos' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_people) person
   where (person->>'id') !~ '^[0-9]+
 then raise exception 'Primero debe guardarse el archivo de DetallePersonal' using errcode='22023';end if;
 insert into public.commercial_personnel_versions(storage_path,original_name,size_bytes,uploaded_by,uploaded_by_name,people_count,people)
 values(p_storage_path,p_original_name,p_size_bytes,v_user,p_uploaded_by_name,jsonb_array_length(p_people),p_people)
 returning id into v_id;
 insert into public.commercial_personnel_monthly_versions(effective_month,version_id)
 values(to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM'),v_id)
 on conflict(effective_month) do update set version_id=excluded.version_id;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,p_people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',p_storage_path,p_original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',p_size_bytes,v_user,p_uploaded_by_name,now(),now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
 return v_id;
end;$$;
revoke all on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) to authenticated;

create or replace function public.activate_commercial_personnel_version(p_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.commercial_personnel_versions%rowtype;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists(
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 select * into v from public.commercial_personnel_versions where id=p_version_id;
 if not found then raise exception 'Versión inexistente' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=v.storage_path)
 then raise exception 'El archivo histórico ya no existe' using errcode='22023';end if;
 insert into public.commercial_personnel_monthly_versions(effective_month,version_id)
 values(to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM'),v.id)
 on conflict(effective_month) do update set version_id=excluded.version_id;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,v.people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',v.storage_path,v.original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',v.size_bytes,
 v.uploaded_by,v.uploaded_by_name,v.created_at,now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
end;$$;
revoke all on function public.activate_commercial_personnel_version(uuid) from public,anon;
grant execute on function public.activate_commercial_personnel_version(uuid) to authenticated;
-- Una sola vía de escritura: funciones transaccionales anteriores, no writes sueltas por Data API.
drop policy if exists "Admins insert commercial personnel" on public.category_commercial_personnel;
drop policy if exists "Admins update commercial personnel" on public.category_commercial_personnel;
drop policy if exists ccc_shared_files_insert_admin on public.ccc_shared_files;
drop policy if exists ccc_shared_files_update_admin on public.ccc_shared_files;
drop policy if exists ccc_shared_files_delete_admin on public.ccc_shared_files;
commit;
),
 version_id uuid not null references public.commercial_personnel_versions(id)
);
alter table public.commercial_personnel_monthly_versions enable row level security;
create policy "Administrators can read personnel monthly assignments"
 on public.commercial_personnel_monthly_versions for select to authenticated
 using(public.my_role()='admin');
grant select on public.commercial_personnel_monthly_versions to authenticated;
alter table public.commercial_personnel_versions enable row level security;
create policy "Administrators can read personnel versions"
 on public.commercial_personnel_versions for select to authenticated
 using(public.my_role()='admin');
grant select on public.commercial_personnel_versions to authenticated;

create or replace function public.publish_commercial_personnel_master(
 p_storage_path text,p_original_name text,p_size_bytes bigint,
 p_uploaded_by_name text,p_people jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists (
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 if p_storage_path !~ '^global/versions/[0-9a-f-]{36}\.xlsx$' or
    p_original_name is null or length(trim(p_original_name))=0 or
    p_size_bytes not between 1 and 26214400 or
    jsonb_typeof(p_people) is distinct from 'array' or
    jsonb_array_length(p_people) not between 1 and 15000 then
  raise exception 'Datos de DetallePersonal inválidos' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=p_storage_path)
 then raise exception 'Primero debe guardarse el archivo de DetallePersonal' using errcode='22023';end if;
 insert into public.commercial_personnel_versions(storage_path,original_name,size_bytes,uploaded_by,uploaded_by_name,people_count,people)
 values(p_storage_path,p_original_name,p_size_bytes,v_user,p_uploaded_by_name,jsonb_array_length(p_people),p_people)
 returning id into v_id;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,p_people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',p_storage_path,p_original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',p_size_bytes,v_user,p_uploaded_by_name,now(),now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
 return v_id;
end;$$;
revoke all on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) to authenticated;

create or replace function public.activate_commercial_personnel_version(p_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.commercial_personnel_versions%rowtype;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists(
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 select * into v from public.commercial_personnel_versions where id=p_version_id;
 if not found then raise exception 'Versión inexistente' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=v.storage_path)
 then raise exception 'El archivo histórico ya no existe' using errcode='22023';end if;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,v.people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',v.storage_path,v.original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',v.size_bytes,
 v.uploaded_by,v.uploaded_by_name,v.created_at,now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
end;$$;
revoke all on function public.activate_commercial_personnel_version(uuid) from public,anon;
grant execute on function public.activate_commercial_personnel_version(uuid) to authenticated;
commit;

      or coalesce(person->>'name','')=''
      or coalesce(person->>'branch','')=''
      or person->>'role' not in ('VENDEDOR','SUPERVISOR','GERENTE')
 ) then raise exception 'Hay registros de personal inválidos' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=p_storage_path)
 then raise exception 'Primero debe guardarse el archivo de DetallePersonal' using errcode='22023';end if;
 insert into public.commercial_personnel_versions(storage_path,original_name,size_bytes,uploaded_by,uploaded_by_name,people_count,people)
 values(p_storage_path,p_original_name,p_size_bytes,v_user,p_uploaded_by_name,jsonb_array_length(p_people),p_people)
 returning id into v_id;
 insert into public.commercial_personnel_monthly_versions(effective_month,version_id)
 values(to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM'),v_id)
 on conflict(effective_month) do update set version_id=excluded.version_id;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,p_people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',p_storage_path,p_original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',p_size_bytes,v_user,p_uploaded_by_name,now(),now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
 return v_id;
end;$$;
revoke all on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) to authenticated;

create or replace function public.activate_commercial_personnel_version(p_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.commercial_personnel_versions%rowtype;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists(
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 select * into v from public.commercial_personnel_versions where id=p_version_id;
 if not found then raise exception 'Versión inexistente' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=v.storage_path)
 then raise exception 'El archivo histórico ya no existe' using errcode='22023';end if;
 insert into public.commercial_personnel_monthly_versions(effective_month,version_id)
 values(to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM'),v.id)
 on conflict(effective_month) do update set version_id=excluded.version_id;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,v.people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',v.storage_path,v.original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',v.size_bytes,
 v.uploaded_by,v.uploaded_by_name,v.created_at,now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
end;$$;
revoke all on function public.activate_commercial_personnel_version(uuid) from public,anon;
grant execute on function public.activate_commercial_personnel_version(uuid) to authenticated;
-- Una sola vía de escritura: funciones transaccionales anteriores, no writes sueltas por Data API.
drop policy if exists "Admins insert commercial personnel" on public.category_commercial_personnel;
drop policy if exists "Admins update commercial personnel" on public.category_commercial_personnel;
drop policy if exists ccc_shared_files_insert_admin on public.ccc_shared_files;
drop policy if exists ccc_shared_files_update_admin on public.ccc_shared_files;
drop policy if exists ccc_shared_files_delete_admin on public.ccc_shared_files;
commit;
),
 version_id uuid not null references public.commercial_personnel_versions(id)
);
alter table public.commercial_personnel_monthly_versions enable row level security;
create policy "Administrators can read personnel monthly assignments"
 on public.commercial_personnel_monthly_versions for select to authenticated
 using(public.my_role()='admin');
grant select on public.commercial_personnel_monthly_versions to authenticated;
alter table public.commercial_personnel_versions enable row level security;
create policy "Administrators can read personnel versions"
 on public.commercial_personnel_versions for select to authenticated
 using(public.my_role()='admin');
grant select on public.commercial_personnel_versions to authenticated;

create or replace function public.publish_commercial_personnel_master(
 p_storage_path text,p_original_name text,p_size_bytes bigint,
 p_uploaded_by_name text,p_people jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists (
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 if p_storage_path !~ '^global/versions/[0-9a-f-]{36}\.xlsx$' or
    p_original_name is null or length(trim(p_original_name))=0 or
    p_size_bytes not between 1 and 26214400 or
    jsonb_typeof(p_people) is distinct from 'array' or
    jsonb_array_length(p_people) not between 1 and 15000 then
  raise exception 'Datos de DetallePersonal inválidos' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=p_storage_path)
 then raise exception 'Primero debe guardarse el archivo de DetallePersonal' using errcode='22023';end if;
 insert into public.commercial_personnel_versions(storage_path,original_name,size_bytes,uploaded_by,uploaded_by_name,people_count,people)
 values(p_storage_path,p_original_name,p_size_bytes,v_user,p_uploaded_by_name,jsonb_array_length(p_people),p_people)
 returning id into v_id;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,p_people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',p_storage_path,p_original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',p_size_bytes,v_user,p_uploaded_by_name,now(),now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
 return v_id;
end;$$;
revoke all on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.publish_commercial_personnel_master(text,text,bigint,text,jsonb) to authenticated;

create or replace function public.activate_commercial_personnel_version(p_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.commercial_personnel_versions%rowtype;v_user uuid:=(select auth.uid());
begin
 if v_user is null or not exists(
  select 1 from public.profiles p where p.id=v_user and p.is_active=true and p.role='admin'
 ) then raise exception 'Solo administradores activos' using errcode='42501';end if;
 select * into v from public.commercial_personnel_versions where id=p_version_id;
 if not found then raise exception 'Versión inexistente' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='ccc-shared-files' and name=v.storage_path)
 then raise exception 'El archivo histórico ya no existe' using errcode='22023';end if;
 insert into public.category_commercial_personnel(id,people,updated_at,updated_by)
 values(1,v.people,now(),v_user)
 on conflict(id) do update set people=excluded.people,updated_at=now(),updated_by=v_user;
 insert into public.ccc_shared_files(file_key,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,uploaded_at,updated_at)
 values('personal_detail',v.storage_path,v.original_name,
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',v.size_bytes,
 v.uploaded_by,v.uploaded_by_name,v.created_at,now())
 on conflict(file_key) do update set storage_path=excluded.storage_path,original_name=excluded.original_name,
 mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,
 uploaded_by_name=excluded.uploaded_by_name,uploaded_at=excluded.uploaded_at,updated_at=excluded.updated_at;
end;$$;
revoke all on function public.activate_commercial_personnel_version(uuid) from public,anon;
grant execute on function public.activate_commercial_personnel_version(uuid) to authenticated;
commit;
