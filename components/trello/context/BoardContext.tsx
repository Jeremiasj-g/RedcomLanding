import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { tableroFacade } from '../lib/facades/tablero.facade';
import type {
  AppView,
  Board,
  BoardCover,
  BoardLabelOption,
  BoardList,
  BoardTaskCard,
  BoardVisibility,
  ChatMessage,
  TrelloBoardSnapshot,
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
import { trelloSocketClient } from '../lib/socket/trelloSocketClient';
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
  currentUserMember?: WorkspaceMember;
  currentWorkspaceRole?: WorkspaceMember['role'];
  canManageCurrentWorkspace: boolean;
  canManageSelectedBoard: boolean;
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
  updateWorkspaceMemberRole: (memberId: string, role: WorkspaceMember['role']) => Promise<WorkspaceMember | null>;
  updateBoardMemberRole: (boardId: string, memberId: string, role: WorkspaceMember['role']) => Promise<Board | null>;
  createBoardTaskCard: (input: CreateBoardTaskCardInput) => Promise<BoardList | null>;
  updateTaskCard: (listId: string, cardId: string, input: UpdateBoardTaskCardInput) => Promise<BoardList | null>;
  toggleTaskCardCompleted: (listId: string, cardId: string, completed: boolean) => Promise<void>;
  toggleWorkspaceExpanded: (workspaceId: string) => Promise<void>;
  sendBoardMessage: (boardId: string, message: string) => Promise<void>;
}


const POSITION_GAP = 16384;
const LOCAL_REALTIME_SUPPRESS_MS = 900;
const LOCAL_ENTITY_IGNORE_MS = 3500;

type RealtimeChangePayload = { table?: string; eventType?: string; id?: string };

function isTemporaryId(id?: string): boolean {
  return Boolean(id?.startsWith('temp-'));
}

function getNextFractionalPosition(items: Array<{ position?: number }>): number {
  const maxPosition = items.reduce((max, item, index) => {
    const fallback = (index + 1) * POSITION_GAP;
    const position = typeof item.position === 'number' && Number.isFinite(item.position) ? item.position : fallback;
    return Math.max(max, position);
  }, 0);
  return maxPosition + POSITION_GAP;
}

function getPositionBetweenLocal(previousPosition?: number | null, nextPosition?: number | null): number {
  const hasPrevious = typeof previousPosition === 'number' && Number.isFinite(previousPosition);
  const hasNext = typeof nextPosition === 'number' && Number.isFinite(nextPosition);
  if (!hasPrevious && !hasNext) return POSITION_GAP;
  if (!hasPrevious && hasNext) return (nextPosition as number) - POSITION_GAP;
  if (hasPrevious && !hasNext) return (previousPosition as number) + POSITION_GAP;
  return ((previousPosition as number) + (nextPosition as number)) / 2;
}

function sortByPosition<T extends { position?: number; createdAt?: string; updatedAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftPosition = typeof left.position === 'number' ? left.position : Number.MAX_SAFE_INTEGER;
    const rightPosition = typeof right.position === 'number' ? right.position : Number.MAX_SAFE_INTEGER;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    return new Date(left.createdAt ?? left.updatedAt ?? 0).getTime() - new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();
  });
}

function mergeCardsPreservingOptimistic(currentCards: BoardTaskCard[], incomingCards: BoardTaskCard[]): BoardTaskCard[] {
  const incomingById = new Map(incomingCards.map((card) => [card.id, card]));
  const merged = incomingCards.map((incomingCard) => {
    const currentCard = currentCards.find((card) => card.id === incomingCard.id);
    return currentCard ? { ...currentCard, ...incomingCard } : incomingCard;
  });

  currentCards.forEach((card) => {
    if (isTemporaryId(card.id) && !incomingById.has(card.id)) merged.push(card);
  });

  return sortByPosition(merged);
}

function mergeBoardListsPreservingOptimistic(currentLists: BoardList[], incomingLists: BoardList[], boardId: string): BoardList[] {
  const incomingById = new Map(incomingLists.map((list) => [list.id, list]));
  const currentById = new Map(currentLists.map((list) => [list.id, list]));
  const unrelatedLists = currentLists.filter((list) => list.boardId !== boardId);
  const mergedBoardLists = incomingLists.map((incomingList) => {
    const currentList = currentById.get(incomingList.id);
    return currentList
      ? { ...currentList, ...incomingList, cards: mergeCardsPreservingOptimistic(currentList.cards, incomingList.cards) }
      : incomingList;
  });

  currentLists.forEach((list) => {
    if (list.boardId === boardId && isTemporaryId(list.id) && !incomingById.has(list.id)) mergedBoardLists.push(list);
  });

  return [...unrelatedLists, ...sortByPosition(mergedBoardLists)];
}


function mergeWorkspaceMembersPreservingOptimistic(currentMembers: WorkspaceMember[], incomingMembers: WorkspaceMember[]): WorkspaceMember[] {
  const getKey = (member: WorkspaceMember) => `${member.workspaceId}:${member.id}`;
  const incomingByKey = new Map(incomingMembers.map((member) => [getKey(member), member]));
  const merged = incomingMembers.map((incomingMember) => {
    const currentMember = currentMembers.find((member) => getKey(member) === getKey(incomingMember));
    return currentMember ? { ...currentMember, ...incomingMember } : incomingMember;
  });
  currentMembers.forEach((member) => {
    if (isTemporaryId(member.id) && !incomingByKey.has(getKey(member))) merged.push(member);
  });
  return merged;
}

function mergeByIdPreservingOptimistic<T extends { id: string }>(currentItems: T[], incomingItems: T[]): T[] {
  const incomingById = new Map(incomingItems.map((item) => [item.id, item]));
  const merged = incomingItems.map((incomingItem) => {
    const currentItem = currentItems.find((item) => item.id === incomingItem.id);
    return currentItem ? { ...currentItem, ...incomingItem } : incomingItem;
  });
  currentItems.forEach((item) => {
    if (isTemporaryId(item.id) && !incomingById.has(item.id)) merged.push(item);
  });
  return merged;
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
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoardRefreshAtRef = useRef(0);
  const lastAppliedSnapshotVersionRef = useRef<Record<string, number>>({});
  const suppressNextSnapshotPushRef = useRef(false);
  const boardRefreshSequenceRef = useRef(0);
  const localMutationSilenceUntilRef = useRef(0);
  const localRealtimeIgnoreIdsRef = useRef<Map<string, number>>(new Map());
  const boardListsRef = useRef<BoardList[]>([]);

  useEffect(() => {
    boardListsRef.current = boardLists;
  }, [boardLists]);

  const markLocalMutation = useCallback((entityIds: Array<string | undefined> = []) => {
    const now = Date.now();
    localMutationSilenceUntilRef.current = Math.max(localMutationSilenceUntilRef.current, now + LOCAL_REALTIME_SUPPRESS_MS);
    entityIds.filter(Boolean).forEach((entityId) => {
      localRealtimeIgnoreIdsRef.current.set(entityId as string, now + LOCAL_ENTITY_IGNORE_MS);
    });

    if (typeof window !== 'undefined') window.setTimeout(() => {
      const cleanupNow = Date.now();
      localRealtimeIgnoreIdsRef.current.forEach((expiresAt, entityId) => {
        if (expiresAt <= cleanupNow) localRealtimeIgnoreIdsRef.current.delete(entityId);
      });
    }, LOCAL_ENTITY_IGNORE_MS + 100);
  }, []);

  const shouldIgnoreRealtimeChange = useCallback((payload?: RealtimeChangePayload) => {
    const now = Date.now();
    localRealtimeIgnoreIdsRef.current.forEach((expiresAt, entityId) => {
      if (expiresAt <= now) localRealtimeIgnoreIdsRef.current.delete(entityId);
    });

    if (payload?.id && localRealtimeIgnoreIdsRef.current.has(payload.id)) return true;
    return now < localMutationSilenceUntilRef.current;
  }, []);

  const reportBackgroundError = useCallback((error: unknown, fallbackMessage: string) => {
    console.error('[Tableros] Mutación en segundo plano fallida', error);
    if (typeof window !== 'undefined') {
      window.alert(error instanceof Error ? error.message : fallbackMessage);
    }
  }, []);

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

  const applyBoardSnapshot = useCallback((snapshot: TrelloBoardSnapshot) => {
    if (!snapshot?.boardId) return;
    const previousVersion = lastAppliedSnapshotVersionRef.current[snapshot.boardId] ?? 0;
    if (snapshot.version && snapshot.version < previousVersion) return;
    lastAppliedSnapshotVersionRef.current[snapshot.boardId] = snapshot.version || Date.now();
    suppressNextSnapshotPushRef.current = true;

    if (snapshot.board) {
      setBoards((currentBoards) => {
        const exists = currentBoards.some((board) => board.id === snapshot.boardId);
        if (exists) {
          return currentBoards.map((board) => (board.id === snapshot.boardId ? { ...board, ...snapshot.board! } : board));
        }
        return [snapshot.board!, ...currentBoards];
      });
    }

    setBoardLists((currentLists) => [
      ...currentLists.filter((list) => list.boardId !== snapshot.boardId),
      ...(snapshot.lists ?? []),
    ]);

    setBoardLabels((currentLabels) => [
      ...currentLabels.filter((label) => label.boardId !== snapshot.boardId),
      ...(snapshot.labels ?? []),
    ]);

    if (snapshot.workspaceId && snapshot.members?.length) {
      setMembers((currentMembers) => {
        const systemMembers = currentMembers.filter((member) => member.workspaceId === '__system__');
        const unrelatedMembers = currentMembers.filter(
          (member) => member.workspaceId !== snapshot.workspaceId && member.workspaceId !== '__system__',
        );
        const snapshotWorkspaceMembers = snapshot.members.filter((member) => member.workspaceId === snapshot.workspaceId);
        return [...unrelatedMembers, ...snapshotWorkspaceMembers, ...systemMembers];
      });
    }

    if (selectedBoardId === snapshot.boardId) {
      setBoardMessages(snapshot.messages ?? []);
    }

    if (typeof window !== 'undefined') window.setTimeout(() => {
      suppressNextSnapshotPushRef.current = false;
    }, 450);
  }, [selectedBoardId]);

  const buildBoardSnapshot = useCallback((boardId: string): TrelloBoardSnapshot | null => {
    const board = boards.find((currentBoard) => currentBoard.id === boardId);
    if (!board) return null;

    return {
      boardId,
      workspaceId: board.workspaceId,
      board,
      lists: boardLists.filter((list) => list.boardId === boardId),
      labels: boardLabels.filter((label) => label.boardId === boardId),
      members: members.filter((member) => member.workspaceId === board.workspaceId),
      messages: selectedBoardId === boardId ? boardMessages : [],
      version: Date.now(),
      sourceClientId: trelloSocketClient.getClientId(),
      updatedAt: new Date().toISOString(),
    };
  }, [boardLabels, boardLists, boardMessages, boards, members, selectedBoardId]);

  useEffect(() => {
    if (!selectedBoardId || !trelloSocketClient.isEnabled()) return undefined;

    let cancelled = false;
    void trelloSocketClient.getBoardSnapshot(selectedBoardId).then((snapshot) => {
      if (!cancelled && snapshot) applyBoardSnapshot(snapshot);
    });

    return () => {
      cancelled = true;
    };
  }, [applyBoardSnapshot, selectedBoardId, shouldIgnoreRealtimeChange]);

  useEffect(() => {
    if (!selectedBoardId || !trelloSocketClient.isEnabled()) return undefined;
    if (suppressNextSnapshotPushRef.current) return undefined;

    if (snapshotPushTimerRef.current) clearTimeout(snapshotPushTimerRef.current);
    snapshotPushTimerRef.current = setTimeout(() => {
      const snapshot = buildBoardSnapshot(selectedBoardId);
      if (snapshot) trelloSocketClient.putBoardSnapshot(snapshot);
    }, 80);

    return () => {
      if (snapshotPushTimerRef.current) clearTimeout(snapshotPushTimerRef.current);
    };
  }, [boardLabels, boardLists, boardMessages, boards, buildBoardSnapshot, members, selectedBoardId]);

  const refreshBoardData = useCallback(async (boardId: string) => {
    const now = Date.now();
    if (now - lastBoardRefreshAtRef.current < 250) return;
    lastBoardRefreshAtRef.current = now;

    const refreshSequence = boardRefreshSequenceRef.current + 1;
    boardRefreshSequenceRef.current = refreshSequence;

    const [boardsResponse, boardListsResponse, membersResponse, labelsResponse] = await Promise.all([
      tableroFacade.getBoards(),
      tableroFacade.getBoardListsByBoard(boardId),
      tableroFacade.getWorkspaceMembers(),
      tableroFacade.getBoardLabels(),
    ]);

    if (refreshSequence !== boardRefreshSequenceRef.current) return;

    setBoards((currentBoards) => mergeByIdPreservingOptimistic(currentBoards, boardsResponse));
    setBoardLists((currentLists) => mergeBoardListsPreservingOptimistic(currentLists, boardListsResponse, boardId));
    setMembers((currentMembers) => mergeWorkspaceMembersPreservingOptimistic(currentMembers, membersResponse));
    setBoardLabels((currentLabels) => mergeByIdPreservingOptimistic(currentLabels, labelsResponse));
    if (!boardsResponse.some((board) => board.id === boardId)) {
      setSelectedBoardId(undefined);
      setActiveView('boards');
    }
  }, []);

  useEffect(() => {
    const scheduleWorkspaceRefresh = () => {
      if (workspaceRefreshTimerRef.current) clearTimeout(workspaceRefreshTimerRef.current);
      workspaceRefreshTimerRef.current = setTimeout(() => {
        void loadInitialData().catch((error) => {
          console.error('[Tableros] No se pudo refrescar espacios por Socket.IO', error);
        });
      }, 220);
    };

    const unsubscribe = trelloSocketClient.isEnabled()
      ? trelloSocketClient.subscribeToWorkspaceChanges(scheduleWorkspaceRefresh)
      : () => undefined;

    return () => {
      if (workspaceRefreshTimerRef.current) clearTimeout(workspaceRefreshTimerRef.current);
      unsubscribe();
    };
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedBoardId) return undefined;

    const scheduleRefresh = (payload?: RealtimeChangePayload) => {
      if (shouldIgnoreRealtimeChange(payload)) return;
      if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = setTimeout(() => {
        void refreshBoardData(selectedBoardId).catch((error) => {
          console.error('[Tableros] No se pudo refrescar el tablero en tiempo real', error);
        });
      }, 120);
    };

    const unsubscribe = trelloSocketClient.isEnabled()
      ? trelloSocketClient.subscribeToBoard(selectedBoardId, (payload) => {
          if (payload.snapshot) {
            applyBoardSnapshot(payload.snapshot);
            return;
          }

          if (payload.action === 'snapshot_invalidate') {
            scheduleRefresh();
            return;
          }

          if (payload.scope !== 'message') {
            void trelloSocketClient.getBoardSnapshot(selectedBoardId).then((snapshot) => {
              if (snapshot) applyBoardSnapshot(snapshot);
              else scheduleRefresh();
            });
          }
        })
      : tableroFacade.subscribeToBoardData(selectedBoardId, scheduleRefresh);

    return () => {
      if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
      unsubscribe();
    };
  }, [applyBoardSnapshot, refreshBoardData, selectedBoardId, shouldIgnoreRealtimeChange]);

  useEffect(() => {
    if (!selectedBoardId) {
      setBoardMessages([]);
      return undefined;
    }

    let isMounted = true;
    const loadMessages = async () => {
      const messages = await tableroFacade.getBoardMessages(selectedBoardId);
      if (isMounted) setBoardMessages((currentMessages) => mergeByIdPreservingOptimistic(currentMessages, messages));
    };

    void loadMessages();

    const unsubscribe = trelloSocketClient.isEnabled()
      ? trelloSocketClient.subscribeToBoard(selectedBoardId, (payload) => {
          if (payload.snapshot) {
            applyBoardSnapshot(payload.snapshot);
            return;
          }
          if (payload.scope === 'message') {
            void trelloSocketClient.getBoardSnapshot(selectedBoardId).then((snapshot) => {
              if (snapshot) applyBoardSnapshot(snapshot);
              else void loadMessages();
            });
          }
        })
      : tableroFacade.subscribeToBoardMessages(selectedBoardId, (payload) => {
          if (shouldIgnoreRealtimeChange(payload)) return;
          void loadMessages();
        });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [applyBoardSnapshot, selectedBoardId, shouldIgnoreRealtimeChange]);

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
    () => (selectedBoardId ? sortByPosition(boardLists.filter((list) => list.boardId === selectedBoardId)) : []),
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

  const currentUserMember = useMemo(
    () => members.find((member) => member.isCurrentUser),
    [members],
  );

  const currentWorkspaceRole = useMemo(
    () => members.find((member) => member.workspaceId === selectedWorkspaceId && member.id === currentUserMember?.id)?.role,
    [currentUserMember?.id, members, selectedWorkspaceId],
  );

  const canManageCurrentWorkspace = currentWorkspaceRole === 'Administrador';

  const canManageSelectedBoard = useMemo(() => {
    if (!selectedBoard || !currentUserMember) return false;
    if (canManageCurrentWorkspace) return true;
    return selectedBoard.memberRoles?.[currentUserMember.id] === 'Administrador';
  }, [canManageCurrentWorkspace, currentUserMember, selectedBoard]);

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
    trelloSocketClient.emitWorkspaceChanged({ workspaceId: newWorkspace.id, action: 'workspace_created' });
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
      trelloSocketClient.emitWorkspaceChanged({ workspaceId, action: 'workspace_deleted' });
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

  const createBoardLabel = useCallback((input: CreateBoardLabelInput): Promise<BoardLabelOption> => {
    const tempId = `temp-label-${crypto.randomUUID()}`;
    const optimisticLabel: BoardLabelOption = { id: tempId, name: input.name.trim(), color: input.color, boardId: input.boardId ?? selectedBoardId };
    setBoardLabels((currentLabels) => [...currentLabels, optimisticLabel]);

    markLocalMutation([tempId]);
    void tableroFacade.createBoardLabel({ ...input, boardId: input.boardId ?? selectedBoardId })
      .then((newLabel) => {
        setBoardLabels((currentLabels) => currentLabels.map((label) => (label.id === tempId ? newLabel : label)));
        trelloSocketClient.emitBoardChanged({ boardId: newLabel.boardId, scope: 'label', action: 'label_created', entityId: newLabel.id });
      })
      .catch((error) => {
        setBoardLabels((currentLabels) => currentLabels.filter((label) => label.id !== tempId));
        reportBackgroundError(error, 'No se pudo crear la etiqueta.');
      });

    return Promise.resolve(optimisticLabel);
  }, [reportBackgroundError, selectedBoardId]);

  const updateBoardLabel = useCallback((labelId: string, input: UpdateBoardLabelInput): Promise<BoardLabelOption | null> => {
    const previousLabels = boardLabels;
    let optimisticLabel: BoardLabelOption | null = null;
    setBoardLabels((currentLabels) =>
      currentLabels.map((label) => {
        if (label.id !== labelId) return label;
        optimisticLabel = { ...label, ...input };
        return optimisticLabel;
      }),
    );

    markLocalMutation([labelId]);
    void tableroFacade.updateBoardLabel(labelId, input)
      .then((updatedLabel) => {
        if (!updatedLabel) return;
        setBoardLabels((currentLabels) =>
          currentLabels.map((label) => (label.id === labelId ? updatedLabel : label)),
        );
        trelloSocketClient.emitBoardChanged({ boardId: updatedLabel.boardId, scope: 'label', action: 'label_updated', entityId: updatedLabel.id });
      })
      .catch((error) => {
        setBoardLabels(previousLabels);
        reportBackgroundError(error, 'No se pudo actualizar la etiqueta.');
      });

    return Promise.resolve(optimisticLabel);
  }, [boardLabels, reportBackgroundError]);

  const deleteBoardLabel = useCallback((labelId: string): Promise<void> => {
    const previousLabels = boardLabels;
    const deletedLabel = boardLabels.find((label) => label.id === labelId);
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

    markLocalMutation([labelId]);
    void tableroFacade.deleteBoardLabel(labelId)
      .then(() => {
        trelloSocketClient.emitBoardChanged({ boardId: deletedLabel?.boardId, scope: 'label', action: 'label_deleted', entityId: labelId });
      })
      .catch((error) => {
      setBoardLabels(previousLabels);
      rollbackLists();
      reportBackgroundError(error, 'No se pudo eliminar la etiqueta.');
    });

    return Promise.resolve();
  }, [applyBoardListsOptimistically, boardLabels, reportBackgroundError]);

  const createBoard = useCallback(
    async (input: Omit<CreateBoardInput, 'cover'> & { cover?: BoardCover }) => {
      const newBoard = await tableroFacade.createBoard({
        ...input,
        cover: input.cover ?? selectedCover,
      });
      setBoards((currentBoards) => [newBoard, ...currentBoards]);
      trelloSocketClient.emitWorkspaceChanged({ workspaceId: newBoard.workspaceId, action: 'board_created', entityId: newBoard.id });
      trelloSocketClient.emitBoardChanged({ boardId: newBoard.id, workspaceId: newBoard.workspaceId, scope: 'board', action: 'board_created', entityId: newBoard.id });
      void tableroFacade.getBoardLabels().then(setBoardLabels).catch((error) => console.error('[Tableros] No se pudieron recargar etiquetas', error));
      return newBoard;
    },
    [selectedCover],
  );

  const createBoardList = useCallback((input: CreateBoardListInput): Promise<BoardList> => {
    const now = new Date().toISOString();
    const tempId = `temp-list-${crypto.randomUUID()}`;
    const position = getNextFractionalPosition(boardListsRef.current.filter((list) => list.boardId === input.boardId));
    const optimisticList: BoardList = {
      id: tempId,
      boardId: input.boardId,
      title: input.title,
      cards: [],
      createdAt: now,
      updatedAt: now,
      position,
    };

    markLocalMutation([tempId]);
    const nextLists = [...boardListsRef.current, optimisticList];
    boardListsRef.current = nextLists;
    setBoardLists(nextLists);

    void tableroFacade.createBoardList({ ...input, position })
      .then((newList) => {
        markLocalMutation([newList.id]);
        setBoardLists((currentLists) => {
          const replacedLists = currentLists.map((list) => (list.id === tempId ? newList : list));
          boardListsRef.current = replacedLists;
          return replacedLists;
        });
        trelloSocketClient.emitBoardChanged({ boardId: input.boardId, scope: 'list', action: 'list_created', entityId: newList.id });
      })
      .catch((error) => {
        setBoardLists((currentLists) => {
          const rolledBackLists = currentLists.filter((list) => list.id !== tempId);
          boardListsRef.current = rolledBackLists;
          return rolledBackLists;
        });
        reportBackgroundError(error, 'No se pudo crear la lista.');
      });

    return Promise.resolve(optimisticList);
  }, [markLocalMutation, reportBackgroundError]);


  const updateBoardList = useCallback((listId: string, input: UpdateBoardListInput): Promise<BoardList | null> => {
    let optimisticList: BoardList | null = null;
    const rollback = applyBoardListsOptimistically((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== listId) return list;
        optimisticList = {
          ...list,
          title: input.title ?? list.title,
          cards: input.cards !== undefined ? input.cards : list.cards,
          updatedAt: new Date().toISOString(),
        };
        return optimisticList;
      }),
    );

    markLocalMutation([listId]);
    void tableroFacade.updateBoardList(listId, input)
      .then((updatedList) => {
        if (!updatedList) return;
        setBoardLists((currentLists) => currentLists.map((list) => (list.id === listId ? updatedList : list)));
        trelloSocketClient.emitBoardChanged({ boardId: updatedList.boardId, scope: 'list', action: 'list_updated', entityId: updatedList.id });
      })
      .catch((error) => {
        rollback();
        reportBackgroundError(error, 'No se pudo actualizar la lista.');
      });

    return Promise.resolve(optimisticList);
  }, [applyBoardListsOptimistically, reportBackgroundError]);


  const deleteBoardList = useCallback((listId: string): Promise<void> => {
    const deletedList = boardLists.find((list) => list.id === listId);
    const rollback = applyBoardListsOptimistically((currentLists) => currentLists.filter((list) => list.id !== listId));

    markLocalMutation([listId]);
    void tableroFacade.deleteBoardList(listId)
      .then(() => {
        trelloSocketClient.emitBoardChanged({ boardId: deletedList?.boardId, scope: 'list', action: 'list_deleted', entityId: listId });
      })
      .catch((error) => {
      rollback();
      reportBackgroundError(error, 'No se pudo eliminar la lista.');
    });

    return Promise.resolve();
  }, [applyBoardListsOptimistically, boardLists, reportBackgroundError]);


  const moveBoardTaskCard = useCallback((input: MoveBoardTaskCardInput): Promise<void> => {
    const currentLists = boardListsRef.current;
    const sourceList = currentLists.find((list) => list.id === input.fromListId);
    const targetList = currentLists.find((list) => list.id === input.toListId);
    let nextPosition = input.position;

    if (sourceList && targetList) {
      const sourceCards = [...sourceList.cards];
      const sourceCardIndex = sourceCards.findIndex((card) => card.id === input.cardId);
      if (sourceCardIndex !== -1) {
        const [movedCard] = sourceCards.splice(sourceCardIndex, 1);
        const targetCards = input.fromListId === input.toListId ? sourceCards : [...targetList.cards];
        const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, targetCards.length));
        const previousCard = targetCards[safeTargetIndex - 1];
        const nextCard = targetCards[safeTargetIndex];
        nextPosition = getPositionBetweenLocal(previousCard?.position ?? null, nextCard?.position ?? null);
        targetCards.splice(safeTargetIndex, 0, { ...movedCard, position: nextPosition });
      }
    }

    const rollback = applyBoardListsOptimistically((listsToUpdate) => {
      const optimisticSourceList = listsToUpdate.find((list) => list.id === input.fromListId);
      const optimisticTargetList = listsToUpdate.find((list) => list.id === input.toListId);
      if (!optimisticSourceList || !optimisticTargetList) return listsToUpdate;

      const sourceCards = [...optimisticSourceList.cards];
      const sourceCardIndex = sourceCards.findIndex((card) => card.id === input.cardId);
      if (sourceCardIndex === -1) return listsToUpdate;

      const [movedCard] = sourceCards.splice(sourceCardIndex, 1);
      const targetCards = input.fromListId === input.toListId ? sourceCards : [...optimisticTargetList.cards];
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, targetCards.length));
      targetCards.splice(safeTargetIndex, 0, { ...movedCard, position: nextPosition });

      const updatedLists = listsToUpdate.map((list) => {
        if (list.id === input.fromListId && list.id === input.toListId) return { ...list, cards: targetCards };
        if (list.id === input.fromListId) return { ...list, cards: sourceCards };
        if (list.id === input.toListId) return { ...list, cards: targetCards };
        return list;
      });
      boardListsRef.current = updatedLists;
      return updatedLists;
    });

    markLocalMutation([input.cardId]);
    void tableroFacade.moveBoardTaskCard({ ...input, position: nextPosition })
      .then(() => {
        markLocalMutation([input.cardId]);
        const targetListForEvent = boardListsRef.current.find((list) => list.id === input.toListId) ?? boardListsRef.current.find((list) => list.id === input.fromListId);
        trelloSocketClient.emitBoardChanged({ boardId: targetListForEvent?.boardId, scope: 'card', action: 'card_moved', entityId: input.cardId });
      })
      .catch((error) => {
        rollback();
        reportBackgroundError(error, 'No se pudo guardar el movimiento de la tarjeta.');
      });

    return Promise.resolve();
  }, [applyBoardListsOptimistically, markLocalMutation, reportBackgroundError]);


  const reorderBoardList = useCallback((input: ReorderBoardListInput): Promise<void> => {
    const boardListsToReorder = boardListsRef.current.filter((list) => list.boardId === input.boardId);
    const sourceIndex = boardListsToReorder.findIndex((list) => list.id === input.listId);
    let nextPosition = input.position;
    if (sourceIndex !== -1) {
      boardListsToReorder.splice(sourceIndex, 1);
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, boardListsToReorder.length));
      const previousList = boardListsToReorder[safeTargetIndex - 1];
      const nextList = boardListsToReorder[safeTargetIndex];
      nextPosition = getPositionBetweenLocal(previousList?.position ?? null, nextList?.position ?? null);
    }

    const rollback = applyBoardListsOptimistically((currentLists) => {
      const optimisticBoardLists = currentLists.filter((list) => list.boardId === input.boardId);
      const optimisticSourceIndex = optimisticBoardLists.findIndex((list) => list.id === input.listId);
      if (optimisticSourceIndex === -1) return currentLists;
      const [movedList] = optimisticBoardLists.splice(optimisticSourceIndex, 1);
      const safeTargetIndex = Math.max(0, Math.min(input.targetIndex, optimisticBoardLists.length));
      optimisticBoardLists.splice(safeTargetIndex, 0, { ...movedList, position: nextPosition });
      const updatedLists = [...currentLists.filter((list) => list.boardId !== input.boardId), ...optimisticBoardLists];
      boardListsRef.current = updatedLists;
      return updatedLists;
    });

    markLocalMutation([input.listId]);
    void tableroFacade.reorderBoardList({ ...input, position: nextPosition })
      .then(() => {
        markLocalMutation([input.listId]);
        trelloSocketClient.emitBoardChanged({ boardId: input.boardId, scope: 'list', action: 'list_reordered', entityId: input.listId });
      })
      .catch((error) => {
        rollback();
        reportBackgroundError(error, 'No se pudo guardar el orden de las listas.');
      });

    return Promise.resolve();
  }, [applyBoardListsOptimistically, markLocalMutation, reportBackgroundError]);


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
      trelloSocketClient.emitWorkspaceChanged({ workspaceId, scope: 'member', action: 'workspace_member_invited', entityId: invitedMember.id });
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
      trelloSocketClient.emitWorkspaceChanged({ workspaceId: selectedWorkspaceId, scope: 'member', action: 'workspace_member_removed', entityId: memberId });
    } catch (error) {
      setMembers(previousMembers);
      throw error;
    }
  }, [members, selectedWorkspaceId]);

  const updateWorkspaceMemberRole = useCallback(async (memberId: string, role: WorkspaceMember['role']) => {
    const previousMembers = members;
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId && member.workspaceId === selectedWorkspaceId
          ? { ...member, role }
          : member,
      ),
    );

    try {
      const updatedMember = await tableroFacade.updateWorkspaceMemberRole(selectedWorkspaceId, memberId, role);
      if (!updatedMember) return null;
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === memberId && member.workspaceId === selectedWorkspaceId ? updatedMember : member,
        ),
      );
      trelloSocketClient.emitWorkspaceChanged({ workspaceId: selectedWorkspaceId, scope: 'member', action: 'workspace_member_role_updated', entityId: memberId });
      return updatedMember;
    } catch (error) {
      setMembers(previousMembers);
      throw error;
    }
  }, [members, selectedWorkspaceId]);

  const updateBoardMemberRole = useCallback(async (boardId: string, memberId: string, role: WorkspaceMember['role']) => {
    const previousBoards = boards;
    setBoards((currentBoards) =>
      currentBoards.map((board) =>
        board.id === boardId
          ? {
              ...board,
              memberRoles: {
                ...(board.memberRoles ?? {}),
                [memberId]: role,
              },
            }
          : board,
      ),
    );

    try {
      const updatedBoard = await tableroFacade.updateBoardMemberRole(boardId, memberId, role);
      if (!updatedBoard) return null;
      setBoards((currentBoards) => currentBoards.map((board) => (board.id === boardId ? updatedBoard : board)));
      trelloSocketClient.emitBoardChanged({ boardId, workspaceId: updatedBoard.workspaceId, scope: 'member', action: 'board_member_role_updated', entityId: memberId });
      trelloSocketClient.emitWorkspaceChanged({ workspaceId: updatedBoard.workspaceId, scope: 'member', action: 'board_member_role_updated', entityId: memberId });
      return updatedBoard;
    } catch (error) {
      setBoards(previousBoards);
      throw error;
    }
  }, [boards]);

  const createBoardTaskCard = useCallback((input: CreateBoardTaskCardInput): Promise<BoardList | null> => {
    const now = new Date().toISOString();
    const tempCardId = `temp-card-${crypto.randomUUID()}`;
    const listForPosition = boardListsRef.current.find((list) => list.id === input.listId);
    const position = getNextFractionalPosition(listForPosition?.cards ?? []);
    const optimisticCard: BoardTaskCard = {
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
      position,
    };
    let optimisticList: BoardList | null = null;

    markLocalMutation([tempCardId]);
    const nextLists = boardListsRef.current.map((list) => {
      if (list.id !== input.listId) return list;
      optimisticList = { ...list, cards: [...list.cards, optimisticCard] };
      return optimisticList;
    });
    boardListsRef.current = nextLists;
    setBoardLists(nextLists);

    void tableroFacade.createBoardTaskCard({ ...input, position })
      .then((updatedList) => {
        if (!updatedList) return;
        const persistedCard = updatedList.cards.find((card) => card.position === position) ?? updatedList.cards.at(-1);
        markLocalMutation([updatedList.id, persistedCard?.id]);
        setBoardLists((currentLists) => {
          const mergedLists = currentLists.map((list) =>
            list.id === updatedList.id ? { ...updatedList, cards: mergeCardsPreservingOptimistic(list.cards.filter((card) => card.id !== tempCardId), updatedList.cards) } : list,
          );
          boardListsRef.current = mergedLists;
          return mergedLists;
        });
        trelloSocketClient.emitBoardChanged({ boardId: updatedList.boardId, scope: 'card', action: 'card_created', entityId: persistedCard?.id });
      })
      .catch((error) => {
        setBoardLists((currentLists) => {
          const rolledBackLists = currentLists.map((list) =>
            list.id === input.listId ? { ...list, cards: list.cards.filter((card) => card.id !== tempCardId) } : list,
          );
          boardListsRef.current = rolledBackLists;
          return rolledBackLists;
        });
        reportBackgroundError(error, 'No se pudo crear la tarjeta.');
      });

    return Promise.resolve(optimisticList);
  }, [markLocalMutation, reportBackgroundError]);


  const updateTaskCard = useCallback((listId: string, cardId: string, input: UpdateBoardTaskCardInput): Promise<BoardList | null> => {
    const now = new Date().toISOString();
    let optimisticList: BoardList | null = null;
    const rollback = applyBoardListsOptimistically((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== listId) return list;
        optimisticList = {
          ...list,
          cards: list.cards.map((card) =>
            card.id === cardId ? { ...card, ...input, updatedAt: now } : card,
          ),
        };
        return optimisticList;
      }),
    );

    markLocalMutation([cardId, listId]);
    void tableroFacade.updateBoardTaskCard(listId, cardId, input)
      .then((updatedList) => {
        if (!updatedList) return;
        setBoardLists((currentLists) => currentLists.map((list) => (list.id === updatedList.id ? updatedList : list)));
        trelloSocketClient.emitBoardChanged({ boardId: updatedList.boardId, scope: 'card', action: 'card_updated', entityId: cardId });
      })
      .catch((error) => {
        rollback();
        reportBackgroundError(error, 'No se pudo actualizar la tarjeta.');
      });

    return Promise.resolve(optimisticList);
  }, [applyBoardListsOptimistically, reportBackgroundError]);


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

  const deleteBoard = useCallback((boardId: string): Promise<void> => {
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

    markLocalMutation([boardId]);
    void tableroFacade.deleteBoard(boardId)
      .then(() => {
        trelloSocketClient.emitWorkspaceChanged({ workspaceId: previousBoards.find((board) => board.id === boardId)?.workspaceId, action: 'board_deleted', entityId: boardId });
        trelloSocketClient.emitBoardChanged({ boardId, scope: 'board', action: 'board_deleted', entityId: boardId });
      })
      .catch((error) => {
      setBoards(previousBoards);
      setBoardLists(previousLists);
      setSelectedBoardId(previousSelectedBoardId);
      setActiveView(previousActiveView);
      reportBackgroundError(error, 'No se pudo eliminar el tablero.');
    });

    return Promise.resolve();
  }, [activeView, boardLists, boards, reportBackgroundError, selectedBoardId]);


  const updateBoard = useCallback((boardId: string, input: UpdateBoardInput): Promise<Board | null> => {
    const previousBoards = boards;
    let optimisticBoard: Board | null = null;
    setBoards((currentBoards) =>
      currentBoards.map((board) => {
        if (board.id !== boardId) return board;
        optimisticBoard = { ...board, ...input, updatedAt: new Date().toISOString() };
        return optimisticBoard;
      }),
    );

    markLocalMutation([boardId]);
    void tableroFacade.updateBoard(boardId, input)
      .then((updatedBoard) => {
        if (!updatedBoard) return;
        setBoards((currentBoards) =>
          currentBoards.map((board) => (board.id === boardId ? updatedBoard : board)),
        );
        trelloSocketClient.emitBoardChanged({ boardId, workspaceId: updatedBoard.workspaceId, scope: 'board', action: 'board_updated', entityId: boardId });
        trelloSocketClient.emitWorkspaceChanged({ workspaceId: updatedBoard.workspaceId, action: 'board_updated', entityId: boardId });
      })
      .catch((error) => {
        setBoards(previousBoards);
        reportBackgroundError(error, 'No se pudo actualizar el tablero.');
      });

    return Promise.resolve(optimisticBoard);
  }, [boards, reportBackgroundError]);


  const updateBoardVisibility = useCallback(async (boardId: string, visibility: BoardVisibility) => {
    await updateBoard(boardId, { visibility });
  }, [updateBoard]);

  const updateWorkspaceVisibility = useCallback((workspaceId: string, visibility: WorkspaceVisibility): Promise<void> => {
    const previousWorkspaces = workspaces;
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.map((workspace) => (workspace.id === workspaceId ? { ...workspace, visibility } : workspace)),
    );

    markLocalMutation([workspaceId]);
    void tableroFacade.updateWorkspace(workspaceId, { visibility })
      .then((updatedWorkspace) => {
        if (!updatedWorkspace) return;
        setWorkspaces((currentWorkspaces) =>
          currentWorkspaces.map((workspace) => (workspace.id === workspaceId ? updatedWorkspace : workspace)),
        );
        trelloSocketClient.emitWorkspaceChanged({ workspaceId, action: 'workspace_updated' });
      })
      .catch((error) => {
        setWorkspaces(previousWorkspaces);
        reportBackgroundError(error, 'No se pudo actualizar el espacio.');
      });

    return Promise.resolve();
  }, [reportBackgroundError, workspaces]);


  const toggleWorkspaceExpanded = useCallback(async (workspaceId: string) => {
    const updatedWorkspaces = await tableroFacade.toggleWorkspaceExpanded(workspaceId);
    setWorkspaces(updatedWorkspaces);
  }, []);

  const sendBoardMessage = useCallback((boardId: string, message: string): Promise<void> => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return Promise.resolve();

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

    markLocalMutation([tempId]);
    void tableroFacade.sendBoardMessage(boardId, cleanMessage)
      .then((newMessage) => {
        setBoardMessages((currentMessages) => {
          const withoutTemp = currentMessages.filter((currentMessage) => currentMessage.id !== tempId);
          if (withoutTemp.some((currentMessage) => currentMessage.id === newMessage.id)) return withoutTemp;
          return [...withoutTemp, newMessage];
        });
        trelloSocketClient.emitBoardMessage({ boardId, scope: 'message', action: 'message_created', entityId: newMessage.id });
      })
      .catch((error) => {
        setBoardMessages((currentMessages) => currentMessages.filter((currentMessage) => currentMessage.id !== tempId));
        reportBackgroundError(error, 'No se pudo enviar el mensaje.');
      });

    return Promise.resolve();
  }, [members, reportBackgroundError]);


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
      currentUserMember,
      currentWorkspaceRole,
      canManageCurrentWorkspace,
      canManageSelectedBoard,
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
      updateWorkspaceMemberRole,
      updateBoardMemberRole,
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
      currentUserMember,
      currentWorkspaceRole,
      canManageCurrentWorkspace,
      canManageSelectedBoard,
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
      updateWorkspaceMemberRole,
      updateBoardMemberRole,
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
