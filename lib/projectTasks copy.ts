// lib/projectTasks.ts
import { supabase } from '@/lib/supabaseClient';

export type AppRole = 'admin' | 'supervisor' | 'vendedor' | string;

export type ProjectTaskStatus = 'not_started' | 'in_progress' | 'done' | 'cancelled';
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

/* ------------------------- helpers internos ------------------------- */

function mapTasksWithAssignees(
    tasks: ProjectTaskRow[],
    assigneeRows: { task_id: number; user_id: string }[],
    profiles: { id: string; full_name: string | null; email: string | null; role: string | null }[],
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

/* ---------------------- usuarios asignables ------------------------- */

export type SupervisorOption = {
    id: string;
    full_name: string | null;
    email: string | null;
};

// alias que usa la UI
export type AssignableUser = SupervisorOption;

/**
 * Devuelve la lista de usuarios que se pueden asignar a tareas
 * (actualmente todos los supervisores activos).
 */
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

// wrapper con el nombre que usa la página
export async function fetchAssignableUsers(): Promise<AssignableUser[]> {
    return fetchSupervisors();
}

/* ------------------------ fetch de tareas --------------------------- */

/**
 * Versión “baja nivel”: recibe id y rol del usuario.
 *
 * - admin: ve todas las tareas
 * - otros roles: solo tareas donde está asignado
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

    // 2) traemos todos los asignados de esas tareas
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

/**
 * Versión “alta nivel” que usa la página:
 * deduce el usuario actual y su rol.
 */
export async function fetchProjectTasks(): Promise<ProjectTaskWithAssignees[]> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData?.user) throw new Error('No hay usuario autenticado');

    const currentUserId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUserId)
        .single();

    if (profileError) throw profileError;

    const role = (profile?.role ?? 'vendedor') as AppRole;

    return fetchProjectTasksForUser(currentUserId, role);
}

/* -------------------- crear / actualizar tareas --------------------- */

export type CreateProjectTaskInput = {
    title: string;
    project?: string; // si no viene, usamos un “General”
    description?: string | null;
    summary?: string | null;
    status?: ProjectTaskStatus;
    priority?: ProjectTaskPriority;
    due_date?: string | null; // yyyy-mm-dd
    workspace_id?: number | null; // para futuro
    assigneeIds?: string[]; // lista de user_id de supervisores
};

/**
 * Crea una tarea de proyecto.
 * Usa el usuario autenticado como `created_by`.
 */
export async function createProjectTask(
    currentUserId: string,
    input: CreateProjectTaskInput,
): Promise<ProjectTaskWithAssignees> {
    // Normalizamos para evitar errores de "trim" sobre undefined
    const safeTitle = (input.title ?? '').trim();
    const safeProject = (input.project ?? '').trim();
    const safeDescription =
        input.description === undefined ? null : input.description;
    const safeSummary = input.summary === undefined ? null : input.summary;

    if (!safeTitle || !safeProject) {
        throw new Error('Faltan título o proyecto al crear la tarea.');
    }

    // 1) crear la tarea
    const { data: taskData, error: taskError } = await supabase
        .from('project_tasks')
        .insert({
            title: safeTitle,
            project: safeProject,
            description: safeDescription,
            summary: safeSummary,
            status: input.status ?? 'not_started',
            priority: input.priority ?? 'medium',
            due_date: input.due_date ?? null,
            workspace_id: input.workspace_id ?? null,
            created_by: currentUserId,
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

    // 3) si no hay asignados, devolvemos vacío
    if (assigneeRows.length === 0) {
        return { ...taskRow, assignees: [] };
    }

    // 4) traer perfiles de esos usuarios
    const userIds = Array.from(new Set(assigneeRows.map((a) => a.user_id)));

    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', userIds);

    if (profilesError) throw profilesError;

    const tasks = mapTasksWithAssignees(
        [taskRow],
        assigneeRows,
        (profiles ?? []) as any,
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
    assigneeIds: string[]; // para actualizar responsables
}>;

/**
 * Actualiza campos básicos de la tarea y, opcionalmente,
 * reemplaza por completo los responsables.
 */
export async function updateProjectTask(
    id: number,
    changes: UpdateProjectTaskInput,
): Promise<ProjectTaskWithAssignees> {
    const { assigneeIds, ...rest } = changes;

    const payload: any = { ...rest };

    if (payload.title) payload.title = payload.title.trim();
    if (payload.project) payload.project = payload.project.trim();

    if (Object.keys(payload).length > 0) {
        const { error: updateError } = await supabase
            .from('project_tasks')
            .update(payload)
            .eq('id', id);

        if (updateError) throw updateError;
    }

    if (assigneeIds) {
        await setTaskAssignees(id, assigneeIds);
    }

    const updated = await fetchProjectTaskById(id);
    if (!updated) {
        throw new Error('La tarea no se encontró después de actualizar');
    }

    return updated;
}

/**
 * Reemplaza completamente los responsables de una tarea.
 * (borra los actuales y crea los nuevos)
 */
export async function setTaskAssignees(
    taskId: number,
    assigneeIds: string[],
): Promise<void> {
    const { error: deleteError } = await supabase
        .from('project_task_assignees')
        .delete()
        .eq('task_id', taskId);

    if (deleteError) throw deleteError;

    if (assigneeIds.length === 0) return;

    const rows = assigneeIds.map((userId) => ({
        task_id: taskId,
        user_id: userId,
    }));

    const { error: insertError } = await supabase
        .from('project_task_assignees')
        .insert(rows);

    if (insertError) throw insertError;
}

/* ----------------------- fetch por id ------------------------------- */

/**
 * Helper para traer una sola tarea con sus responsables.
 */
export async function fetchProjectTaskById(
    id: number,
): Promise<ProjectTaskWithAssignees | null> {
    const { data: taskData, error: taskError } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('id', id)
        .single();

    if (taskError) {
        if ((taskError as any).code === 'PGRST116') return null; // not found
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
        assigneeRows as any,
        (profiles ?? []) as any,
    );

    return tasks[0];
}
