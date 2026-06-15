export type WorkspaceVisibility = 'privado' | 'publico';
export type BoardVisibility = 'privado' | 'publico';
export type AppView = 'boards' | 'members' | 'settings' | 'board';
export type BoardPanel = 'board' | 'inbox';
export type WorkspaceMemberRole = 'Administrador' | 'Miembro' | 'Observador';
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
  createdAt: string;
  updatedAt: string;
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
  avatarColor: 'orange' | 'red' | 'blue' | 'green' | 'purple';
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
}

export interface CreateBoardListInput {
  boardId: string;
  title: string;
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
}

export interface ReorderBoardListInput {
  boardId: string;
  listId: string;
  targetIndex: number;
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
}

export interface CreateBoardLabelInput {
  name: string;
  color: string;
}

export interface UpdateBoardLabelInput {
  name?: string;
  color?: string;
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
}

export interface CreateBoardTaskCardInput {
  listId: string;
  title: string;
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
