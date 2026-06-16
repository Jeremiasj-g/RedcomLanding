import { tableroController } from '../controllers/tablero.controller';
import type {
  Board,
  BoardLabelOption,
  BoardList,
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

export const tableroFacade = {
  getWorkspaces(): Promise<Workspace[]> {
    return tableroController.getWorkspaces();
  },

  getBoards(): Promise<Board[]> {
    return tableroController.getBoards();
  },

  getBoardLists(): Promise<BoardList[]> {
    return tableroController.getBoardLists();
  },

  getWorkspaceMembers(): Promise<WorkspaceMember[]> {
    return tableroController.getWorkspaceMembers();
  },

  getBoardLabels(): Promise<BoardLabelOption[]> {
    return tableroController.getBoardLabels();
  },

  createBoardLabel(input: CreateBoardLabelInput): Promise<BoardLabelOption> {
    return tableroController.createBoardLabel(input);
  },

  updateBoardLabel(labelId: string, input: UpdateBoardLabelInput): Promise<BoardLabelOption | null> {
    return tableroController.updateBoardLabel(labelId, input);
  },

  deleteBoardLabel(labelId: string): Promise<void> {
    return tableroController.deleteBoardLabel(labelId);
  },

  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    return tableroController.createWorkspace(input);
  },

  createBoard(input: CreateBoardInput): Promise<Board> {
    return tableroController.createBoard(input);
  },

  createBoardList(input: CreateBoardListInput): Promise<BoardList> {
    return tableroController.createBoardList(input);
  },

  createBoardTaskCard(input: CreateBoardTaskCardInput): Promise<BoardList | null> {
    return tableroController.createBoardTaskCard(input);
  },


  moveBoardTaskCard(input: MoveBoardTaskCardInput): Promise<BoardList[]> {
    return tableroController.moveBoardTaskCard(input);
  },

  reorderBoardList(input: ReorderBoardListInput): Promise<BoardList[]> {
    return tableroController.reorderBoardList(input);
  },

  updateBoardList(listId: string, input: UpdateBoardListInput): Promise<BoardList | null> {
    return tableroController.updateBoardList(listId, input);
  },

  deleteBoardList(listId: string): Promise<void> {
    return tableroController.deleteBoardList(listId);
  },

  inviteWorkspaceMember(workspaceId: string, sourceMemberId: string): Promise<WorkspaceMember | null> {
    return tableroController.inviteWorkspaceMember(workspaceId, sourceMemberId);
  },

  removeWorkspaceMember(memberId: string, workspaceId?: string): Promise<void> {
    return tableroController.removeWorkspaceMember(memberId, workspaceId);
  },

  updateBoardTaskCard(listId: string, cardId: string, input: UpdateBoardTaskCardInput): Promise<BoardList | null> {
    return tableroController.updateBoardTaskCard(listId, cardId, input);
  },

  updateBoard(boardId: string, input: UpdateBoardInput): Promise<Board | null> {
    return tableroController.updateBoard(boardId, input);
  },

  updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
    return tableroController.updateWorkspace(workspaceId, input);
  },

  deleteBoard(boardId: string): Promise<void> {
    return tableroController.deleteBoard(boardId);
  },

  deleteWorkspace(workspaceId: string): Promise<void> {
    return tableroController.deleteWorkspace(workspaceId);
  },

  toggleWorkspaceExpanded(workspaceId: string): Promise<Workspace[]> {
    return tableroController.toggleWorkspaceExpanded(workspaceId);
  },


  getBoardMessages(boardId: string): Promise<ChatMessage[]> {
    return tableroController.getBoardMessages(boardId);
  },

  sendBoardMessage(boardId: string, message: string): Promise<ChatMessage> {
    return tableroController.sendBoardMessage(boardId, message);
  },

  subscribeToBoardMessages(boardId: string, onChange: () => void): () => void {
    return tableroController.subscribeToBoardMessages(boardId, onChange);
  },
};
