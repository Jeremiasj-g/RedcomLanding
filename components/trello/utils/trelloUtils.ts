import type {
  Board,
  BoardFilters,
  BoardList,
  BoardTaskCard,
  BoardTaskChecklist,
  BoardVisibility,
  CreateWorkspaceInput,
  CreateBoardInput,
  CreateBoardListInput,
  CreateBoardTaskCardInput,
  MemberFilters,
  Workspace,
  WorkspaceMember,
  WorkspaceVisibility,
} from '../types/trello';

export const MAX_FREE_BOARDS = 5;

export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function filterBoards(boards: Board[], filters: BoardFilters): Board[] {
  const search = normalizeText(filters.search);

  return boards.filter((board) => {
    const matchesWorkspace = filters.workspaceId ? board.workspaceId === filters.workspaceId : true;
    const matchesSearch = search ? normalizeText(board.title).includes(search) : true;
    return matchesWorkspace && matchesSearch;
  });
}

export function filterMembers(members: WorkspaceMember[], filters: MemberFilters): WorkspaceMember[] {
  const search = normalizeText(filters.search);

  return members.filter((member) => {
    const matchesWorkspace = filters.workspaceId ? member.workspaceId === filters.workspaceId : true;
    const matchesStatus = filters.status ? member.status === filters.status : true;
    const matchesSearch = search ? normalizeText(`${member.fullName} ${member.username}`).includes(search) : true;

    return matchesWorkspace && matchesStatus && matchesSearch;
  });
}

export function getRemainingBoards(currentBoardsCount: number): number {
  return Math.max(MAX_FREE_BOARDS - currentBoardsCount, 0);
}

export function createWorkspaceEntity(input: CreateWorkspaceInput): Workspace {
  const cleanName = input.name.trim();
  const avatar = (cleanName.charAt(0) || 'E').toUpperCase();
  const workspaceColors: Workspace['color'][] = ['orange', 'pink', 'red', 'blue', 'green', 'purple'];
  const color = workspaceColors[Math.floor(Math.random() * workspaceColors.length)] ?? 'blue';

  return {
    id: `ws-${crypto.randomUUID()}`,
    name: cleanName,
    avatar,
    color,
    visibility: input.visibility,
    expanded: true,
  };
}

export function createBoardEntity(input: CreateBoardInput): Board {
  const now = new Date().toISOString();

  return {
    id: `board-${crypto.randomUUID()}`,
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    cover: input.cover,
    visibility: input.visibility,
    favorite: false,
    memberIds: ['member-jeremias'],
    createdAt: now,
    updatedAt: now,
  };
}

export function createBoardListEntity(input: CreateBoardListInput): BoardList {
  const now = new Date().toISOString();

  return {
    id: `list-${crypto.randomUUID()}`,
    boardId: input.boardId,
    title: input.title.trim(),
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createBoardTaskCardEntity(input: CreateBoardTaskCardInput): BoardTaskCard {
  const now = new Date().toISOString();

  return {
    id: `card-${crypto.randomUUID()}`,
    title: input.title.trim(),
    completed: false,
    labels: [],
    members: [],
    startDate: '',
    dueDate: '',
    dueTime: '09:59',
    dueDateEnabled: false,
    startDateEnabled: false,
    periodicity: 'Nunca',
    comments: [],
    checklists: [],
    activities: [
      {
        id: `activity-${crypto.randomUUID()}`,
        actorName: 'Jeremias Goytia',
        avatarText: 'JG',
        message: 'ha añadido esta tarjeta al tablero',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeBoard(board: Board): Board {
  return {
    ...board,
    visibility: (board.visibility ?? 'privado') as BoardVisibility,
    favorite: Boolean(board.favorite),
    memberIds: board.memberIds && board.memberIds.length > 0 ? board.memberIds : ['member-jeremias'],
  };
}

export function normalizeChecklist(checklist: BoardTaskChecklist): BoardTaskChecklist {
  return {
    ...checklist,
    items: (checklist.items ?? []).map((item) => ({
      ...item,
      completed: Boolean(item.completed),
      dueTime: item.dueTime ?? '09:59',
      dueDateEnabled: item.dueDateEnabled ?? Boolean(item.dueDate),
    })),
  };
}

export function normalizeBoardTaskCard(card: BoardTaskCard): BoardTaskCard {
  return {
    ...card,
    completed: Boolean(card.completed),
    labels: card.labels ?? [],
    members: card.members ?? [],
    comments: card.comments ?? [],
    activities: card.activities ?? [],
    checklists: (card.checklists ?? []).map(normalizeChecklist),
    startDate: card.startDate ?? '',
    dueDate: card.dueDate ?? '',
    dueTime: card.dueTime ?? '09:59',
    startDateEnabled: Boolean(card.startDateEnabled),
    dueDateEnabled: Boolean(card.dueDateEnabled),
    periodicity: card.periodicity ?? 'Nunca',
  };
}

export function normalizeBoardList(list: BoardList): BoardList {
  return {
    ...list,
    cards: (list.cards ?? []).map(normalizeBoardTaskCard),
  };
}

export function normalizeWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    visibility: (workspace.visibility ?? 'privado') as WorkspaceVisibility,
  };
}

export function getVisibilityLabel(visibility: BoardVisibility | WorkspaceVisibility): string {
  return visibility === 'publico' ? 'Público' : 'Privado';
}

export function getVisibilityDescription(visibility: BoardVisibility | WorkspaceVisibility): string {
  return visibility === 'publico'
    ? 'Cualquier miembro del espacio puede encontrarlo y unirse.'
    : 'Solo las personas invitadas pueden verlo y acceder.';
}
