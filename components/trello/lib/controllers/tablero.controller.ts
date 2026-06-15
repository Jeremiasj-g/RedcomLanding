import { supabase } from '@/lib/supabaseClient';
import type {
  Board,
  BoardCover,
  BoardLabelOption,
  BoardList,
  BoardTaskActivity,
  BoardTaskCard,
  BoardTaskChecklist,
  BoardTaskChecklistItem,
  BoardTaskComment,
  ChatMessage,
  CreateWorkspaceInput,
  CreateBoardLabelInput,
  CreateBoardInput,
  CreateBoardListInput,
  CreateBoardTaskCardInput,
  MoveBoardTaskCardInput,
  ReorderBoardListInput,
  UpdateBoardInput,
  UpdateBoardLabelInput,
  UpdateBoardListInput,
  UpdateBoardTaskCardInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceMember,
} from '../../types/trello';

const WORKSPACE_EXPANDED_STORAGE_KEY = 'redcom-trello:workspace-expanded';
const SYSTEM_WORKSPACE_ID = '__system__';

type DbRow = Record<string, any>;

type ProfileLite = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  branch: string | null;
  branch_id: number | null;
  is_active: boolean | null;
};

const workspaceColors: Workspace['color'][] = ['orange', 'pink', 'red', 'blue', 'green', 'purple'];
const memberColors: WorkspaceMember['avatarColor'][] = ['orange', 'red', 'blue', 'green', 'purple'];

function readExpandedMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(WORKSPACE_EXPANDED_STORAGE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeExpandedMap(value: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WORKSPACE_EXPANDED_STORAGE_KEY, JSON.stringify(value));
}

function hashText(value: string): number {
  return [...value].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || 'Usuario').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function getUsername(profile: ProfileLite): string {
  const emailUser = profile.email?.split('@')[0];
  if (emailUser) return emailUser.toLowerCase();
  return (profile.full_name || 'usuario').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function toWorkspaceVisibility(value: string | null | undefined): Workspace['visibility'] {
  return value === 'public' ? 'publico' : 'privado';
}

function toDbWorkspaceVisibility(value: Workspace['visibility'] | undefined): 'private' | 'public' | undefined {
  if (!value) return undefined;
  return value === 'publico' ? 'public' : 'private';
}

function toBoardVisibility(value: string | null | undefined): Board['visibility'] {
  return value === 'public' ? 'publico' : 'privado';
}

function toDbBoardVisibility(value: Board['visibility'] | undefined): 'private' | 'public' | undefined {
  if (!value) return undefined;
  return value === 'publico' ? 'public' : 'private';
}

function normalizeDbTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 5);
}

function nullableDate(value?: string): string | null {
  return value && value.trim() ? value : null;
}

function nullableTime(value?: string): string | null {
  return value && value.trim() ? value : null;
}

function coverToDb(cover?: BoardCover): Pick<DbRow, 'background_type' | 'background_value'> | null {
  if (!cover) return null;
  return {
    background_type: cover.type === 'solid' ? 'color' : cover.type,
    background_value: cover.value,
  };
}

function coverFromDb(row: DbRow): BoardCover {
  const type = row.background_type === 'color' ? 'solid' : row.background_type;
  if (type === 'solid' || type === 'gradient' || type === 'image') {
    return { type, value: row.background_value };
  }
  return { type: 'gradient', value: row.background_value ?? 'linear-gradient(135deg, #003f5c, #111827)' };
}

function throwIfError(error: any, context: string): void {
  if (error) {
    console.error(`[Tableros] ${context}`, error);
    throw new Error(error.message || context);
  }
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error, 'No se pudo obtener el usuario actual');
  const userId = data.user?.id;
  if (!userId) throw new Error('No hay una sesión activa para usar Tableros.');
  return userId;
}

async function getAvailableProfiles(): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('trello_available_users')
    .select('id,email,full_name,role,branch,branch_id,is_active')
    .order('full_name', { ascending: true });
  throwIfError(error, 'No se pudieron cargar los usuarios disponibles');
  return (data ?? []) as ProfileLite[];
}

function profileToMember(profile: ProfileLite, currentUserId?: string, workspaceId = SYSTEM_WORKSPACE_ID, role: WorkspaceMember['role'] = 'Miembro', boardCount = 0): WorkspaceMember {
  const initials = getInitials(profile.full_name, profile.email);
  const hash = hashText(profile.id);
  return {
    id: profile.id,
    workspaceId,
    fullName: profile.full_name || profile.email || 'Usuario sin nombre',
    username: getUsername(profile),
    avatarText: initials,
    avatarColor: memberColors[hash % memberColors.length],
    boardCount,
    role,
    lastActivity: 'Sin actividad',
    status: 'member',
    isCurrentUser: profile.id === currentUserId,
  };
}

function mapWorkspace(row: DbRow, index: number, expandedMap: Record<string, boolean>): Workspace {
  return {
    id: row.id,
    name: row.name,
    avatar: getInitials(row.name).slice(0, 1),
    color: workspaceColors[index % workspaceColors.length],
    visibility: toWorkspaceVisibility(row.visibility),
    expanded: expandedMap[row.id] ?? index === 0,
  };
}

function mapBoard(row: DbRow, memberIds: string[], favoriteBoardIds: Set<string>): Board {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.name,
    cover: coverFromDb(row),
    visibility: toBoardVisibility(row.visibility),
    favorite: favoriteBoardIds.has(row.id),
    memberIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLabel(row: DbRow): BoardLabelOption {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  };
}

function mapComment(row: DbRow, profileById: Map<string, ProfileLite>, currentUserId?: string): BoardTaskComment {
  const profile = profileById.get(row.user_id);
  return {
    id: row.id,
    authorName: profile?.full_name || profile?.email || 'Usuario',
    avatarText: getInitials(profile?.full_name, profile?.email),
    message: row.content,
    createdAt: row.created_at,
    isCurrentUser: row.user_id === currentUserId,
  };
}

function mapActivity(row: DbRow, profileById: Map<string, ProfileLite>): BoardTaskActivity {
  const profile = row.user_id ? profileById.get(row.user_id) : undefined;
  return {
    id: row.id,
    actorName: profile?.full_name || profile?.email || 'Sistema',
    avatarText: getInitials(profile?.full_name, profile?.email || 'S'),
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapMessage(row: DbRow, profileById: Map<string, ProfileLite>, currentUserId?: string): ChatMessage {
  const profile = profileById.get(row.user_id);
  const createdAt = new Date(row.created_at);
  const sentAt = Number.isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return {
    id: row.id,
    boardId: row.board_id,
    senderName: profile?.full_name || profile?.email || 'Usuario',
    avatarText: getInitials(profile?.full_name, profile?.email),
    message: row.content,
    sentAt,
    isCurrentUser: row.user_id === currentUserId,
  };
}

async function getBoardMemberIdsByBoard(): Promise<Map<string, string[]>> {
  const { data, error } = await supabase.from('trello_board_members').select('board_id,user_id');
  throwIfError(error, 'No se pudieron cargar los miembros de tableros');
  const map = new Map<string, string[]>();
  (data ?? []).forEach((row: any) => {
    const current = map.get(row.board_id) ?? [];
    current.push(row.user_id);
    map.set(row.board_id, current);
  });
  return map;
}

async function getFavoriteBoardIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('trello_board_favorites').select('board_id').eq('user_id', userId);
  throwIfError(error, 'No se pudieron cargar favoritos de tableros');
  return new Set((data ?? []).map((row: any) => row.board_id));
}

async function getMaxPosition(table: string, filterColumn: string, filterValue: string): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select('position')
    .eq(filterColumn, filterValue)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error, `No se pudo calcular la posición para ${table}`);
  return typeof data?.position === 'number' ? data.position : -1;
}

async function resolveUserIdsFromAvatarTexts(avatarTexts: string[], boardId: string): Promise<string[]> {
  if (avatarTexts.length === 0) return [];
  const [profiles, boardMembersResult] = await Promise.all([
    getAvailableProfiles(),
    supabase.from('trello_board_members').select('user_id').eq('board_id', boardId),
  ]);
  throwIfError(boardMembersResult.error, 'No se pudieron resolver miembros del tablero');
  const allowedIds = new Set((boardMembersResult.data ?? []).map((row: any) => row.user_id));
  const profileByInitials = new Map<string, string>();
  profiles.forEach((profile) => {
    if (allowedIds.has(profile.id)) profileByInitials.set(getInitials(profile.full_name, profile.email), profile.id);
  });
  return Array.from(new Set(avatarTexts.map((text) => profileByInitials.get(text)).filter(Boolean) as string[]));
}

async function reloadListById(listId: string): Promise<BoardList | null> {
  const lists = await tableroController.getBoardLists();
  return lists.find((list) => list.id === listId) ?? null;
}

async function reloadListsForBoard(boardId: string): Promise<BoardList[]> {
  const lists = await tableroController.getBoardLists();
  return lists.filter((list) => list.boardId === boardId);
}

async function syncCardLabels(cardId: string, labelIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from('trello_card_labels').delete().eq('card_id', cardId);
  throwIfError(deleteError, 'No se pudieron sincronizar etiquetas de la tarjeta');
  if (labelIds.length === 0) return;
  const rows = Array.from(new Set(labelIds)).map((labelId) => ({ card_id: cardId, label_id: labelId }));
  const { error } = await supabase.from('trello_card_labels').insert(rows);
  throwIfError(error, 'No se pudieron guardar etiquetas de la tarjeta');
}

async function syncCardMembers(cardId: string, boardId: string, avatarTexts: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from('trello_card_members').delete().eq('card_id', cardId);
  throwIfError(deleteError, 'No se pudieron sincronizar miembros de la tarjeta');
  const userIds = await resolveUserIdsFromAvatarTexts(avatarTexts, boardId);
  if (userIds.length === 0) return;
  const rows = userIds.map((userId) => ({ card_id: cardId, user_id: userId }));
  const { error } = await supabase.from('trello_card_members').insert(rows);
  throwIfError(error, 'No se pudieron guardar miembros de la tarjeta');
}

async function syncCardComments(cardId: string, comments: BoardTaskComment[]): Promise<void> {
  const userId = await getCurrentUserId();
  const { error: deleteError } = await supabase.from('trello_card_comments').delete().eq('card_id', cardId);
  throwIfError(deleteError, 'No se pudieron sincronizar comentarios');
  if (comments.length === 0) return;
  const rows = comments.map((comment) => ({
    card_id: cardId,
    user_id: userId,
    content: comment.message,
    created_at: comment.createdAt || new Date().toISOString(),
  }));
  const { error } = await supabase.from('trello_card_comments').insert(rows);
  throwIfError(error, 'No se pudieron guardar comentarios');
}

async function syncCardActivity(cardId: string, activities: BoardTaskActivity[]): Promise<void> {
  const userId = await getCurrentUserId();
  const { error: deleteError } = await supabase.from('trello_card_activity').delete().eq('card_id', cardId);
  throwIfError(deleteError, 'No se pudo sincronizar actividad');
  if (activities.length === 0) return;
  const rows = activities.map((activity) => ({
    card_id: cardId,
    user_id: userId,
    action_type: 'frontend_event',
    message: activity.message,
    created_at: activity.createdAt || new Date().toISOString(),
    metadata: {},
  }));
  const { error } = await supabase.from('trello_card_activity').insert(rows);
  throwIfError(error, 'No se pudo guardar actividad');
}

async function syncCardChecklists(cardId: string, boardId: string, checklists: BoardTaskChecklist[]): Promise<void> {
  const { error: deleteError } = await supabase.from('trello_checklists').delete().eq('card_id', cardId);
  throwIfError(deleteError, 'No se pudieron sincronizar checklists');

  for (let checklistIndex = 0; checklistIndex < checklists.length; checklistIndex += 1) {
    const checklist = checklists[checklistIndex];
    const { data: insertedChecklist, error: checklistError } = await supabase
      .from('trello_checklists')
      .insert({ card_id: cardId, title: checklist.title || 'Checklist', position: checklistIndex })
      .select('id')
      .single();
    throwIfError(checklistError, 'No se pudo guardar checklist');
    const checklistId = insertedChecklist?.id as string | undefined;
    if (!checklistId) continue;

    for (let itemIndex = 0; itemIndex < (checklist.items ?? []).length; itemIndex += 1) {
      const item = checklist.items[itemIndex];
      const { data: insertedItem, error: itemError } = await supabase
        .from('trello_checklist_items')
        .insert({
          checklist_id: checklistId,
          title: item.title,
          is_done: Boolean(item.completed),
          position: itemIndex,
          due_date: item.dueDateEnabled === false ? null : nullableDate(item.dueDate),
          due_time: item.dueDateEnabled === false ? null : nullableTime(item.dueTime),
        })
        .select('id')
        .single();
      throwIfError(itemError, 'No se pudo guardar item de checklist');

      if (item.assignedTo && insertedItem?.id) {
        const [userId] = await resolveUserIdsFromAvatarTexts([item.assignedTo], boardId);
        if (userId) {
          const { error: memberError } = await supabase
            .from('trello_checklist_item_members')
            .insert({ item_id: insertedItem.id, user_id: userId });
          throwIfError(memberError, 'No se pudo asignar miembro al item de checklist');
        }
      }
    }
  }
}

export const tableroController = {
  async getWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from('trello_workspaces')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    throwIfError(error, 'No se pudieron cargar espacios de trabajo');
    const expandedMap = readExpandedMap();
    return (data ?? []).map((row: any, index: number) => mapWorkspace(row, index, expandedMap));
  },

  async getBoards(): Promise<Board[]> {
    const currentUserId = await getCurrentUserId();
    const [boardsResult, membersByBoard, favoriteBoardIds] = await Promise.all([
      supabase
        .from('trello_boards')
        .select('*')
        .is('deleted_at', null)
        .eq('is_archived', false)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false }),
      getBoardMemberIdsByBoard(),
      getFavoriteBoardIds(currentUserId),
    ]);
    throwIfError(boardsResult.error, 'No se pudieron cargar tableros');
    return (boardsResult.data ?? []).map((row: any) => mapBoard(row, membersByBoard.get(row.id) ?? [], favoriteBoardIds));
  },

  async getBoardLists(): Promise<BoardList[]> {
    const currentUserId = await getCurrentUserId();
    const [
      listsResult,
      cardsResult,
      labelsResult,
      cardLabelsResult,
      cardMembersResult,
      checklistsResult,
      checklistItemsResult,
      checklistItemMembersResult,
      commentsResult,
      activityResult,
      profiles,
    ] = await Promise.all([
      supabase.from('trello_lists').select('*').is('deleted_at', null).eq('is_archived', false).order('position', { ascending: true }),
      supabase.from('trello_cards').select('*').is('deleted_at', null).order('position', { ascending: true }),
      supabase.from('trello_board_labels').select('*').order('position', { ascending: true }),
      supabase.from('trello_card_labels').select('*'),
      supabase.from('trello_card_members').select('*'),
      supabase.from('trello_checklists').select('*').order('position', { ascending: true }),
      supabase.from('trello_checklist_items').select('*').order('position', { ascending: true }),
      supabase.from('trello_checklist_item_members').select('*'),
      supabase.from('trello_card_comments').select('*').is('deleted_at', null).order('created_at', { ascending: true }),
      supabase.from('trello_card_activity').select('*').order('created_at', { ascending: true }),
      getAvailableProfiles(),
    ]);

    throwIfError(listsResult.error, 'No se pudieron cargar listas');
    throwIfError(cardsResult.error, 'No se pudieron cargar tarjetas');
    throwIfError(labelsResult.error, 'No se pudieron cargar etiquetas');
    throwIfError(cardLabelsResult.error, 'No se pudieron cargar relaciones de etiquetas');
    throwIfError(cardMembersResult.error, 'No se pudieron cargar miembros de tarjetas');
    throwIfError(checklistsResult.error, 'No se pudieron cargar checklists');
    throwIfError(checklistItemsResult.error, 'No se pudieron cargar items de checklists');
    throwIfError(checklistItemMembersResult.error, 'No se pudieron cargar miembros de items');
    throwIfError(commentsResult.error, 'No se pudieron cargar comentarios');
    throwIfError(activityResult.error, 'No se pudo cargar actividad');

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const avatarByUserId = new Map(profiles.map((profile) => [profile.id, getInitials(profile.full_name, profile.email)]));

    const labelIdsByCard = new Map<string, string[]>();
    (cardLabelsResult.data ?? []).forEach((row: any) => {
      const current = labelIdsByCard.get(row.card_id) ?? [];
      current.push(row.label_id);
      labelIdsByCard.set(row.card_id, current);
    });

    const memberTextsByCard = new Map<string, string[]>();
    (cardMembersResult.data ?? []).forEach((row: any) => {
      const current = memberTextsByCard.get(row.card_id) ?? [];
      current.push(avatarByUserId.get(row.user_id) ?? 'US');
      memberTextsByCard.set(row.card_id, current);
    });

    const commentsByCard = new Map<string, BoardTaskComment[]>();
    (commentsResult.data ?? []).forEach((row: any) => {
      const current = commentsByCard.get(row.card_id) ?? [];
      current.push(mapComment(row, profileById, currentUserId));
      commentsByCard.set(row.card_id, current);
    });

    const activityByCard = new Map<string, BoardTaskActivity[]>();
    (activityResult.data ?? []).forEach((row: any) => {
      const current = activityByCard.get(row.card_id) ?? [];
      current.push(mapActivity(row, profileById));
      activityByCard.set(row.card_id, current);
    });

    const itemMemberByItem = new Map<string, string>();
    (checklistItemMembersResult.data ?? []).forEach((row: any) => {
      if (!itemMemberByItem.has(row.item_id)) itemMemberByItem.set(row.item_id, avatarByUserId.get(row.user_id) ?? 'US');
    });

    const itemsByChecklist = new Map<string, BoardTaskChecklistItem[]>();
    (checklistItemsResult.data ?? []).forEach((row: any) => {
      const current = itemsByChecklist.get(row.checklist_id) ?? [];
      current.push({
        id: row.id,
        title: row.title,
        completed: Boolean(row.is_done),
        assignedTo: itemMemberByItem.get(row.id),
        dueDate: row.due_date ?? undefined,
        dueTime: normalizeDbTime(row.due_time),
        dueDateEnabled: Boolean(row.due_date),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      itemsByChecklist.set(row.checklist_id, current);
    });

    const checklistsByCard = new Map<string, BoardTaskChecklist[]>();
    (checklistsResult.data ?? []).forEach((row: any) => {
      const current = checklistsByCard.get(row.card_id) ?? [];
      current.push({
        id: row.id,
        title: row.title,
        items: itemsByChecklist.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      checklistsByCard.set(row.card_id, current);
    });

    const cardsByList = new Map<string, BoardTaskCard[]>();
    (cardsResult.data ?? []).forEach((row: any) => {
      const current = cardsByList.get(row.list_id) ?? [];
      current.push({
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        completed: Boolean(row.is_completed),
        labels: labelIdsByCard.get(row.id) ?? [],
        members: memberTextsByCard.get(row.id) ?? [],
        startDate: row.start_date ?? undefined,
        dueDate: row.due_date ?? undefined,
        dueTime: normalizeDbTime(row.due_time),
        dueDateEnabled: Boolean(row.due_date),
        startDateEnabled: Boolean(row.start_date),
        comments: commentsByCard.get(row.id) ?? [],
        activities: activityByCard.get(row.id) ?? [],
        checklists: checklistsByCard.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      cardsByList.set(row.list_id, current);
    });

    return (listsResult.data ?? []).map((row: any) => ({
      id: row.id,
      boardId: row.board_id,
      title: row.name,
      cards: cardsByList.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async getWorkspaceMembers(): Promise<WorkspaceMember[]> {
    const currentUserId = await getCurrentUserId();
    const [profiles, workspaceMembersResult, boardsResult, boardMembersResult] = await Promise.all([
      getAvailableProfiles(),
      supabase.from('trello_workspace_members').select('*'),
      supabase.from('trello_boards').select('id,workspace_id').is('deleted_at', null),
      supabase.from('trello_board_members').select('board_id,user_id'),
    ]);
    throwIfError(workspaceMembersResult.error, 'No se pudieron cargar miembros de espacios');
    throwIfError(boardsResult.error, 'No se pudieron cargar conteos de tableros');
    throwIfError(boardMembersResult.error, 'No se pudieron cargar miembros de tableros');

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const boardWorkspaceById = new Map((boardsResult.data ?? []).map((row: any) => [row.id, row.workspace_id]));
    const boardCountByWorkspaceUser = new Map<string, number>();
    (boardMembersResult.data ?? []).forEach((row: any) => {
      const workspaceId = boardWorkspaceById.get(row.board_id);
      if (!workspaceId) return;
      const key = `${workspaceId}:${row.user_id}`;
      boardCountByWorkspaceUser.set(key, (boardCountByWorkspaceUser.get(key) ?? 0) + 1);
    });

    const realMembers = (workspaceMembersResult.data ?? [])
      .map((row: any) => {
        const profile = profileById.get(row.user_id);
        if (!profile) return null;
        const role: WorkspaceMember['role'] = row.role === 'owner' || row.role === 'admin' ? 'Administrador' : row.role === 'guest' ? 'Observador' : 'Miembro';
        return profileToMember(profile, currentUserId, row.workspace_id, role, boardCountByWorkspaceUser.get(`${row.workspace_id}:${row.user_id}`) ?? 0);
      })
      .filter(Boolean) as WorkspaceMember[];

    const systemUsers = profiles.map((profile) => profileToMember(profile, currentUserId));
    return [...realMembers, ...systemUsers];
  },

  async getBoardLabels(): Promise<BoardLabelOption[]> {
    const { data, error } = await supabase
      .from('trello_board_labels')
      .select('*')
      .order('position', { ascending: true });
    throwIfError(error, 'No se pudieron cargar etiquetas de tableros');
    return (data ?? []).map(mapLabel);
  },

  async createBoardLabel(input: CreateBoardLabelInput): Promise<BoardLabelOption> {
    if (!input.boardId) throw new Error('No hay tablero seleccionado para crear la etiqueta.');
    const position = (await getMaxPosition('trello_board_labels', 'board_id', input.boardId)) + 1;
    const { data, error } = await supabase
      .from('trello_board_labels')
      .insert({ board_id: input.boardId, name: input.name.trim(), color: input.color, position })
      .select('*')
      .single();
    throwIfError(error, 'No se pudo crear la etiqueta');
    return mapLabel(data as DbRow);
  },

  async updateBoardLabel(labelId: string, input: UpdateBoardLabelInput): Promise<BoardLabelOption | null> {
    const payload: DbRow = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.color !== undefined) payload.color = input.color;
    const { data, error } = await supabase.from('trello_board_labels').update(payload).eq('id', labelId).select('*').maybeSingle();
    throwIfError(error, 'No se pudo actualizar la etiqueta');
    return data ? mapLabel(data as DbRow) : null;
  },

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('trello_workspaces')
      .insert({
        name: input.name.trim(),
        visibility: toDbWorkspaceVisibility(input.visibility),
        owner_id: userId,
        created_by: userId,
      })
      .select('*')
      .single();
    throwIfError(error, 'No se pudo crear el espacio de trabajo');

    const { error: memberError } = await supabase.from('trello_workspace_members').upsert({ workspace_id: data.id, user_id: userId, role: 'owner', created_by: userId });
    throwIfError(memberError, 'No se pudo asignar el creador al espacio');

    const expandedMap = readExpandedMap();
    Object.keys(expandedMap).forEach((workspaceId) => { expandedMap[workspaceId] = false; });
    expandedMap[data.id] = true;
    writeExpandedMap(expandedMap);

    return mapWorkspace(data as DbRow, 0, expandedMap);
  },

  async createBoard(input: CreateBoardInput): Promise<Board> {
    const userId = await getCurrentUserId();
    const position = (await getMaxPosition('trello_boards', 'workspace_id', input.workspaceId)) + 1;
    const coverPayload = coverToDb(input.cover) ?? {};
    const { data, error } = await supabase
      .from('trello_boards')
      .insert({
        workspace_id: input.workspaceId,
        name: input.title.trim(),
        visibility: toDbBoardVisibility(input.visibility),
        position,
        created_by: userId,
        ...coverPayload,
      })
      .select('*')
      .single();
    throwIfError(error, 'No se pudo crear el tablero');

    await Promise.all([
      supabase.from('trello_board_members').upsert({ board_id: data.id, user_id: userId, role: 'owner', created_by: userId }),
      supabase.from('trello_workspace_members').upsert({ workspace_id: input.workspaceId, user_id: userId, role: 'owner', created_by: userId }),
    ]).then((responses) => responses.forEach((response) => throwIfError(response.error, 'No se pudo asignar el creador al tablero')));

    return mapBoard(data as DbRow, [userId], new Set());
  },

  async createBoardList(input: CreateBoardListInput): Promise<BoardList> {
    const userId = await getCurrentUserId();
    const position = (await getMaxPosition('trello_lists', 'board_id', input.boardId)) + 1;
    const { data, error } = await supabase
      .from('trello_lists')
      .insert({ board_id: input.boardId, name: input.title.trim(), position, created_by: userId })
      .select('*')
      .single();
    throwIfError(error, 'No se pudo crear la lista');
    return { id: data.id, boardId: data.board_id, title: data.name, cards: [], createdAt: data.created_at, updatedAt: data.updated_at };
  },

  async createBoardTaskCard(input: CreateBoardTaskCardInput): Promise<BoardList | null> {
    const userId = await getCurrentUserId();
    const { data: list, error: listError } = await supabase.from('trello_lists').select('id,board_id').eq('id', input.listId).single();
    throwIfError(listError, 'No se pudo encontrar la lista');
    if (!list) throw new Error('No se pudo encontrar la lista.');
    const position = (await getMaxPosition('trello_cards', 'list_id', input.listId)) + 1;
    const { error } = await supabase.from('trello_cards').insert({
      board_id: list.board_id,
      list_id: input.listId,
      title: input.title.trim(),
      position,
      created_by: userId,
    });
    throwIfError(error, 'No se pudo crear la tarjeta');
    return reloadListById(input.listId);
  },

  async moveBoardTaskCard(input: MoveBoardTaskCardInput): Promise<BoardList[]> {
    const lists = await this.getBoardLists();
    const sourceList = lists.find((list) => list.id === input.fromListId);
    const targetList = lists.find((list) => list.id === input.toListId);
    if (!sourceList || !targetList) return lists;

    const sourceCards = [...sourceList.cards];
    const sourceCardIndex = sourceCards.findIndex((card) => card.id === input.cardId);
    if (sourceCardIndex === -1) return lists;
    const [movedCard] = sourceCards.splice(sourceCardIndex, 1);
    const targetCards = input.fromListId === input.toListId ? sourceCards : [...targetList.cards];
    const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, targetCards.length));
    targetCards.splice(safeTargetIndex, 0, movedCard);

    for (const [index, card] of sourceCards.entries()) {
      const { error } = await supabase.from('trello_cards').update({ list_id: input.fromListId, position: index }).eq('id', card.id);
      throwIfError(error, 'No se pudo mover la tarjeta');
    }
    for (const [index, card] of targetCards.entries()) {
      const { error } = await supabase.from('trello_cards').update({ list_id: input.toListId, position: index }).eq('id', card.id);
      throwIfError(error, 'No se pudo mover la tarjeta');
    }
    return this.getBoardLists();
  },

  async reorderBoardList(input: ReorderBoardListInput): Promise<BoardList[]> {
    const lists = await this.getBoardLists();
    const boardLists = lists.filter((list) => list.boardId === input.boardId);
    const sourceIndex = boardLists.findIndex((list) => list.id === input.listId);
    if (sourceIndex === -1) return lists;
    const [movedList] = boardLists.splice(sourceIndex, 1);
    const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, boardLists.length));
    boardLists.splice(safeTargetIndex, 0, movedList);
    const responses = await Promise.all(
      boardLists.map((list, index) => supabase.from('trello_lists').update({ position: index }).eq('id', list.id)),
    );
    responses.forEach((response) => throwIfError(response.error, 'No se pudo reordenar la lista'));
    return this.getBoardLists();
  },

  async updateBoardList(listId: string, input: UpdateBoardListInput): Promise<BoardList | null> {
    const payload: DbRow = {};
    if (input.title !== undefined) payload.name = input.title.trim();
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('trello_lists').update(payload).eq('id', listId);
      throwIfError(error, 'No se pudo actualizar la lista');
    }

    if (input.cards !== undefined) {
      if (input.cards.length === 0) {
        const { error } = await supabase.from('trello_cards').delete().eq('list_id', listId);
        throwIfError(error, 'No se pudo vaciar la lista');
      } else {
        const responses = await Promise.all(
          input.cards.map((card, index) => supabase.from('trello_cards').update({ position: index, list_id: listId }).eq('id', card.id)),
        );
        responses.forEach((response) => throwIfError(response.error, 'No se pudo ordenar tarjetas'));
      }
    }

    return reloadListById(listId);
  },

  async deleteBoardList(listId: string): Promise<void> {
    const { error } = await supabase.from('trello_lists').delete().eq('id', listId);
    throwIfError(error, 'No se pudo eliminar la lista');
  },

  async inviteWorkspaceMember(workspaceId: string, sourceMemberId: string): Promise<WorkspaceMember | null> {
    const userId = sourceMemberId;
    const currentUserId = await getCurrentUserId();
    const { error } = await supabase.from('trello_workspace_members').upsert({ workspace_id: workspaceId, user_id: userId, role: 'member', created_by: currentUserId });
    throwIfError(error, 'No se pudo invitar al miembro');
    const members = await this.getWorkspaceMembers();
    return members.find((member) => member.workspaceId === workspaceId && member.id === userId) ?? null;
  },

  async removeWorkspaceMember(memberId: string, workspaceId?: string): Promise<void> {
    let query = supabase.from('trello_workspace_members').delete().eq('user_id', memberId);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { error } = await query;
    throwIfError(error, 'No se pudo quitar el miembro');
  },

  async updateBoardTaskCard(listId: string, cardId: string, input: UpdateBoardTaskCardInput): Promise<BoardList | null> {
    const { data: card, error: cardError } = await supabase.from('trello_cards').select('*').eq('id', cardId).single();
    throwIfError(cardError, 'No se pudo encontrar la tarjeta');

    const payload: DbRow = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description;
    if (input.completed !== undefined) payload.is_completed = input.completed;
    if (input.startDateEnabled !== undefined || input.startDate !== undefined) payload.start_date = input.startDateEnabled === false ? null : nullableDate(input.startDate);
    if (input.dueDateEnabled !== undefined || input.dueDate !== undefined) payload.due_date = input.dueDateEnabled === false ? null : nullableDate(input.dueDate);
    if (input.dueDateEnabled !== undefined || input.dueTime !== undefined) payload.due_time = input.dueDateEnabled === false ? null : nullableTime(input.dueTime);

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('trello_cards').update(payload).eq('id', cardId);
      throwIfError(error, 'No se pudo actualizar la tarjeta');
    }

    if (input.labels !== undefined) await syncCardLabels(cardId, input.labels);
    if (input.members !== undefined) await syncCardMembers(cardId, card.board_id, input.members);
    if (input.checklists !== undefined) await syncCardChecklists(cardId, card.board_id, input.checklists);
    if (input.comments !== undefined) await syncCardComments(cardId, input.comments);
    if (input.activities !== undefined) await syncCardActivity(cardId, input.activities);

    return reloadListById(listId);
  },

  async updateBoard(boardId: string, input: UpdateBoardInput): Promise<Board | null> {
    const currentUserId = await getCurrentUserId();
    const payload: DbRow = {};
    if (input.title !== undefined) payload.name = input.title.trim();
    if (input.visibility !== undefined) payload.visibility = toDbBoardVisibility(input.visibility);
    const coverPayload = coverToDb(input.cover);
    if (coverPayload) Object.assign(payload, coverPayload);

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('trello_boards').update(payload).eq('id', boardId);
      throwIfError(error, 'No se pudo actualizar el tablero');
    }

    if (input.favorite !== undefined) {
      if (input.favorite) {
        const { error } = await supabase.from('trello_board_favorites').upsert({ board_id: boardId, user_id: currentUserId });
        throwIfError(error, 'No se pudo marcar favorito');
      } else {
        const { error } = await supabase.from('trello_board_favorites').delete().eq('board_id', boardId).eq('user_id', currentUserId);
        throwIfError(error, 'No se pudo quitar favorito');
      }
    }

    if (input.memberIds !== undefined) {
      const { error: deleteError } = await supabase.from('trello_board_members').delete().eq('board_id', boardId);
      throwIfError(deleteError, 'No se pudieron sincronizar miembros del tablero');
      if (input.memberIds.length > 0) {
        const rows = Array.from(new Set(input.memberIds)).map((userId) => ({ board_id: boardId, user_id: userId, role: userId === currentUserId ? 'owner' : 'member', created_by: currentUserId }));
        const { error } = await supabase.from('trello_board_members').insert(rows);
        throwIfError(error, 'No se pudieron guardar miembros del tablero');
      }
    }

    const boards = await this.getBoards();
    return boards.find((board) => board.id === boardId) ?? null;
  },

  async deleteBoard(boardId: string): Promise<void> {
    const { error } = await supabase.from('trello_boards').delete().eq('id', boardId);
    throwIfError(error, 'No se pudo eliminar el tablero');
  },

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase.from('trello_workspaces').delete().eq('id', workspaceId);
    throwIfError(error, 'No se pudo eliminar el espacio de trabajo');
    const expandedMap = readExpandedMap();
    delete expandedMap[workspaceId];
    writeExpandedMap(expandedMap);
  },

  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
    const payload: DbRow = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.visibility !== undefined) payload.visibility = toDbWorkspaceVisibility(input.visibility);
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('trello_workspaces').update(payload).eq('id', workspaceId);
      throwIfError(error, 'No se pudo actualizar el espacio');
    }
    if (input.expanded !== undefined) {
      const expandedMap = readExpandedMap();
      expandedMap[workspaceId] = input.expanded;
      writeExpandedMap(expandedMap);
    }
    const workspaces = await this.getWorkspaces();
    return workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  },

  async toggleWorkspaceExpanded(workspaceId: string): Promise<Workspace[]> {
    const expandedMap = readExpandedMap();
    expandedMap[workspaceId] = !expandedMap[workspaceId];
    writeExpandedMap(expandedMap);
    return this.getWorkspaces();
  },

  async getBoardMessages(boardId: string): Promise<ChatMessage[]> {
    const currentUserId = await getCurrentUserId();
    const [messagesResult, profiles] = await Promise.all([
      supabase
        .from('trello_board_messages')
        .select('*')
        .eq('board_id', boardId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      getAvailableProfiles(),
    ]);
    throwIfError(messagesResult.error, 'No se pudieron cargar mensajes del tablero');
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    return (messagesResult.data ?? []).map((row: any) => mapMessage(row, profileById, currentUserId));
  },

  async sendBoardMessage(boardId: string, message: string): Promise<ChatMessage> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('trello_board_messages')
      .insert({ board_id: boardId, user_id: userId, content: message.trim() })
      .select('*')
      .single();
    throwIfError(error, 'No se pudo enviar el mensaje');
    const profiles = await getAvailableProfiles();
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    return mapMessage(data as DbRow, profileById, userId);
  },

  subscribeToBoardMessages(boardId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`trello-board-messages-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trello_board_messages', filter: `board_id=eq.${boardId}` },
        () => onChange(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
