import type {
  Board,
  BoardLabelOption,
  BoardList,
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
import { boardLabelOptions, boardListsMock, boardsMock, workspaceMembersMock, workspacesMock } from '../../utils/trelloMockData';
import {
  createWorkspaceEntity,
  createBoardEntity,
  createBoardListEntity,
  createBoardTaskCardEntity,
  normalizeBoard,
  normalizeBoardList,
  normalizeWorkspace,
} from '../../utils/trelloUtils';

const BOARDS_STORAGE_KEY = 'trello-clone:boards';
const BOARD_LISTS_STORAGE_KEY = 'trello-clone:board-lists';
const WORKSPACES_STORAGE_KEY = 'trello-clone:workspaces';
const MEMBERS_STORAGE_KEY = 'trello-clone:members';
const LABELS_STORAGE_KEY = 'trello-clone:labels';

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const tableroController = {
  async getWorkspaces(): Promise<Workspace[]> {
    const workspaces = readFromStorage<Workspace[]>(WORKSPACES_STORAGE_KEY, workspacesMock).map(normalizeWorkspace);
    writeToStorage(WORKSPACES_STORAGE_KEY, workspaces);
    return workspaces;
  },

  async getBoards(): Promise<Board[]> {
    const boards = readFromStorage<Board[]>(BOARDS_STORAGE_KEY, boardsMock).map(normalizeBoard);
    writeToStorage(BOARDS_STORAGE_KEY, boards);
    return boards;
  },

  async getBoardLists(): Promise<BoardList[]> {
    const lists = readFromStorage<BoardList[]>(BOARD_LISTS_STORAGE_KEY, boardListsMock).map(normalizeBoardList);
    writeToStorage(BOARD_LISTS_STORAGE_KEY, lists);
    return lists;
  },

  async getWorkspaceMembers(): Promise<WorkspaceMember[]> {
    const members = readFromStorage<WorkspaceMember[]>(MEMBERS_STORAGE_KEY, workspaceMembersMock);
    writeToStorage(MEMBERS_STORAGE_KEY, members);
    return members;
  },

  async getBoardLabels(): Promise<BoardLabelOption[]> {
    const labels = readFromStorage<BoardLabelOption[]>(LABELS_STORAGE_KEY, boardLabelOptions).filter(
      (label) => label.id !== 'purple' && label.id !== 'blue' && label.name !== 'Diseño' && label.name !== 'Frontend',
    );
    writeToStorage(LABELS_STORAGE_KEY, labels);
    return labels;
  },

  async createBoardLabel(input: CreateBoardLabelInput): Promise<BoardLabelOption> {
    const labels = await this.getBoardLabels();
    const newLabel: BoardLabelOption = {
      id: `label-${crypto.randomUUID()}`,
      name: input.name.trim(),
      color: input.color,
    };
    writeToStorage(LABELS_STORAGE_KEY, [...labels, newLabel]);
    return newLabel;
  },

  async updateBoardLabel(labelId: string, input: UpdateBoardLabelInput): Promise<BoardLabelOption | null> {
    const labels = await this.getBoardLabels();
    const labelIndex = labels.findIndex((label) => label.id === labelId);
    if (labelIndex === -1) return null;

    const updatedLabel: BoardLabelOption = {
      ...labels[labelIndex],
      ...input,
      name: input.name !== undefined ? input.name.trim() : labels[labelIndex].name,
    };

    const nextLabels = [...labels];
    nextLabels[labelIndex] = updatedLabel;
    writeToStorage(LABELS_STORAGE_KEY, nextLabels);
    return updatedLabel;
  },

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const workspaces = await this.getWorkspaces();
    const newWorkspace = createWorkspaceEntity(input);
    const nextWorkspaces = workspaces.map((workspace) => ({ ...workspace, expanded: false }));
    writeToStorage(WORKSPACES_STORAGE_KEY, [...nextWorkspaces, newWorkspace]);
    return newWorkspace;
  },

  async createBoard(input: CreateBoardInput): Promise<Board> {
    const boards = await this.getBoards();
    const newBoard = createBoardEntity(input);
    writeToStorage(BOARDS_STORAGE_KEY, [newBoard, ...boards]);
    return newBoard;
  },

  async createBoardList(input: CreateBoardListInput): Promise<BoardList> {
    const lists = await this.getBoardLists();
    const newList = createBoardListEntity(input);
    writeToStorage(BOARD_LISTS_STORAGE_KEY, [...lists, newList]);
    return newList;
  },

  async createBoardTaskCard(input: CreateBoardTaskCardInput): Promise<BoardList | null> {
    const lists = await this.getBoardLists();
    const listIndex = lists.findIndex((list) => list.id === input.listId);

    if (listIndex === -1) return null;

    const now = new Date().toISOString();
    const newCard = createBoardTaskCardEntity(input);
    const updatedList: BoardList = {
      ...lists[listIndex],
      cards: [...lists[listIndex].cards, newCard],
      updatedAt: now,
    };

    const nextLists = [...lists];
    nextLists[listIndex] = updatedList;
    writeToStorage(BOARD_LISTS_STORAGE_KEY, nextLists);

    return updatedList;
  },


  async moveBoardTaskCard(input: MoveBoardTaskCardInput): Promise<BoardList[]> {
    const lists = await this.getBoardLists();
    const sourceListIndex = lists.findIndex((list) => list.id === input.fromListId);
    const targetListIndex = lists.findIndex((list) => list.id === input.toListId);

    if (sourceListIndex === -1 || targetListIndex === -1) return lists;

    const sourceCards = [...lists[sourceListIndex].cards];
    const sourceCardIndex = sourceCards.findIndex((card) => card.id === input.cardId);
    if (sourceCardIndex === -1) return lists;

    const [movedCard] = sourceCards.splice(sourceCardIndex, 1);
    const now = new Date().toISOString();
    const cardToInsert = { ...movedCard, updatedAt: now };

    const nextLists = [...lists];

    if (input.fromListId === input.toListId) {
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, sourceCards.length));
      sourceCards.splice(safeTargetIndex, 0, cardToInsert);
      nextLists[sourceListIndex] = {
        ...lists[sourceListIndex],
        cards: sourceCards,
        updatedAt: now,
      };
    } else {
      const targetCards = [...lists[targetListIndex].cards];
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, targetCards.length));
      targetCards.splice(safeTargetIndex, 0, cardToInsert);
      nextLists[sourceListIndex] = {
        ...lists[sourceListIndex],
        cards: sourceCards,
        updatedAt: now,
      };
      nextLists[targetListIndex] = {
        ...lists[targetListIndex],
        cards: targetCards,
        updatedAt: now,
      };
    }

    writeToStorage(BOARD_LISTS_STORAGE_KEY, nextLists);
    return nextLists;
  },

  async reorderBoardList(input: ReorderBoardListInput): Promise<BoardList[]> {
    const lists = await this.getBoardLists();
    const boardLists = lists.filter((list) => list.boardId === input.boardId);
    const otherLists = lists.filter((list) => list.boardId !== input.boardId);
    const sourceIndex = boardLists.findIndex((list) => list.id === input.listId);

    if (sourceIndex === -1) return lists;

    const [movedList] = boardLists.splice(sourceIndex, 1);
    const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, boardLists.length));
    boardLists.splice(safeTargetIndex, 0, { ...movedList, updatedAt: new Date().toISOString() });

    const nextLists = [...otherLists, ...boardLists];
    writeToStorage(BOARD_LISTS_STORAGE_KEY, nextLists);
    return nextLists;
  },


  async updateBoardList(listId: string, input: UpdateBoardListInput): Promise<BoardList | null> {
    const lists = await this.getBoardLists();
    const listIndex = lists.findIndex((list) => list.id === listId);

    if (listIndex === -1) return null;

    const updatedList: BoardList = {
      ...lists[listIndex],
      ...input,
      title: input.title !== undefined ? input.title.trim() : lists[listIndex].title,
      updatedAt: new Date().toISOString(),
    };

    const nextLists = [...lists];
    nextLists[listIndex] = updatedList;
    writeToStorage(BOARD_LISTS_STORAGE_KEY, nextLists);

    return updatedList;
  },

  async deleteBoardList(listId: string): Promise<void> {
    const lists = await this.getBoardLists();
    writeToStorage(
      BOARD_LISTS_STORAGE_KEY,
      lists.filter((list) => list.id !== listId),
    );
  },

  async inviteWorkspaceMember(workspaceId: string, sourceMemberId: string): Promise<WorkspaceMember | null> {
    const members = await this.getWorkspaceMembers();
    const sourceMember = members.find((member) => member.id === sourceMemberId);
    if (!sourceMember) return null;

    const existingMember = members.find(
      (member) => member.workspaceId === workspaceId && member.username === sourceMember.username,
    );
    if (existingMember) return existingMember;

    const newMember: WorkspaceMember = {
      ...sourceMember,
      id: `member-${sourceMember.username}-${workspaceId}`,
      workspaceId,
      boardCount: 0,
      role: 'Miembro',
      status: 'member',
      isCurrentUser: Boolean(sourceMember.isCurrentUser),
    };

    writeToStorage(MEMBERS_STORAGE_KEY, [...members, newMember]);
    return newMember;
  },

  async removeWorkspaceMember(memberId: string): Promise<void> {
    const members = await this.getWorkspaceMembers();
    writeToStorage(
      MEMBERS_STORAGE_KEY,
      members.filter((member) => member.id !== memberId),
    );
  },

  async updateBoardTaskCard(listId: string, cardId: string, input: UpdateBoardTaskCardInput): Promise<BoardList | null> {
    const lists = await this.getBoardLists();
    const listIndex = lists.findIndex((list) => list.id === listId);

    if (listIndex === -1) return null;

    const cardIndex = lists[listIndex].cards.findIndex((card) => card.id === cardId);
    if (cardIndex === -1) return null;

    const now = new Date().toISOString();
    const updatedCard = {
      ...lists[listIndex].cards[cardIndex],
      ...input,
      updatedAt: now,
    };

    const updatedCards = [...lists[listIndex].cards];
    updatedCards[cardIndex] = updatedCard;

    const updatedList: BoardList = {
      ...lists[listIndex],
      cards: updatedCards,
      updatedAt: now,
    };

    const nextLists = [...lists];
    nextLists[listIndex] = updatedList;
    writeToStorage(BOARD_LISTS_STORAGE_KEY, nextLists);

    return updatedList;
  },

  async updateBoard(boardId: string, input: UpdateBoardInput): Promise<Board | null> {
    const boards = await this.getBoards();
    const boardIndex = boards.findIndex((board) => board.id === boardId);

    if (boardIndex === -1) return null;

    const updatedBoard: Board = {
      ...boards[boardIndex],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const nextBoards = [...boards];
    nextBoards[boardIndex] = updatedBoard;
    writeToStorage(BOARDS_STORAGE_KEY, nextBoards);

    return updatedBoard;
  },

  async deleteBoard(boardId: string): Promise<void> {
    const boards = await this.getBoards();
    const lists = await this.getBoardLists();

    writeToStorage(
      BOARDS_STORAGE_KEY,
      boards.filter((board) => board.id !== boardId),
    );

    writeToStorage(
      BOARD_LISTS_STORAGE_KEY,
      lists.filter((list) => list.boardId !== boardId),
    );
  },

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const [workspaces, boards, lists, members] = await Promise.all([
      this.getWorkspaces(),
      this.getBoards(),
      this.getBoardLists(),
      this.getWorkspaceMembers(),
    ]);
    const boardIds = boards.filter((board) => board.workspaceId === workspaceId).map((board) => board.id);

    writeToStorage(
      WORKSPACES_STORAGE_KEY,
      workspaces.filter((workspace) => workspace.id !== workspaceId),
    );
    writeToStorage(
      BOARDS_STORAGE_KEY,
      boards.filter((board) => board.workspaceId !== workspaceId),
    );
    writeToStorage(
      BOARD_LISTS_STORAGE_KEY,
      lists.filter((list) => !boardIds.includes(list.boardId)),
    );
    writeToStorage(
      MEMBERS_STORAGE_KEY,
      members.filter((member) => member.workspaceId !== workspaceId),
    );
  },

  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
    const workspaces = await this.getWorkspaces();
    const workspaceIndex = workspaces.findIndex((workspace) => workspace.id === workspaceId);

    if (workspaceIndex === -1) return null;

    const updatedWorkspace: Workspace = {
      ...workspaces[workspaceIndex],
      ...input,
    };

    const nextWorkspaces = [...workspaces];
    nextWorkspaces[workspaceIndex] = updatedWorkspace;
    writeToStorage(WORKSPACES_STORAGE_KEY, nextWorkspaces);

    return updatedWorkspace;
  },

  async toggleWorkspaceExpanded(workspaceId: string): Promise<Workspace[]> {
    const workspaces = await this.getWorkspaces();
    const nextWorkspaces = workspaces.map((workspace) =>
      workspace.id === workspaceId ? { ...workspace, expanded: !workspace.expanded } : workspace,
    );

    writeToStorage(WORKSPACES_STORAGE_KEY, nextWorkspaces);
    return nextWorkspaces;
  },
};
