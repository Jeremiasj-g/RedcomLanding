-- Refuerzo opcional para evitar ambigüedad de orden en listas/tarjetas.
-- Ejecutar después de haber convertido position a double precision.
-- Primero normaliza posiciones existentes para que no falle el índice único si ya había duplicados.

with ordered_lists as (
  select
    id,
    row_number() over (
      partition by board_id
      order by position nulls last, created_at asc, id asc
    ) as rn
  from public.trello_lists
  where deleted_at is null
)
update public.trello_lists as l
set position = ordered_lists.rn * 16384
from ordered_lists
where l.id = ordered_lists.id;

with ordered_cards as (
  select
    id,
    row_number() over (
      partition by list_id
      order by position nulls last, created_at asc, id asc
    ) as rn
  from public.trello_cards
  where deleted_at is null
)
update public.trello_cards as c
set position = ordered_cards.rn * 16384
from ordered_cards
where c.id = ordered_cards.id;

create unique index if not exists trello_lists_board_position_unique_idx
  on public.trello_lists (board_id, position)
  where deleted_at is null;

create unique index if not exists trello_cards_list_position_unique_idx
  on public.trello_cards (list_id, position)
  where deleted_at is null;
