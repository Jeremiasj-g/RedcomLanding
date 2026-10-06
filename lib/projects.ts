import { supabase } from '@/lib/supabaseClient';

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export type ProjectRow = {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  member_role: 'owner' | 'member';
};

export type ProjectWithMembers = ProjectRow & {
  owner_name: string | null;
  owner_email: string | null;
  members: ProjectMember[];
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  owner_id?: string | null;
};

export type UpdateProjectInput = Partial<{
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
}>;

async function hydrateProjects(rows: ProjectRow[]): Promise<ProjectWithMembers[]> {
  if (!rows.length) return [];

  const projectIds = rows.map((row) => row.id);

  const { data: memberRows, error: membersError } = await supabase
    .from('project_members')
    .select('project_id, user_id, member_role')
    .in('project_id', projectIds);

  if (membersError) throw membersError;

  const ownerIds = rows
    .map((row) => row.owner_id)
    .filter((value): value is string => Boolean(value));

  const memberIds = (memberRows ?? []).map((row: any) => row.user_id as string);
  const profileIds = Array.from(new Set([...ownerIds, ...memberIds]));

  let profiles: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
  }> = [];

  if (profileIds.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', profileIds);

    if (error) throw error;
    profiles = data ?? [];
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const membersByProject = new Map<number, ProjectMember[]>();

  for (const row of memberRows ?? []) {
    const profile = profilesById.get(row.user_id as string);
    const current = membersByProject.get(row.project_id as number) ?? [];

    current.push({
      user_id: row.user_id as string,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: profile?.role ?? null,
      member_role: row.member_role as 'owner' | 'member',
    });

    membersByProject.set(row.project_id as number, current);
  }

  return rows.map((row) => {
    const owner = row.owner_id ? profilesById.get(row.owner_id) : null;

    return {
      ...row,
      owner_name: owner?.full_name ?? null,
      owner_email: owner?.email ?? null,
      members: membersByProject.get(row.id) ?? [],
    };
  });
}

export async function fetchProjectsForUser(
  currentUserId: string,
  role: string,
): Promise<ProjectWithMembers[]> {
  let rows: ProjectRow[] = [];

  if (role === 'admin' || role === 'jdv') {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('status', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    rows = (data ?? []) as ProjectRow[];
  } else {
    const { data: memberships, error: membershipsError } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', currentUserId);

    if (membershipsError) throw membershipsError;

    const projectIds = Array.from(
      new Set((memberships ?? []).map((row: any) => Number(row.project_id))),
    ).filter((id) => Number.isFinite(id));

    if (!projectIds.length) return [];

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .order('status', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    rows = (data ?? []) as ProjectRow[];
  }

  return hydrateProjects(rows);
}

export async function createProject(
  currentUserId: string,
  input: CreateProjectInput,
): Promise<ProjectWithMembers> {
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error('El nombre del proyecto es obligatorio.');

  const ownerId = input.owner_id ?? currentUserId;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: cleanName,
      description: input.description?.trim() || null,
      status: 'active',
      owner_id: ownerId,
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      created_by: currentUserId,
    })
    .select('*')
    .single();

  if (error) throw error;

  const row = data as ProjectRow;

  const { error: memberError } = await supabase
    .from('project_members')
    .upsert(
      {
        project_id: row.id,
        user_id: ownerId,
        member_role: 'owner',
      },
      { onConflict: 'project_id,user_id' },
    );

  if (memberError) throw memberError;

  const [hydrated] = await hydrateProjects([row]);
  return hydrated;
}

export async function updateProject(
  id: number,
  changes: UpdateProjectInput,
): Promise<ProjectWithMembers> {
  const payload: Record<string, unknown> = { ...changes };

  if (typeof payload.name === 'string') {
    payload.name = payload.name.trim();
  }

  if (typeof payload.description === 'string') {
    payload.description = payload.description.trim() || null;
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  const row = data as ProjectRow;

  if (changes.owner_id) {
    await supabase
      .from('project_members')
      .update({ member_role: 'member' })
      .eq('project_id', id)
      .eq('member_role', 'owner');

    const { error: ownerError } = await supabase
      .from('project_members')
      .upsert(
        {
          project_id: id,
          user_id: changes.owner_id,
          member_role: 'owner',
        },
        { onConflict: 'project_id,user_id' },
      );

    if (ownerError) throw ownerError;
  }

  const [hydrated] = await hydrateProjects([row]);
  return hydrated;
}

export async function addProjectMembers(
  projectId: number,
  userIds: string[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (!uniqueIds.length) return;

  const { error } = await supabase.from('project_members').upsert(
    uniqueIds.map((userId) => ({
      project_id: projectId,
      user_id: userId,
      member_role: 'member',
    })),
    { onConflict: 'project_id,user_id', ignoreDuplicates: true },
  );

  if (error) throw error;
}
