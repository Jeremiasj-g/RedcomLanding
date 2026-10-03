import { supabase } from '@/lib/supabaseClient';

export type ProjectTaskComment = {
  id: number;
  task_id: number;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_email: string | null;
};

export type ProjectTaskActivity = {
  id: number;
  task_id: number;
  actor_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
  target_name: string | null;
  target_email: string | null;
};

export type ProjectTaskConversation = {
  comments: ProjectTaskComment[];
  activities: ProjectTaskActivity[];
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function targetUserId(metadata: Record<string, unknown>) {
  const value = metadata?.target_user_id;
  return typeof value === 'string' ? value : null;
}

export async function fetchProjectTaskConversation(
  taskId: number,
): Promise<ProjectTaskConversation> {
  const [commentsResult, activityResult] = await Promise.all([
    supabase
      .from('project_task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_task_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false }),
  ]);

  if (commentsResult.error) throw commentsResult.error;
  if (activityResult.error) throw activityResult.error;

  const rawComments = commentsResult.data ?? [];
  const rawActivities = activityResult.data ?? [];

  const profileIds = Array.from(
    new Set(
      [
        ...rawComments.map((row: any) => row.author_id as string),
        ...rawActivities
          .map((row: any) => row.actor_id as string | null)
          .filter((value): value is string => Boolean(value)),
        ...rawActivities
          .map((row: any) =>
            targetUserId((row.metadata ?? {}) as Record<string, unknown>),
          )
          .filter((value): value is string => Boolean(value)),
      ].filter(Boolean),
    ),
  );

  let profiles: ProfileLite[] = [];

  if (profileIds.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds);

    if (error) throw error;
    profiles = (data ?? []) as ProfileLite[];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const comments: ProjectTaskComment[] = rawComments.map((row: any) => {
    const author = profileById.get(row.author_id as string);

    return {
      id: Number(row.id),
      task_id: Number(row.task_id),
      author_id: row.author_id as string,
      content: row.content as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      author_name: author?.full_name ?? null,
      author_email: author?.email ?? null,
    };
  });

  const activities: ProjectTaskActivity[] = rawActivities.map((row: any) => {
    const actorId = (row.actor_id as string | null) ?? null;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const targetId = targetUserId(metadata);
    const actor = actorId ? profileById.get(actorId) : null;
    const target = targetId ? profileById.get(targetId) : null;

    return {
      id: Number(row.id),
      task_id: Number(row.task_id),
      actor_id: actorId,
      event_type: row.event_type as string,
      metadata,
      created_at: row.created_at as string,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
      target_name: target?.full_name ?? null,
      target_email: target?.email ?? null,
    };
  });

  return { comments, activities };
}

export async function createProjectTaskComment(
  taskId: number,
  content: string,
): Promise<void> {
  const clean = content.trim();
  if (!clean) return;

  const { error } = await supabase
    .from('project_task_comments')
    .insert({
      task_id: taskId,
      content: clean,
    });

  if (error) throw error;
}

export async function deleteProjectTaskComment(
  commentId: number,
): Promise<void> {
  const { error } = await supabase
    .from('project_task_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}
