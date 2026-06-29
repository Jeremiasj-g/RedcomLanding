-- Redcom Tableros - snapshots desnormalizados para caché + Socket.IO
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Mantiene las tablas relacionales trello_* como fuente de verdad, pero guarda una copia jsonb
-- del tablero completo para lecturas rápidas y recuperación del caché en memoria.

create table if not exists public.trello_board_snapshots (
  board_id uuid primary key references public.trello_boards(id) on delete cascade,
  workspace_id uuid references public.trello_workspaces(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  version double precision not null default extract(epoch from now()) * 1000,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create index if not exists trello_board_snapshots_workspace_idx
  on public.trello_board_snapshots(workspace_id);

create index if not exists trello_board_snapshots_updated_idx
  on public.trello_board_snapshots(updated_at desc);

alter table public.trello_board_snapshots enable row level security;

-- Lectura: miembros del espacio o miembros directos del tablero.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trello_board_snapshots'
      and policyname = 'trello_board_snapshots_select_members'
  ) then
    create policy trello_board_snapshots_select_members
      on public.trello_board_snapshots
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.trello_workspace_members wm
          where wm.workspace_id = trello_board_snapshots.workspace_id
            and wm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.trello_board_members bm
          where bm.board_id = trello_board_snapshots.board_id
            and bm.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Escritura directa opcional para clientes autenticados que ya sean miembros.
-- En producción lo ideal es que esto lo haga solo el servidor Socket.IO usando service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trello_board_snapshots'
      and policyname = 'trello_board_snapshots_write_members'
  ) then
    create policy trello_board_snapshots_write_members
      on public.trello_board_snapshots
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.trello_workspace_members wm
          where wm.workspace_id = trello_board_snapshots.workspace_id
            and wm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.trello_board_members bm
          where bm.board_id = trello_board_snapshots.board_id
            and bm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.trello_workspace_members wm
          where wm.workspace_id = trello_board_snapshots.workspace_id
            and wm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.trello_board_members bm
          where bm.board_id = trello_board_snapshots.board_id
            and bm.user_id = auth.uid()
        )
      );
  end if;
end $$;
