import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { tableroFacade } from '../lib/facades/tablero.facade';
import type {
  AppView,
  Board,
  BoardCover,
  BoardLabelOption,
  BoardList,
  BoardVisibility,
  CreateWorkspaceInput,
  CreateBoardInput,
  CreateBoardLabelInput,
  CreateBoardListInput,
  CreateBoardTaskCardInput,
  MoveBoardTaskCardInput,
  ReorderBoardListInput,
  UpdateBoardListInput,
  Workspace,
  WorkspaceMember,
  WorkspaceMemberStatus,
  WorkspaceVisibility,
  UpdateBoardInput,
  UpdateBoardTaskCardInput,
  UpdateBoardLabelInput,
} from '../types/trello';
import { boardCovers } from '../utils/trelloMockData';
import { filterBoards, filterMembers } from '../utils/trelloUtils';

interface BoardContextValue {
  activeView: AppView;
  boards: Board[];
  boardLists: BoardList[];
  boardLabels: BoardLabelOption[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  selectedWorkspaceId: string;
  selectedBoardId?: string;
  search: string;
  memberSearch: string;
  memberStatusFilter?: WorkspaceMemberStatus;
  loading: boolean;
  selectedCover: BoardCover;
  filteredBoards: Board[];
  filteredMembers: WorkspaceMember[];
  currentWorkspace?: Workspace;
  selectedBoard?: Board;
  workspaceBoards: Board[];
  selectedBoardLists: BoardList[];
  setActiveView: (view: AppView) => void;
  setSearch: (search: string) => void;
  setMemberSearch: (search: string) => void;
  setMemberStatusFilter: (status?: WorkspaceMemberStatus) => void;
  setSelectedWorkspaceId: (workspaceId: string) => void;
  setSelectedCover: (cover: BoardCover) => void;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  createBoard: (input: Omit<CreateBoardInput, 'cover'> & { cover?: BoardCover }) => Promise<Board>;
  createBoardLabel: (input: CreateBoardLabelInput) => Promise<BoardLabelOption>;
  updateBoardLabel: (labelId: string, input: UpdateBoardLabelInput) => Promise<BoardLabelOption | null>;
  openBoard: (boardId: string) => void;
  deleteBoard: (boardId: string) => Promise<void>;
  updateBoard: (boardId: string, input: UpdateBoardInput) => Promise<Board | null>;
  updateBoardVisibility: (boardId: string, visibility: BoardVisibility) => Promise<void>;
  updateWorkspaceVisibility: (workspaceId: string, visibility: WorkspaceVisibility) => Promise<void>;
  createBoardList: (input: CreateBoardListInput) => Promise<BoardList>;
  updateBoardList: (listId: string, input: UpdateBoardListInput) => Promise<BoardList | null>;
  deleteBoardList: (listId: string) => Promise<void>;
  sortBoardListCards: (listId: string, sortBy: 'name' | 'newest' | 'oldest') => Promise<BoardList | null>;
  moveBoardTaskCard: (input: MoveBoardTaskCardInput) => Promise<void>;
  reorderBoardList: (input: ReorderBoardListInput) => Promise<void>;
  inviteWorkspaceMember: (workspaceId: string, sourceMemberId: string) => Promise<WorkspaceMember | null>;
  removeWorkspaceMember: (memberId: string) => Promise<void>;
  createBoardTaskCard: (input: CreateBoardTaskCardInput) => Promise<BoardList | null>;
  updateTaskCard: (listId: string, cardId: string, input: UpdateBoardTaskCardInput) => Promise<BoardList | null>;
  toggleTaskCardCompleted: (listId: string, cardId: string, completed: boolean) => Promise<void>;
  toggleWorkspaceExpanded: (workspaceId: string) => Promise<void>;
}

const BoardContext = createContext<BoardContextValue | undefined>(undefined);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<AppView>('boards');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardLists, setBoardLists] = useState<BoardList[]>([]);
  const [boardLabels, setBoardLabels] = useState<BoardLabelOption[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('ws-facultad');
  const [selectedBoardId, setSelectedBoardId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<WorkspaceMemberStatus | undefined>('member');
  const [loading, setLoading] = useState(true);
  const [selectedCover, setSelectedCover] = useState<BoardCover>(boardCovers[3]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const [workspacesResponse, boardsResponse, boardListsResponse, membersResponse, labelsResponse] = await Promise.all([
      tableroFacade.getWorkspaces(),
      tableroFacade.getBoards(),
      tableroFacade.getBoardLists(),
      tableroFacade.getWorkspaceMembers(),
      tableroFacade.getBoardLabels(),
    ]);

    setWorkspaces(workspacesResponse);
    setBoards(boardsResponse);
    setBoardLists(boardListsResponse);
    setMembers(membersResponse);
    setBoardLabels(labelsResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces],
  );

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId),
    [boards, selectedBoardId],
  );

  const workspaceBoards = useMemo(
    () => boards.filter((board) => board.workspaceId === selectedWorkspaceId),
    [boards, selectedWorkspaceId],
  );

  const selectedBoardLists = useMemo(
    () => (selectedBoardId ? boardLists.filter((list) => list.boardId === selectedBoardId) : []),
    [boardLists, selectedBoardId],
  );

  const filteredBoards = useMemo(
    () => filterBoards(boards, { search, workspaceId: selectedWorkspaceId }),
    [boards, search, selectedWorkspaceId],
  );

  const filteredMembers = useMemo(
    () =>
      filterMembers(members, {
        search: memberSearch,
        workspaceId: selectedWorkspaceId,
        status: memberStatusFilter,
      }),
    [memberSearch, memberStatusFilter, members, selectedWorkspaceId],
  );

  const createWorkspace = useCallback(async (input: CreateWorkspaceInput) => {
    const newWorkspace = await tableroFacade.createWorkspace(input);
    setWorkspaces((currentWorkspaces) => [
      ...currentWorkspaces.map((workspace) => ({ ...workspace, expanded: false })),
      newWorkspace,
    ]);
    setSelectedWorkspaceId(newWorkspace.id);
    setActiveView('boards');
    return newWorkspace;
  }, []);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    await tableroFacade.deleteWorkspace(workspaceId);

    setWorkspaces((currentWorkspaces) => {
      const nextWorkspaces = currentWorkspaces.filter((workspace) => workspace.id !== workspaceId);
      if (selectedWorkspaceId === workspaceId) {
        setSelectedWorkspaceId(nextWorkspaces[0]?.id ?? '');
        setSelectedBoardId(undefined);
        setActiveView('boards');
      }
      return nextWorkspaces;
    });
    setBoards((currentBoards) => currentBoards.filter((board) => board.workspaceId !== workspaceId));
    setBoardLists((currentLists) => {
      const boardIdsToDelete = boards.filter((board) => board.workspaceId === workspaceId).map((board) => board.id);
      return currentLists.filter((list) => !boardIdsToDelete.includes(list.boardId));
    });
    setMembers((currentMembers) => currentMembers.filter((member) => member.workspaceId !== workspaceId));
  }, [boards, selectedWorkspaceId]);

  const createBoardLabel = useCallback(async (input: CreateBoardLabelInput) => {
    const newLabel = await tableroFacade.createBoardLabel(input);
    setBoardLabels((currentLabels) => [...currentLabels, newLabel]);
    return newLabel;
  }, []);

  const updateBoardLabel = useCallback(async (labelId: string, input: UpdateBoardLabelInput) => {
    const updatedLabel = await tableroFacade.updateBoardLabel(labelId, input);
    if (!updatedLabel) return null;

    setBoardLabels((currentLabels) =>
      currentLabels.map((label) => (label.id === labelId ? updatedLabel : label)),
    );
    return updatedLabel;
  }, []);

  const createBoard = useCallback(
    async (input: Omit<CreateBoardInput, 'cover'> & { cover?: BoardCover }) => {
      const newBoard = await tableroFacade.createBoard({
        ...input,
        cover: input.cover ?? selectedCover,
      });
      setBoards((currentBoards) => [newBoard, ...currentBoards]);
      return newBoard;
    },
    [selectedCover],
  );

  const createBoardList = useCallback(async (input: CreateBoardListInput) => {
    const newList = await tableroFacade.createBoardList(input);
    setBoardLists((currentLists) => [...currentLists, newList]);
    return newList;
  }, []);

  const updateBoardList = useCallback(async (listId: string, input: UpdateBoardListInput) => {
    const updatedList = await tableroFacade.updateBoardList(listId, input);
    if (!updatedList) return null;

    setBoardLists((currentLists) => currentLists.map((list) => (list.id === listId ? updatedList : list)));
    return updatedList;
  }, []);

  const deleteBoardList = useCallback(async (listId: string) => {
    await tableroFacade.deleteBoardList(listId);
    setBoardLists((currentLists) => currentLists.filter((list) => list.id !== listId));
  }, []);

  const moveBoardTaskCard = useCallback(async (input: MoveBoardTaskCardInput) => {
    const updatedLists = await tableroFacade.moveBoardTaskCard(input);
    setBoardLists(updatedLists);
  }, []);

  const reorderBoardList = useCallback(async (input: ReorderBoardListInput) => {
    const updatedLists = await tableroFacade.reorderBoardList(input);
    setBoardLists(updatedLists);
  }, []);

  const sortBoardListCards = useCallback(async (listId: string, sortBy: 'name' | 'newest' | 'oldest') => {
    const targetList = boardLists.find((list) => list.id === listId);
    if (!targetList) return null;

    const sortedCards = [...targetList.cards].sort((left, right) => {
      if (sortBy === 'name') return left.title.localeCompare(right.title, 'es');

      const leftDate = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
      const rightDate = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();
      return sortBy === 'newest' ? rightDate - leftDate : leftDate - rightDate;
    });

    return updateBoardList(listId, { cards: sortedCards });
  }, [boardLists, updateBoardList]);

  const inviteWorkspaceMember = useCallback(async (workspaceId: string, sourceMemberId: string) => {
    const invitedMember = await tableroFacade.inviteWorkspaceMember(workspaceId, sourceMemberId);
    if (!invitedMember) return null;

    setMembers((currentMembers) => {
      const exists = currentMembers.some((member) => member.id === invitedMember.id);
      return exists
        ? currentMembers.map((member) => (member.id === invitedMember.id ? invitedMember : member))
        : [...currentMembers, invitedMember];
    });
    return invitedMember;
  }, []);

  const removeWorkspaceMember = useCallback(async (memberId: string) => {
    await tableroFacade.removeWorkspaceMember(memberId);
    setMembers((currentMembers) => currentMembers.filter((member) => member.id !== memberId));
  }, []);

  const createBoardTaskCard = useCallback(async (input: CreateBoardTaskCardInput) => {
    const updatedList = await tableroFacade.createBoardTaskCard(input);
    if (!updatedList) return null;

    setBoardLists((currentLists) => currentLists.map((list) => (list.id === updatedList.id ? updatedList : list)));
    return updatedList;
  }, []);

  const updateTaskCard = useCallback(async (listId: string, cardId: string, input: UpdateBoardTaskCardInput) => {
    const updatedList = await tableroFacade.updateBoardTaskCard(listId, cardId, input);
    if (!updatedList) return null;

    setBoardLists((currentLists) => currentLists.map((list) => (list.id === updatedList.id ? updatedList : list)));
    return updatedList;
  }, []);

  const toggleTaskCardCompleted = useCallback(async (listId: string, cardId: string, completed: boolean) => {
    await updateTaskCard(listId, cardId, { completed });
  }, [updateTaskCard]);

  const openBoard = useCallback(
    (boardId: string) => {
      const board = boards.find((currentBoard) => currentBoard.id === boardId);
      if (board) {
        setSelectedWorkspaceId(board.workspaceId);
      }
      setSelectedBoardId(boardId);
      setActiveView('board');
    },
    [boards],
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      await tableroFacade.deleteBoard(boardId);
      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== boardId));
      setBoardLists((currentLists) => currentLists.filter((list) => list.boardId !== boardId));
      if (selectedBoardId === boardId) {
        setSelectedBoardId(undefined);
        setActiveView('boards');
      }
    },
    [selectedBoardId],
  );


  const updateBoard = useCallback(async (boardId: string, input: UpdateBoardInput) => {
    const updatedBoard = await tableroFacade.updateBoard(boardId, input);
    if (!updatedBoard) return null;

    setBoards((currentBoards) =>
      currentBoards.map((board) => (board.id === boardId ? updatedBoard : board)),
    );
    return updatedBoard;
  }, []);

  const updateBoardVisibility = useCallback(async (boardId: string, visibility: BoardVisibility) => {
    await updateBoard(boardId, { visibility });
  }, [updateBoard]);

  const updateWorkspaceVisibility = useCallback(async (workspaceId: string, visibility: WorkspaceVisibility) => {
    const updatedWorkspace = await tableroFacade.updateWorkspace(workspaceId, { visibility });
    if (!updatedWorkspace) return;

    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) => (workspace.id === workspaceId ? updatedWorkspace : workspace)),
    );
  }, []);

  const toggleWorkspaceExpanded = useCallback(async (workspaceId: string) => {
    const updatedWorkspaces = await tableroFacade.toggleWorkspaceExpanded(workspaceId);
    setWorkspaces(updatedWorkspaces);
  }, []);

  const value = useMemo(
    () => ({
      activeView,
      boards,
      boardLists,
      boardLabels,
      workspaces,
      members,
      selectedWorkspaceId,
      selectedBoardId,
      search,
      memberSearch,
      memberStatusFilter,
      loading,
      selectedCover,
      filteredBoards,
      filteredMembers,
      currentWorkspace,
      selectedBoard,
      workspaceBoards,
      selectedBoardLists,
      setActiveView,
      setSearch,
      setMemberSearch,
      setMemberStatusFilter,
      setSelectedWorkspaceId,
      setSelectedCover,
      createWorkspace,
      deleteWorkspace,
      createBoard,
      createBoardLabel,
      updateBoardLabel,
      openBoard,
      deleteBoard,
      updateBoard,
      updateBoardVisibility,
      updateWorkspaceVisibility,
      createBoardList,
      updateBoardList,
      deleteBoardList,
      sortBoardListCards,
      moveBoardTaskCard,
      reorderBoardList,
      inviteWorkspaceMember,
      removeWorkspaceMember,
      createBoardTaskCard,
      updateTaskCard,
      toggleTaskCardCompleted,
      toggleWorkspaceExpanded,
    }),
    [
      activeView,
      boards,
      boardLists,
      boardLabels,
      workspaces,
      members,
      selectedWorkspaceId,
      selectedBoardId,
      search,
      memberSearch,
      memberStatusFilter,
      loading,
      selectedCover,
      filteredBoards,
      filteredMembers,
      currentWorkspace,
      selectedBoard,
      workspaceBoards,
      selectedBoardLists,
      createWorkspace,
      deleteWorkspace,
      createBoard,
      createBoardLabel,
      updateBoardLabel,
      openBoard,
      deleteBoard,
      updateBoard,
      updateBoardVisibility,
      updateWorkspaceVisibility,
      createBoardList,
      updateBoardList,
      deleteBoardList,
      sortBoardListCards,
      moveBoardTaskCard,
      reorderBoardList,
      inviteWorkspaceMember,
      removeWorkspaceMember,
      createBoardTaskCard,
      updateTaskCard,
      toggleTaskCardCompleted,
      toggleWorkspaceExpanded,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoards() {
  const context = useContext(BoardContext);

  if (!context) {
    throw new Error('useBoards debe usarse dentro de BoardProvider');
  }

  return context;
}
