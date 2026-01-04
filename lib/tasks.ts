// lib/tasks.ts
import { supabase } from '@/lib/supabaseClient';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskItem = {
  id: number;
  task_id: number;
  content: string;
  is_done: boolean;
  created_at: string;
};

// obtener items de una tarea
export async function fetchTaskItems(taskId: number): Promise<TaskItem[]> {
  const { data, error } = await supabase
    .from('task_items')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// crear item
export async function createTaskItem(taskId: number, content: string) {
  const { data, error } = await supabase
    .from('task_items')
    .insert({ task_id: taskId, content })
    .select()
    .single();

  if (error) throw error;
  return data as TaskItem;
}

// toggle done
export async function toggleTaskItem(id: number, is_done: boolean) {
  const { data, error } = await supabase
    .from('task_items')
    .update({ is_done })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TaskItem;
}

// eliminar
export async function deleteTaskItem(id: number) {
  const { error } = await supabase.from('task_items').delete().eq('id', id);
  if (error) throw error;
}

export type Task = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_at: string; // ISO
  status: TaskStatus;
  notes: string | null;
  priority: TaskPriority;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithOwner = Task & {
  owner_full_name: string | null;
  owner_branches: string[] | null; // 👈 ahora es array
  owner_role: string | null;
};

/**
 * Tareas del usuario actual en un rango de fechas
 */
export async function fetchMyTasksByRange(
  from: string,
  to: string,
  userId: string,
) {
  let query = supabase
    .from('tasks')
    .select('*')
    .gte('scheduled_at', from)
    .lt('scheduled_at', to)
    .order('scheduled_at', { ascending: true });

  // 👇 importante: siempre filtrar por el usuario logueado
  query = query.eq('user_id', userId);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as Task[];
}


/**
 * Tareas de supervisores para el admin (usa la vista tasks_with_owner)
 */
export async function fetchSupervisorTasksByRange(params: {
  from: string;
  to: string;
  ownerRoles?: string[]; // roles del dueño (supervisor/jdv/admin/...)
  branch?: string; // sucursal en minúsculas
  status?: TaskStatus;
}) {
  const { from, to, branch, status, ownerRoles } = params;

  // Por compatibilidad: si no pasan roles, mantenemos el comportamiento anterior.
  const roles = Array.isArray(ownerRoles) && ownerRoles.length > 0
    ? ownerRoles
    : ['supervisor'];

  let query = supabase
    .from('tasks_with_owner')
    .select('*')
    .in('owner_role', roles)
    .gte('scheduled_at', from)
    .lt('scheduled_at', to)
    .order('scheduled_at', { ascending: true });

  if (branch && branch !== 'all') {
    // owner_branches @> ARRAY[branch]
    query = query.contains('owner_branches', [branch.toLowerCase()]);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as TaskWithOwner[];
}

/**
 * Crear tarea
 */
export async function createTask(input: {
  title: string;
  description?: string;
  scheduled_at: string; // ISO
  priority?: TaskPriority;
  category?: string;
}) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      scheduled_at: input.scheduled_at,
      priority: input.priority ?? 'medium',
      category: input.category ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Task;
}

/**
 * Actualizar estado de tarea y devolver fila actualizada
 */
export async function updateTaskStatus(id: number, status: TaskStatus) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Task;
}

/**
 * Actualizar notas de tarea y devolver fila actualizada
 */
export async function updateTaskNotes(id: number, notes: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ notes })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Task;
}

/**
 * Eliminar tarea
 */
export async function deleteTask(id: number) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
