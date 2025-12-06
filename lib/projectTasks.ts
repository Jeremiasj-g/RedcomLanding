// lib/projectTasks.ts
import { supabase } from '@/lib/supabaseClient';

export type AppRole = 'admin' | 'supervisor' | 'vendedor' | string;

export type ProjectTaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type ProjectTaskPriority = 'low' | 'medium' | 'high';

export type ProjectTaskRow = {
  id: number;
  title: string;
  description: string | null;
  summary: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  due_date: string | null; // ISO date (yyyy-mm-dd)
  project: string;
  workspace_id: number | null; // preparado para futuros workspaces
  created_by: string;
  created_at: string;
  is_locked: boolean; // <- NUEVO: indica si la tarea está bloqueada (solo lectura)
};

export type ProjectTaskAssignee = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export type ProjectTaskWithAssignees = ProjectTaskRow & {
  assignees: ProjectTaskAssignee[];
};

/* ─────────────────────────────────────────────
 * Helpers internos
 * ──────────────────────────────────────────── */

function mapTasksWithAssignees(
  tasks: ProjectTaskRow[],
  assigneeRows: { task_id: number; user_id: string }[],
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
  }[],
): ProjectTaskWithAssignees[] {
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  const assigneesByTask = new Map<number, ProjectTaskAssignee[]>();

  for (const row of assigneeRows) {
    const profile = profilesById.get(row.user_id);
    const assignee: ProjectTaskAssignee = {
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: profile?.role ?? null,
    };
    const current = assigneesByTask.get(row.task_id) ?? [];
    current.push(assignee);
    assigneesByTask.set(row.task_id, current);
  }

  return tasks.map((t) => ({
    ...t,
    assignees: assigneesByTask.get(t.id) ?? [],
  }));
}

/* ─────────────────────────────────────────────
 * Fetch de supervisores
 * ──────────────────────────────────────────── */

export type SupervisorOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export async function fetchSupervisors(): Promise<SupervisorOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('role', 'supervisor')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id as string,
    full_name: (p as any).full_name ?? null,
    email: (p as any).email ?? null,
  }));
}

/* ─────────────────────────────────────────────
 * Fetch de tareas visibles para el usuario
 * ──────────────────────────────────────────── */

/**
 * Trae tareas de proyectos visibles para el usuario actual.
 *
 * - admin: ve todas las tareas
 * - otros roles (supervisor, etc): solo tareas donde está asignado
 */
export async function fetchProjectTasksForUser(
  currentUserId: string,
  role: AppRole,
): Promise<ProjectTaskWithAssignees[]> {
  let taskRows: ProjectTaskRow[] = [];

  if (role === 'admin') {
    // Admin ve todo
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .order('project', { ascending: true })
      .order('due_date', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    taskRows = (data ?? []) as ProjectTaskRow[];
  } else {
    // Supervisor / otros: solo tareas donde está asignado
    const { data: assignees, error: assigneesError } = await supabase
      .from('project_task_assignees')
      .select('task_id')
      .eq('user_id', currentUserId);

    if (assigneesError) throw assigneesError;

    const taskIds = Array.from(
      new Set((assignees ?? []).map((a) => a.task_id as number)),
    );

    if (taskIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .in('id', taskIds)
      .order('project', { ascending: true })
      .order('due_date', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    taskRows = (data ?? []) as ProjectTaskRow[];
  }

  if (taskRows.length === 0) return [];

  const ids = taskRows.map((t) => t.id);

  // Traemos todos los asignados de esas tareas
  const { data: assigneeRows, error: assigneesError2 } = await supabase
    .from('project_task_assignees')
    .select('task_id, user_id')
    .in('task_id', ids);

  if (assigneesError2) throw assigneesError2;

  const allUserIds = Array.from(
    new Set((assigneeRows ?? []).map((a) => a.user_id as string)),
  );

  if (allUserIds.length === 0) {
    return taskRows.map((t) => ({ ...t, assignees: [] }));
  }

  // Perfiles de esos usuarios
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', allUserIds);

  if (profilesError) throw profilesError;

  return mapTasksWithAssignees(
    taskRows,
    (assigneeRows ?? []) as { task_id: number; user_id: string }[],
    (profiles ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string | null;
    }[],
  );
}

/* ─────────────────────────────────────────────
 * Crear / actualizar tareas
 * ──────────────────────────────────────────── */

export type CreateProjectTaskInput = {
  title: string;
  project: string;
  description?: string | null;
  summary?: string | null;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  due_date?: string | null; // yyyy-mm-dd
  workspace_id?: number | null; // para futuro
  assigneeIds?: string[]; // lista de user_id de supervisores / creador
};

export async function createProjectTask(
  currentUserId: string,
  input: CreateProjectTaskInput,
): Promise<ProjectTaskWithAssignees> {
  // 1) crear la tarea
  const { data: taskData, error: taskError } = await supabase
    .from('project_tasks')
    .insert({
      title: input.title.trim(),
      project: input.project.trim(),
      description: input.description ?? null,
      summary: input.summary ?? null,
      status: input.status ?? 'not_started',
      priority: input.priority ?? 'low',
      due_date: input.due_date ?? null,
      workspace_id: input.workspace_id ?? null,
      created_by: currentUserId,
      is_locked: false, // NUEVO: siempre empieza desbloqueada
    })
    .select('*')
    .single();

  if (taskError) throw taskError;

  const taskRow = taskData as ProjectTaskRow;

  // 2) crear asignaciones (si hay)
  let assigneeRows: { task_id: number; user_id: string }[] = [];

  if (input.assigneeIds && input.assigneeIds.length > 0) {
    const assigneesToInsert = input.assigneeIds.map((userId) => ({
      task_id: taskRow.id,
      user_id: userId,
    }));

    const { data: inserted, error: assigneesError } = await supabase
      .from('project_task_assignees')
      .insert(assigneesToInsert)
      .select('task_id, user_id');

    if (assigneesError) throw assigneesError;
    assigneeRows = (inserted ?? []) as { task_id: number; user_id: string }[];
  }

  if (assigneeRows.length === 0) {
    return { ...taskRow, assignees: [] };
  }

  // 3) traer perfiles de esos usuarios
  const userIds = Array.from(new Set(assigneeRows.map((a) => a.user_id)));

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const tasks = mapTasksWithAssignees(
    [taskRow],
    assigneeRows,
    (profiles ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string | null;
    }[],
  );

  return tasks[0];
}

export type UpdateProjectTaskInput = Partial<{
  title: string;
  project: string;
  description: string | null;
  summary: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  due_date: string | null;
  workspace_id: number | null;
  is_locked: boolean; // <- NUEVO: permitir bloquear/desbloquear
}>;

/**
 * Actualiza campos básicos de la tarea (no asignados).
 */
export async function updateProjectTask(
  id: number,
  changes: UpdateProjectTaskInput,
): Promise<ProjectTaskRow> {
  const payload: any = { ...changes };

  if (payload.title) payload.title = payload.title.trim();
  if (payload.project) payload.project = payload.project.trim();

  const { data, error } = await supabase
    .from('project_tasks')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  return data as ProjectTaskRow;
}

/**
 * Reemplaza completamente los responsables de una tarea.
 * (borra los actuales y crea los nuevos)
 */
export async function setTaskAssignees(
  taskId: number,
  assigneeIds: string[],
): Promise<void> {
  // 1) borrar todos los actuales
  const { error: deleteError } = await supabase
    .from('project_task_assignees')
    .delete()
    .eq('task_id', taskId);

  if (deleteError) throw deleteError;

  if (assigneeIds.length === 0) return;

  // 2) insertar los nuevos
  const rows = assigneeIds.map((userId) => ({
    task_id: taskId,
    user_id: userId,
  }));

  const { error: insertError } = await supabase
    .from('project_task_assignees')
    .insert(rows);

  if (insertError) throw insertError;
}

/* ─────────────────────────────────────────────
 * Eliminar tarea
 * ──────────────────────────────────────────── */

export async function deleteProjectTask(id: number): Promise<void> {
  // Primero limpiamos asignados (por si no tenés ON DELETE CASCADE)
  const { error: assigneesError } = await supabase
    .from('project_task_assignees')
    .delete()
    .eq('task_id', id);

  if (assigneesError) throw assigneesError;

  const { error: taskError } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', id);

  if (taskError) throw taskError;
}

/* ─────────────────────────────────────────────
 * Helper para traer una sola tarea
 * ──────────────────────────────────────────── */

export async function fetchProjectTaskById(
  id: number,
): Promise<ProjectTaskWithAssignees | null> {
  const { data: taskData, error: taskError } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (taskError) {
    // PGRST116 = not found
    if ((taskError as any).code === 'PGRST116') return null;
    throw taskError;
  }

  const taskRow = taskData as ProjectTaskRow;

  const { data: assigneeRows, error: assigneesError } = await supabase
    .from('project_task_assignees')
    .select('task_id, user_id')
    .eq('task_id', id);

  if (assigneesError) throw assigneesError;

  if (!assigneeRows || assigneeRows.length === 0) {
    return { ...taskRow, assignees: [] };
  }

  const userIds = Array.from(
    new Set(assigneeRows.map((a) => a.user_id as string)),
  );

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const tasks = mapTasksWithAssignees(
    [taskRow],
    assigneeRows as { task_id: number; user_id: string }[],
    (profiles ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string | null;
    }[],
  );

  return tasks[0];
}
