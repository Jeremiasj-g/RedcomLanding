-- Configuración dinámica de dashboards, mapas de calor y tableros embebidos.
-- Cada combinación sección/sucursal conserva una sola URL: al actualizarla,
-- la nueva dirección reemplaza definitivamente a la anterior.

begin;

create table if not exists public.analytics_embed_settings (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  scope_key text not null,
  url text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_by_name text,
  updated_at timestamptz not null default now(),
  constraint analytics_embed_settings_unique unique (section, scope_key),
  constraint analytics_embed_settings_section_check check (
    section = any (array['dashboard', 'heatmap', 'workbook']::text[])
  ),
  constraint analytics_embed_settings_scope_check check (
    scope_key = any (array[
      'corrientes_masivos',
      'corrientes_refrigerados',
      'corrientes_refrigerados_kilos',
      'chaco',
      'misiones',
      'obera',
      'gerencia'
    ]::text[])
  ),
  constraint analytics_embed_settings_url_check check (
    url = '' or url ~* '^https?://'
  )
);

create index if not exists analytics_embed_settings_section_idx
  on public.analytics_embed_settings (section, scope_key);

create or replace function public.set_analytics_embed_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analytics_embed_settings_updated_at
on public.analytics_embed_settings;

create trigger analytics_embed_settings_updated_at
before update on public.analytics_embed_settings
for each row
execute function public.set_analytics_embed_settings_updated_at();

alter table public.analytics_embed_settings enable row level security;

drop policy if exists analytics_embed_settings_select_authenticated
on public.analytics_embed_settings;
create policy analytics_embed_settings_select_authenticated
on public.analytics_embed_settings
for select
to authenticated
using (true);

drop policy if exists analytics_embed_settings_insert_admin
on public.analytics_embed_settings;
create policy analytics_embed_settings_insert_admin
on public.analytics_embed_settings
for insert
to authenticated
with check (coalesce(public.my_role()::text, '') = 'admin');

drop policy if exists analytics_embed_settings_update_admin
on public.analytics_embed_settings;
create policy analytics_embed_settings_update_admin
on public.analytics_embed_settings
for update
to authenticated
using (coalesce(public.my_role()::text, '') = 'admin')
with check (coalesce(public.my_role()::text, '') = 'admin');

drop policy if exists analytics_embed_settings_delete_admin
on public.analytics_embed_settings;
create policy analytics_embed_settings_delete_admin
on public.analytics_embed_settings
for delete
to authenticated
using (coalesce(public.my_role()::text, '') = 'admin');

grant select on public.analytics_embed_settings to authenticated;
grant insert, update, delete on public.analytics_embed_settings to authenticated;

-- Valores que estaban escritos en components/LookerEmbed.jsx y lib/data.js.
-- ON CONFLICT DO NOTHING permite volver a ejecutar la migración sin pisar
-- direcciones que luego hayan sido configuradas desde el panel.
insert into public.analytics_embed_settings (section, scope_key, url)
values
  ('dashboard', 'corrientes_masivos', 'https://datastudio.google.com/embed/reporting/2ecfc88c-9070-4498-8a28-75a1fb347c26/page/9jv2F'),
  ('dashboard', 'corrientes_refrigerados', 'https://datastudio.google.com/embed/reporting/02c9a8a8-1e04-46ab-a655-14f32933d372/page/VQ02F'),
  ('dashboard', 'corrientes_refrigerados_kilos', ''),
  ('dashboard', 'chaco', 'https://datastudio.google.com/embed/reporting/0ade1098-b0d4-464d-8921-ce34ee5aa6ca/page/35y2F'),
  ('dashboard', 'misiones', 'https://datastudio.google.com/embed/reporting/fea1c84b-03f7-40f4-bd9f-59b362e5ed1f/page/BKz2F'),
  ('dashboard', 'obera', 'https://datastudio.google.com/embed/reporting/5d398019-4654-4c01-b587-03f5137b71a2/page/Cdz2F'),
  ('dashboard', 'gerencia', 'https://datastudio.google.com/embed/reporting/448cb6d2-7c09-4ceb-8205-bb71ad87f355/page/knZ3F'),

  ('heatmap', 'corrientes_masivos', 'https://datastudio.google.com/embed/reporting/8b4b18c4-21b2-4fba-b1d1-be4dd1b28c51/page/uLA3F'),
  ('heatmap', 'corrientes_refrigerados', ''),
  ('heatmap', 'corrientes_refrigerados_kilos', ''),
  ('heatmap', 'chaco', 'https://datastudio.google.com/embed/reporting/e7c3de2e-a16b-4a6f-99dc-57a858c25549/page/5TA3F'),
  ('heatmap', 'misiones', 'https://datastudio.google.com/embed/reporting/53d95184-a8df-42fd-983a-ca944a7622dd/page/8tA3F'),
  ('heatmap', 'obera', 'https://datastudio.google.com/embed/reporting/151511b7-a341-4061-8605-2598e26d1cf3/page/75A3F'),
  ('heatmap', 'gerencia', ''),

  ('workbook', 'corrientes_masivos', 'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!sf37e86de3a974df9bc681f334cebaf36&resid=E002E7D72E5A47F0!sf37e86de3a974df9bc681f334cebaf36&ithint=file%2Cxlsx&embed=1&em=2&ActiveCell=%27volumen%27!A10&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRVGVobjd6bHpyNVRieG9Iek5NNjY4MkFWQjN5U2hTWDgzVTllNDZuNHBMZEFZP2VtPTImQWN0aXZlQ2VsbD0ndm9sdW1lbichQTEwJndkSGlkZUdyaWRsaW5lcz1UcnVlJndkSGlkZUhlYWRlcnM9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2'),
  ('workbook', 'corrientes_refrigerados', ''),
  ('workbook', 'chaco', 'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!sf11df9e8a0674c2581499b9acde5ef65&resid=E002E7D72E5A47F0!sf11df9e8a0674c2581499b9acde5ef65&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27facturacion%27!A10&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRVG8tUjN4WjZBbFRJRkptNXJONWU5bEFTN0dYZ1dqaUVzOVJSeTVPcVJuYVB3P2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSdmYWN0dXJhY2lvbichQTEwJndkSGlkZUdyaWRsaW5lcz1UcnVlJndkSGlkZUhlYWRlcnM9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2'),
  ('workbook', 'misiones', 'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!seb9aade87072492fb49eeff2cdba0130&resid=E002E7D72E5A47F0!seb9aade87072492fb49eeff2cdba0130&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27volumen%27!A11&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRVG9yWnJyY25BdlNiU2U3X0xOdWdFd0FiR3dGUUJORFc2M21JNm5qaGlNTENJP2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSd2b2x1bWVuJyFBMTEmd2RIaWRlR3JpZGxpbmVzPVRydWUmd2RIaWRlSGVhZGVycz1UcnVlJndkSW5Db25maWd1cmF0b3I9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2'),
  ('workbook', 'obera', 'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!sef5ea314d07d4bd19dcf380fc016bcaa&resid=E002E7D72E5A47F0!sef5ea314d07d4bd19dcf380fc016bcaa&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27volumen%27!A11&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRUVVvMTd2ZmREUlM1M1BPQV9BRnJ5cUFTZlZmVXVqbmhyWXQ1aE1RWjN6U1FVP2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSd2b2x1bWVuJyFBMTEmd2RIaWRlR3JpZGxpbmVzPVRydWUmd2RIaWRlSGVhZGVycz1UcnVlJndkSW5Db25maWd1cmF0b3I9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2'),
  ('workbook', 'gerencia', 'https://onedrive.live.com/edit?cid=e002e7d72e5a47f0&id=E002E7D72E5A47F0!s098998047ee141bfb5d363207336f703&resid=E002E7D72E5A47F0!s098998047ee141bfb5d363207336f703&ithint=file%2Cxlsx&embed=1&em=2&AllowTyping=True&ActiveCell=%27Volumen%27!A11&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True%2CTrue%22%3E%3C%2Fiframe%3E&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9lMDAyZTdkNzJlNWE0N2YwL0lRUUVtSWtKNFg2X1FiWFRZeUJ6TnZjREFjNkpRNGFGOFBVd2J3SVNlcXVMNEcwP2VtPTImQWxsb3dUeXBpbmc9VHJ1ZSZBY3RpdmVDZWxsPSdWb2x1bWVuJyFBMTEmd2RIaWRlR3JpZGxpbmVzPVRydWUmd2RIaWRlSGVhZGVycz1UcnVlJndkSW5Db25maWd1cmF0b3I9VHJ1ZSZ3ZEluQ29uZmlndXJhdG9yPVRydWUiPjwvaWZyYW1lPg&wdo=2')
on conflict (section, scope_key) do nothing;

-- Habilita actualizaciones en vivo para que los cambios del panel se reflejen
-- sin recargar la aplicación. El bloque es idempotente.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'analytics_embed_settings'
  ) then
    execute 'alter publication supabase_realtime add table public.analytics_embed_settings';
  end if;
end;
$$;

commit;
