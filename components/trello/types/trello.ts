export type WorkspaceVisibility = 'privado' | 'publico';
export type BoardVisibility = 'privado' | 'publico';
export type AppView = 'boards' | 'members' | 'settings' | 'board';
export type BoardPanel = 'board' | 'inbox';
export type WorkspaceMemberRole = 'Administrador' | 'Miembro' | 'Observador';
export type PermissionScope = 'workspace' | 'board';
export type WorkspaceMemberStatus = 'member' | 'single-board-guest' | 'multi-board-guest' | 'join-request';

export interface Workspace {
  id: string;
  name: string;
  avatar: string;
  color: 'orange' | 'pink' | 'red' | 'blue' | 'green' | 'purple';
  visibility: WorkspaceVisibility;
  expanded: boolean;
}

export interface CreateWorkspaceInput {
  name: string;
  visibility: WorkspaceVisibility;
}

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  cover: BoardCover;
  visibility: BoardVisibility;
  favorite: boolean;
  memberIds?: string[];
  memberRoles?: Record<string, WorkspaceMemberRole>;
  createdAt: string;
  updatedAt: string;
  position?: number;
}

export type BoardCover =
  | { type: 'image'; value: string }
  | { type: 'gradient'; value: string }
  | { type: 'solid'; value: string };

export interface CreateBoardInput {
  title: string;
  workspaceId: string;
  cover: BoardCover;
  visibility: BoardVisibility;
  position?: number;
}

export interface UpdateBoardInput {
  title?: string;
  workspaceId?: string;
  cover?: BoardCover;
  visibility?: BoardVisibility;
  favorite?: boolean;
  memberIds?: string[];
}

export interface UpdateWorkspaceInput {
  name?: string;
  visibility?: WorkspaceVisibility;
  expanded?: boolean;
}

export interface BoardFilters {
  search: string;
  workspaceId?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  fullName: string;
  username: string;
  avatarText: string;
  avatarColor: 'orange' | 'red' | 'blue' | 'green' | 'purple' | 'yellow' | 'teal' | 'pink';
  boardCount: number;
  role: WorkspaceMemberRole;
  lastActivity: string;
  status: WorkspaceMemberStatus;
  isCurrentUser?: boolean;
}

export interface MemberFilters {
  search: string;
  workspaceId?: string;
  status?: WorkspaceMemberStatus;
}

export interface BoardList {
  id: string;
  boardId: string;
  title: string;
  cards: BoardTaskCard[];
  createdAt?: string;
  updatedAt?: string;
  position?: number;
}

export interface CreateBoardListInput {
  boardId: string;
  title: string;
  position?: number;
}

export interface UpdateBoardListInput {
  title?: string;
  cards?: BoardTaskCard[];
}

export interface MoveBoardTaskCardInput {
  cardId: string;
  fromListId: string;
  toListId: string;
  targetIndex: number;
  position?: number;
}

export interface ReorderBoardListInput {
  boardId: string;
  listId: string;
  targetIndex: number;
  position?: number;
}

export interface BoardTaskComment {
  id: string;
  authorName: string;
  avatarText: string;
  message: string;
  createdAt: string;
  isCurrentUser?: boolean;
}

export interface BoardTaskActivity {
  id: string;
  actorName: string;
  avatarText: string;
  message: string;
  createdAt: string;
}

export interface BoardTaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
  dueTime?: string;
  dueDateEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardTaskChecklist {
  id: string;
  title: string;
  items: BoardTaskChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardLabelOption {
  id: string;
  name: string;
  color: string;
  boardId?: string;
}

export interface CreateBoardLabelInput {
  name: string;
  color: string;
  boardId?: string;
}

export interface UpdateBoardLabelInput {
  name?: string;
  color?: string;
}

export interface DeleteBoardLabelInput {
  labelId: string;
}

export interface BoardTaskCard {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
  labels?: string[];
  members?: string[];
  startDate?: string;
  dueDate?: string;
  dueTime?: string;
  dueDateEnabled?: boolean;
  startDateEnabled?: boolean;
  periodicity?: string;
  comments?: BoardTaskComment[];
  activities?: BoardTaskActivity[];
  checklists?: BoardTaskChecklist[];
  createdAt?: string;
  updatedAt?: string;
  position?: number;
}

export interface CreateBoardTaskCardInput {
  listId: string;
  title: string;
  position?: number;
}

export interface UpdateBoardTaskCardInput {
  title?: string;
  description?: string;
  completed?: boolean;
  labels?: string[];
  members?: string[];
  startDate?: string;
  dueDate?: string;
  dueTime?: string;
  dueDateEnabled?: boolean;
  startDateEnabled?: boolean;
  periodicity?: string;
  comments?: BoardTaskComment[];
  activities?: BoardTaskActivity[];
  checklists?: BoardTaskChecklist[];
}

export interface ChatMessage {
  id: string;
  boardId: string;
  senderName: string;
  avatarText: string;
  message: string;
  sentAt: string;
  isCurrentUser?: boolean;
}

export interface TrelloBoardSnapshot {
  boardId: string;
  workspaceId?: string;
  board?: Board;
  lists: BoardList[];
  labels: BoardLabelOption[];
  members: WorkspaceMember[];
  messages: ChatMessage[];
  version: number;
  sourceClientId?: string;
  updatedAt: string;
}

export type TrelloBoardSnapshotPatch = Partial<Pick<TrelloBoardSnapshot, 'board' | 'lists' | 'labels' | 'members' | 'messages' | 'workspaceId'>> & {
  boardId: string;
  version?: number;
  updatedAt?: string;
};
