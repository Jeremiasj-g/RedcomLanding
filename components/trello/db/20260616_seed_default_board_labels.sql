-- Opcional: ejecutar una sola vez si querés agregar etiquetas base a tableros existentes.
-- Los tableros nuevos ya reciben estas etiquetas desde el frontend/controller.

insert into public.trello_board_labels (board_id, name, color, position)
select b.id, v.name, v.color, v.position
from public.trello_boards b
cross join (
  values
    ('Prioridad baja', '#216e4e', 0),
    ('En revisión', '#7f5f01', 1),
    ('Importante', '#a54800', 2),
    ('Urgente', '#ae2e24', 3),
    ('Pendiente', '#0c66e4', 4),
    ('Bloqueado', '#5e4db2', 5)
) as v(name, color, position)
where b.deleted_at is null
  and not exists (
    select 1
    from public.trello_board_labels l
    where l.board_id = b.id
      and lower(trim(l.name)) = lower(trim(v.name))
  );
