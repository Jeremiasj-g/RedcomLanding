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
  ChatMessage,
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
import { boardCovers } from '../utils/trelloDesignData';
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
  boardMessages: ChatMessage[];
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
  deleteBoardLabel: (labelId: string) => Promise<void>;
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
  sendBoardMessage: (boardId: string, message: string) => Promise<void>;
}

const BoardContext = createContext<BoardContextValue | undefined>(undefined);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<AppView>('boards');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardLists, setBoardLists] = useState<BoardList[]>([]);
  const [boardLabels, setBoardLabels] = useState<BoardLabelOption[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState<string | undefined>();
  const [boardMessages, setBoardMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<WorkspaceMemberStatus | undefined>('member');
  const [loading, setLoading] = useState(true);
  const [selectedCover, setSelectedCover] = useState<BoardCover>(boardCovers[3]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
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
      setSelectedWorkspaceId((currentWorkspaceId) => {
        if (currentWorkspaceId && workspacesResponse.some((workspace) => workspace.id === currentWorkspaceId)) return currentWorkspaceId;
        return workspacesResponse[0]?.id ?? '';
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedBoardId) {
      setBoardMessages([]);
      return undefined;
    }

    let isMounted = true;
    const loadMessages = async () => {
      const messages = await tableroFacade.getBoardMessages(selectedBoardId);
      if (isMounted) setBoardMessages(messages);
    };

    void loadMessages();
    const unsubscribe = tableroFacade.subscribeToBoardMessages(selectedBoardId, () => {
      void loadMessages();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedBoardId]);

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

  const applyBoardListsOptimistically = useCallback((updater: (currentLists: BoardList[]) => BoardList[]) => {
    let previousLists: BoardList[] = [];
    setBoardLists((currentLists) => {
      previousLists = currentLists;
      return updater(currentLists);
    });
    return () => setBoardLists(previousLists);
  }, []);

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
    const previousWorkspaces = workspaces;
    const previousBoards = boards;
    const previousLists = boardLists;
    const previousMembers = members;
    const previousSelectedWorkspaceId = selectedWorkspaceId;
    const previousSelectedBoardId = selectedBoardId;
    const previousActiveView = activeView;
    const boardIdsToDelete = boards.filter((board) => board.workspaceId === workspaceId).map((board) => board.id);

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
    setBoardLists((currentLists) => currentLists.filter((list) => !boardIdsToDelete.includes(list.boardId)));
    setMembers((currentMembers) => currentMembers.filter((member) => member.workspaceId !== workspaceId));

    try {
      await tableroFacade.deleteWorkspace(workspaceId);
    } catch (error) {
      setWorkspaces(previousWorkspaces);
      setBoards(previousBoards);
      setBoardLists(previousLists);
      setMembers(previousMembers);
      setSelectedWorkspaceId(previousSelectedWorkspaceId);
      setSelectedBoardId(previousSelectedBoardId);
      setActiveView(previousActiveView);
      throw error;
    }
  }, [activeView, boardLists, boards, members, selectedBoardId, selectedWorkspaceId, workspaces]);

  const createBoardLabel = useCallback(async (input: CreateBoardLabelInput) => {
    const tempId = `temp-label-${crypto.randomUUID()}`;
    const optimisticLabel: BoardLabelOption = { id: tempId, name: input.name.trim(), color: input.color, boardId: input.boardId ?? selectedBoardId };
    setBoardLabels((currentLabels) => [...currentLabels, optimisticLabel]);

    try {
      const newLabel = await tableroFacade.createBoardLabel({ ...input, boardId: input.boardId ?? selectedBoardId });
      setBoardLabels((currentLabels) => currentLabels.map((label) => (label.id === tempId ? newLabel : label)));
      return newLabel;
    } catch (error) {
      setBoardLabels((currentLabels) => currentLabels.filter((label) => label.id !== tempId));
      throw error;
    }
  }, [selectedBoardId]);

  const updateBoardLabel = useCallback(async (labelId: string, input: UpdateBoardLabelInput) => {
    const previousLabels = boardLabels;
    setBoardLabels((currentLabels) =>
      currentLabels.map((label) => (label.id === labelId ? { ...label, ...input } : label)),
    );

    try {
      const updatedLabel = await tableroFacade.updateBoardLabel(labelId, input);
      if (!updatedLabel) return null;

      setBoardLabels((currentLabels) =>
        currentLabels.map((label) => (label.id === labelId ? updatedLabel : label)),
      );
      return updatedLabel;
    } catch (error) {
      setBoardLabels(previousLabels);
      throw error;
    }
  }, [boardLabels]);

  const deleteBoardLabel = useCallback(async (labelId: string) => {
    const previousLabels = boardLabels;
    const rollbackLists = applyBoardListsOptimistically((currentLists) =>
      currentLists.map((list) => ({
        ...list,
        cards: list.cards.map((card) => ({
          ...card,
          labels: (card.labels ?? []).filter((currentLabelId) => currentLabelId !== labelId),
        })),
      })),
    );

    setBoardLabels((currentLabels) => currentLabels.filter((label) => label.id !== labelId));

    try {
      await tableroFacade.deleteBoardLabel(labelId);
    } catch (error) {
      setBoardLabels(previousLabels);
      rollbackLists();
      throw error;
    }
  }, [applyBoardListsOptimistically, boardLabels]);

  const createBoard = useCallback(
    async (input: Omit<CreateBoardInput, 'cover'> & { cover?: BoardCover }) => {
      const newBoard = await tableroFacade.createBoard({
        ...input,
        cover: input.cover ?? selectedCover,
      });
      setBoards((currentBoards) => [newBoard, ...currentBoards]);
      void tableroFacade.getBoardLabels().then(setBoardLabels).catch((error) => console.error('[Tableros] No se pudieron recargar etiquetas', error));
      return newBoard;
    },
    [selectedCover],
  );

  const createBoardList = useCallback(async (input: CreateBoardListInput) => {
    const now = new Date().toISOString();
    const tempId = `temp-list-${crypto.randomUUID()}`;
    const optimisticList: BoardList = {
      id: tempId,
      boardId: input.boardId,
      title: input.title,
      cards: [],
      createdAt: now,
      updatedAt: now,
    };

    setBoardLists((currentLists) => [...currentLists, optimisticList]);

    try {
      const newList = await tableroFacade.createBoardList(input);
      setBoardLists((currentLists) => currentLists.map((list) => (list.id === tempId ? newList : list)));
      return newList;
    } catch (error) {
      setBoardLists((currentLists) => currentLists.filter((list) => list.id !== tempId));
      throw error;
    }
  }, []);

  const updateBoardList = useCallback(async (listId: string, input: UpdateBoardListInput) => {
    const rollback = applyBoardListsOptimistically((currentLists) =>
      currentLists.map((list) =>
        list.id === listId
          ? {
              ...list,
              title: input.title ?? list.title,
              cards: input.cards !== undefined ? input.cards : list.cards,
              updatedAt: new Date().toISOString(),
            }
          : list,
      ),
    );

    try {
      const updatedList = await tableroFacade.updateBoardList(listId, input);
      if (!updatedList) return null;

      setBoardLists((currentLists) => currentLists.map((list) => (list.id === listId ? updatedList : list)));
      return updatedList;
    } catch (error) {
      rollback();
      throw error;
    }
  }, [applyBoardListsOptimistically]);

  const deleteBoardList = useCallback(async (listId: string) => {
    const rollback = applyBoardListsOptimistically((currentLists) => currentLists.filter((list) => list.id !== listId));

    try {
      await tableroFacade.deleteBoardList(listId);
    } catch (error) {
      rollback();
      throw error;
    }
  }, [applyBoardListsOptimistically]);

  const moveBoardTaskCard = useCallback(async (input: MoveBoardTaskCardInput) => {
    const rollback = applyBoardListsOptimistically((currentLists) => {
      const sourceList = currentLists.find((list) => list.id === input.fromListId);
      const targetList = currentLists.find((list) => list.id === input.toListId);
      if (!sourceList || !targetList) return currentLists;

      const sourceCards = [...sourceList.cards];
      const sourceCardIndex = sourceCards.findIndex((card) => card.id === input.cardId);
      if (sourceCardIndex === -1) return currentLists;

      const [movedCard] = sourceCards.splice(sourceCardIndex, 1);
      const targetCards = input.fromListId === input.toListId ? sourceCards : [...targetList.cards];
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, targetCards.length));
      targetCards.splice(safeTargetIndex, 0, movedCard);

      return currentLists.map((list) => {
        if (list.id === input.fromListId && list.id === input.toListId) return { ...list, cards: targetCards };
        if (list.id === input.fromListId) return { ...list, cards: sourceCards };
        if (list.id === input.toListId) return { ...list, cards: targetCards };
        return list;
      });
    });

    try {
      const updatedLists = await tableroFacade.moveBoardTaskCard(input);
      setBoardLists(updatedLists);
    } catch (error) {
      rollback();
      throw error;
    }
  }, [applyBoardListsOptimistically]);

  const reorderBoardList = useCallback(async (input: ReorderBoardListInput) => {
    const rollback = applyBoardListsOptimistically((currentLists) => {
      const boardListsToReorder = currentLists.filter((list) => list.boardId === input.boardId);
      const sourceIndex = boardListsToReorder.findIndex((list) => list.id === input.listId);
      if (sourceIndex === -1) return currentLists;
      const [movedList] = boardListsToReorder.splice(sourceIndex, 1);
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, boardListsToReorder.length));
      boardListsToReorder.splice(safeTargetIndex, 0, movedList);
      return [...currentLists.filter((list) => list.boardId !== input.boardId), ...boardListsToReorder];
    });

    try {
      const updatedLists = await tableroFacade.reorderBoardList(input);
      setBoardLists(updatedLists);
    } catch (error) {
      rollback();
      throw error;
    }
  }, [applyBoardListsOptimistically]);

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
    const previousMembers = members;
    const sourceMember = members.find((member) => member.id === sourceMemberId);
    if (sourceMember) {
      const optimisticMember: WorkspaceMember = {
        ...sourceMember,
        workspaceId,
        status: 'member',
        role: sourceMember.role === 'Administrador' ? sourceMember.role : 'Miembro',
      };
      setMembers((currentMembers) => {
        const exists = currentMembers.some((member) => member.id === optimisticMember.id && member.workspaceId === workspaceId);
        return exists
          ? currentMembers.map((member) => (member.id === optimisticMember.id && member.workspaceId === workspaceId ? optimisticMember : member))
          : [...currentMembers, optimisticMember];
      });
    }

    try {
      const invitedMember = await tableroFacade.inviteWorkspaceMember(workspaceId, sourceMemberId);
      if (!invitedMember) return null;

      setMembers((currentMembers) => {
        const exists = currentMembers.some((member) => member.id === invitedMember.id && member.workspaceId === workspaceId);
        return exists
          ? currentMembers.map((member) => (member.id === invitedMember.id && member.workspaceId === workspaceId ? invitedMember : member))
          : [...currentMembers, invitedMember];
      });
      return invitedMember;
    } catch (error) {
      setMembers(previousMembers);
      throw error;
    }
  }, [members]);

  const removeWorkspaceMember = useCallback(async (memberId: string) => {
    const previousMembers = members;
    setMembers((currentMembers) => currentMembers.filter((member) => !(member.id === memberId && member.workspaceId === selectedWorkspaceId)));

    try {
      await tableroFacade.removeWorkspaceMember(memberId, selectedWorkspaceId);
    } catch (error) {
      setMembers(previousMembers);
      throw error;
    }
  }, [members, selectedWorkspaceId]);

  const createBoardTaskCard = useCallback(async (input: CreateBoardTaskCardInput) => {
    const now = new Date().toISOString();
    const tempCardId = `temp-card-${crypto.randomUUID()}`;
    const optimisticCard = {
      id: tempCardId,
      title: input.title,
      completed: false,
      labels: [],
      members: [],
      comments: [],
      activities: [],
      checklists: [],
      createdAt: now,
      updatedAt: now,
    };

    setBoardLists((currentLists) =>
      currentLists.map((list) =>
        list.id === input.listId ? { ...list, cards: [...list.cards, optimisticCard] } : list,
      ),
    );

    try {
      const updatedList = await tableroFacade.createBoardTaskCard(input);
      if (!updatedList) return null;

      setBoardLists((currentLists) => currentLists.map((list) => (list.id === updatedList.id ? updatedList : list)));
      return updatedList;
    } catch (error) {
      setBoardLists((currentLists) =>
        currentLists.map((list) =>
          list.id === input.listId ? { ...list, cards: list.cards.filter((card) => card.id !== tempCardId) } : list,
        ),
      );
      throw error;
    }
  }, []);

  const updateTaskCard = useCallback(async (listId: string, cardId: string, input: UpdateBoardTaskCardInput) => {
    const now = new Date().toISOString();
    const rollback = applyBoardListsOptimistically((currentLists) =>
      currentLists.map((list) =>
        list.id === listId
          ? {
              ...list,
              cards: list.cards.map((card) =>
                card.id === cardId ? { ...card, ...input, updatedAt: now } : card,
              ),
            }
          : list,
      ),
    );

    try {
      const updatedList = await tableroFacade.updateBoardTaskCard(listId, cardId, input);
      if (!updatedList) return null;

      setBoardLists((currentLists) => currentLists.map((list) => (list.id === updatedList.id ? updatedList : list)));
      return updatedList;
    } catch (error) {
      rollback();
      throw error;
    }
  }, [applyBoardListsOptimistically]);

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
      const previousBoards = boards;
      const previousLists = boardLists;
      const previousSelectedBoardId = selectedBoardId;
      const previousActiveView = activeView;

      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== boardId));
      setBoardLists((currentLists) => currentLists.filter((list) => list.boardId !== boardId));
      if (selectedBoardId === boardId) {
        setSelectedBoardId(undefined);
        setActiveView('boards');
      }

      try {
        await tableroFacade.deleteBoard(boardId);
      } catch (error) {
        setBoards(previousBoards);
        setBoardLists(previousLists);
        setSelectedBoardId(previousSelectedBoardId);
        setActiveView(previousActiveView);
        throw error;
      }
    },
    [activeView, boardLists, boards, selectedBoardId],
  );


  const updateBoard = useCallback(async (boardId: string, input: UpdateBoardInput) => {
    const previousBoards = boards;
    setBoards((currentBoards) =>
      currentBoards.map((board) => (board.id === boardId ? { ...board, ...input, updatedAt: new Date().toISOString() } : board)),
    );

    try {
      const updatedBoard = await tableroFacade.updateBoard(boardId, input);
      if (!updatedBoard) return null;

      setBoards((currentBoards) =>
        currentBoards.map((board) => (board.id === boardId ? updatedBoard : board)),
      );
      return updatedBoard;
    } catch (error) {
      setBoards(previousBoards);
      throw error;
    }
  }, [boards]);

  const updateBoardVisibility = useCallback(async (boardId: string, visibility: BoardVisibility) => {
    await updateBoard(boardId, { visibility });
  }, [updateBoard]);

  const updateWorkspaceVisibility = useCallback(async (workspaceId: string, visibility: WorkspaceVisibility) => {
    const previousWorkspaces = workspaces;
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) => (workspace.id === workspaceId ? { ...workspace, visibility } : workspace)),
    );

    try {
      const updatedWorkspace = await tableroFacade.updateWorkspace(workspaceId, { visibility });
      if (!updatedWorkspace) return;

      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((workspace) => (workspace.id === workspaceId ? updatedWorkspace : workspace)),
      );
    } catch (error) {
      setWorkspaces(previousWorkspaces);
      throw error;
    }
  }, [workspaces]);

  const toggleWorkspaceExpanded = useCallback(async (workspaceId: string) => {
    const updatedWorkspaces = await tableroFacade.toggleWorkspaceExpanded(workspaceId);
    setWorkspaces(updatedWorkspaces);
  }, []);

  const sendBoardMessage = useCallback(async (boardId: string, message: string) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    const currentUser = members.find((member) => member.isCurrentUser) ?? members[0];
    const tempId = `temp-message-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      boardId,
      senderName: currentUser?.fullName ?? 'Usuario',
      avatarText: currentUser?.avatarText ?? 'US',
      message: cleanMessage,
      sentAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: true,
    };

    setBoardMessages((currentMessages) => [...currentMessages, optimisticMessage]);

    try {
      const newMessage = await tableroFacade.sendBoardMessage(boardId, cleanMessage);
      setBoardMessages((currentMessages) => {
        const withoutTemp = currentMessages.filter((currentMessage) => currentMessage.id !== tempId);
        if (withoutTemp.some((currentMessage) => currentMessage.id === newMessage.id)) return withoutTemp;
        return [...withoutTemp, newMessage];
      });
    } catch (error) {
      setBoardMessages((currentMessages) => currentMessages.filter((currentMessage) => currentMessage.id !== tempId));
      throw error;
    }
  }, [members]);

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
      boardMessages,
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
      deleteBoardLabel,
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
      sendBoardMessage,
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
      boardMessages,
      createWorkspace,
      deleteWorkspace,
      createBoard,
      createBoardLabel,
      updateBoardLabel,
      deleteBoardLabel,
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
      sendBoardMessage,
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
