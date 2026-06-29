-- Mejora de rendimiento para el módulo Tableros.
-- 1) Permite posiciones fraccionales tipo Trello.
-- 2) Rebalancea posiciones existentes con separaciones grandes.
-- 3) Habilita Supabase Realtime para las tablas del módulo.

alter table if exists public.trello_boards alter column position type double precision using position::double precision;
alter table if exists public.trello_lists alter column position type double precision using position::double precision;
alter table if exists public.trello_cards alter column position type double precision using position::double precision;
alter table if exists public.trello_board_labels alter column position type double precision using position::double precision;
alter table if exists public.trello_checklists alter column position type double precision using position::double precision;
alter table if exists public.trello_checklist_items alter column position type double precision using position::double precision;

with ordered as (
  select id, row_number() over (partition by workspace_id order by position nulls last, created_at, id) as rn
  from public.trello_boards
  where deleted_at is null
)
update public.trello_boards b
set position = ordered.rn * 16384
from ordered
where b.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by board_id order by position nulls last, created_at, id) as rn
  from public.trello_lists
  where deleted_at is null
)
update public.trello_lists l
set position = ordered.rn * 16384
from ordered
where l.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by list_id order by position nulls last, created_at, id) as rn
  from public.trello_cards
  where deleted_at is null
)
update public.trello_cards c
set position = ordered.rn * 16384
from ordered
where c.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by board_id order by position nulls last, created_at, id) as rn
  from public.trello_board_labels
)
update public.trello_board_labels l
set position = ordered.rn * 16384
from ordered
where l.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by card_id order by position nulls last, created_at, id) as rn
  from public.trello_checklists
)
update public.trello_checklists cl
set position = ordered.rn * 16384
from ordered
where cl.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by checklist_id order by position nulls last, created_at, id) as rn
  from public.trello_checklist_items
)
update public.trello_checklist_items ci
set position = ordered.rn * 16384
from ordered
where ci.id = ordered.id;

-- Realtime. Si alguna tabla ya estaba agregada a la publicación, se ignora el error.
do $$
begin
  alter publication supabase_realtime add table public.trello_workspaces;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_workspace_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_boards;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_board_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_board_labels;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_lists;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_cards;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_card_labels;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_card_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_checklists;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_checklist_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_checklist_item_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_card_comments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_card_activity;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trello_board_messages;
exception when duplicate_object then null;
end $$;
