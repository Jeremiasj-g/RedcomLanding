import {
  Archive,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  ChevronDown,
  Circle,
  Copy,
  Filter,
  Globe2,
  GripVertical,
  Pencil,
  Inbox,
  LayoutPanelLeft,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  SquarePlus,
  Star,
  Trash2,
  Tag,
  UserPlus,
  UserRoundPlus,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragCancelEvent, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import Editor, {
  BtnBold,
  BtnBulletList,
  BtnItalic,
  BtnLink,
  BtnNumberedList,
  Toolbar,
} from 'react-simple-wysiwyg';
import type { ContentEditableEvent } from 'react-simple-wysiwyg';
import { useBoards } from '../../context/BoardContext';
import type {
  Board,
  BoardLabelOption,
  BoardList,
  BoardPanel,
  BoardTaskActivity,
  BoardTaskCard,
  BoardTaskComment,
  BoardTaskChecklist,
  BoardTaskChecklistItem,
  ChatMessage,
  WorkspaceMember,
  UpdateBoardTaskCardInput,
} from '../../types/trello';
import { boardCovers, getBoardCoverStyle } from '../../utils/trelloDesignData';

const defaultBoardGradient = 'linear-gradient(135deg, #075985 0%, #0369a1 50%, #0f172a 100%)';

type SelectedTaskRef = {
  listId: string;
  cardId: string;
};

type DraggingCardState = {
  cardId: string;
  sourceListId: string;
};

type DraggingListState = {
  listId: string;
  sourceIndex: number;
};

type CardDropTarget = {
  listId: string;
  index: number;
};

type DndEntityData =
  | { type: 'card'; cardId: string; listId: string }
  | { type: 'list'; listId: string };

type ActiveDragState =
  | { type: 'card'; cardId: string; sourceListId: string }
  | { type: 'list'; listId: string; sourceIndex: number };

const cardDndPrefix = 'card:';
const listDndPrefix = 'list:';

function getCardSortableId(cardId: string) {
  return `${cardDndPrefix}${cardId}`;
}

function getListSortableId(listId: string) {
  return `${listDndPrefix}${listId}`;
}

function getSortableData(eventData: unknown): DndEntityData | null {
  if (!eventData || typeof eventData !== 'object') return null;
  const data = eventData as Partial<DndEntityData>;
  if (data.type === 'card' && typeof data.cardId === 'string' && typeof data.listId === 'string') {
    return { type: 'card', cardId: data.cardId, listId: data.listId };
  }
  if (data.type === 'list' && typeof data.listId === 'string') {
    return { type: 'list', listId: data.listId };
  }
  return null;
}

const avatarGradientClasses = [
  'from-[#ffb84d] to-[#f97316] text-[#1d1d1f]',
  'from-[#579dff] to-[#0c66e4] text-white',
  'from-[#4bce97] to-[#216e4e] text-[#092957]',
  'from-[#c084fc] to-[#7f3f98] text-white',
  'from-[#f87168] to-[#ae2e24] text-white',
  'from-[#e2b203] to-[#a66f00] text-[#172b4d]',
  'from-[#60c6d2] to-[#227d9b] text-[#092957]',
  'from-[#f797d2] to-[#9e4c84] text-[#172b4d]',
];

function getAvatarGradientClass(label: string) {
  const hash = [...label].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarGradientClasses[hash % avatarGradientClasses.length];
}

function Avatar({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-black shadow-[0_0_0_2px_rgba(255,255,255,.12)] ${getAvatarGradientClass(label)} ${className}`}
    >
      {label}
    </span>
  );
}

function formatRelativeDate(value?: string) {
  if (!value) return 'hace unos minutos';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffInMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffInMinutes < 60) return `hace ${diffInMinutes} minuto${diffInMinutes === 1 ? '' : 's'}`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `hace ${diffInHours} hora${diffInHours === 1 ? '' : 's'}`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `hace ${diffInDays} día${diffInDays === 1 ? '' : 's'}`;

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function shouldIgnoreNativeListDrag(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('button, input, textarea, select, a, [contenteditable="true"], [data-no-list-drag="true"]'),
  );
}

function createActivity(message: string): BoardTaskActivity {
  return {
    id: `activity-${crypto.randomUUID()}`,
    actorName: 'Jeremias Goytia',
    avatarText: 'JG',
    message,
    createdAt: new Date().toISOString(),
  };
}

function formatDateToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForField(value?: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function parseDateField(value: string): string {
  const cleanValue = value.trim();
  const match = cleanValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return '';

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return formatDateToInput(date);
}

const timeOptions = Array.from({ length: 30 }, (_, index) => {
  const totalMinutes = 9 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

function formatDateForTrello(value?: string, time?: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  const dateText = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return time ? `${dateText} a las ${time}` : dateText;
}

function dateFromInput(value?: string, fallback = new Date()): Date {
  if (!value) return fallback;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return fallback;
  return new Date(year, month - 1, day);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getChecklistProgress(checklists: BoardTaskChecklist[] = []) {
  const items = checklists.flatMap((checklist) => checklist.items ?? []);
  return {
    total: items.length,
    completed: items.filter((item) => item.completed).length,
  };
}

function findCardLocation(lists: BoardList[], cardId: string): { listId: string; listIndex: number; cardIndex: number; card: BoardTaskCard } | null {
  for (let listIndex = 0; listIndex < lists.length; listIndex += 1) {
    const cardIndex = lists[listIndex].cards.findIndex((card) => card.id === cardId);
    if (cardIndex !== -1) {
      return { listId: lists[listIndex].id, listIndex, cardIndex, card: lists[listIndex].cards[cardIndex] };
    }
  }
  return null;
}

function moveCardInLists(lists: BoardList[], cardId: string, targetListId: string, rawTargetIndex: number): BoardList[] {
  const source = findCardLocation(lists, cardId);
  const targetListIndex = lists.findIndex((list) => list.id === targetListId);
  if (!source || targetListIndex === -1) return lists;

  const nextLists = lists.map((list) => ({ ...list, cards: [...list.cards] }));
  const [movedCard] = nextLists[source.listIndex].cards.splice(source.cardIndex, 1);
  const targetCards = nextLists[targetListIndex].cards;
  const targetIndex = source.listId === targetListId && rawTargetIndex > source.cardIndex ? rawTargetIndex - 1 : rawTargetIndex;
  const safeTargetIndex = Math.max(0, Math.min(targetIndex, targetCards.length));

  targetCards.splice(safeTargetIndex, 0, movedCard);
  return nextLists;
}

function moveListInLists(lists: BoardList[], listId: string, rawTargetIndex: number): BoardList[] {
  const sourceIndex = lists.findIndex((list) => list.id === listId);
  if (sourceIndex === -1) return lists;

  const nextLists = [...lists];
  const [movedList] = nextLists.splice(sourceIndex, 1);
  const targetIndex = rawTargetIndex > sourceIndex ? rawTargetIndex - 1 : rawTargetIndex;
  const safeTargetIndex = Math.max(0, Math.min(targetIndex, nextLists.length));

  nextLists.splice(safeTargetIndex, 0, movedList);
  return nextLists;
}

function getCardInsertIndex(event: DragOverEvent | DragEndEvent, targetCards: BoardTaskCard[], overCardId: string): number {
  const overIndex = targetCards.findIndex((card) => card.id === overCardId);
  if (overIndex === -1) return targetCards.length;

  const translatedTop = event.active.rect.current.translated?.top;
  const overTop = event.over?.rect.top ?? 0;
  const overHeight = event.over?.rect.height ?? 0;
  const shouldInsertAfter = typeof translatedTop === 'number' && translatedTop > overTop + overHeight / 2;

  return overIndex + (shouldInsertAfter ? 1 : 0);
}

function getListInsertIndex(event: DragOverEvent | DragEndEvent, targetLists: BoardList[], overListId: string): number {
  const overIndex = targetLists.findIndex((list) => list.id === overListId);
  if (overIndex === -1) return targetLists.length;

  const translatedLeft = event.active.rect.current.translated?.left;
  const overLeft = event.over?.rect.left ?? 0;
  const overWidth = event.over?.rect.width ?? 0;
  const shouldInsertAfter = typeof translatedLeft === 'number' && translatedLeft > overLeft + overWidth / 2;

  return overIndex + (shouldInsertAfter ? 1 : 0);
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`flex gap-2 ${message.isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      {!message.isCurrentUser && <Avatar label={message.avatarText} className="h-7 w-7 text-[10px]" />}
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${
          message.isCurrentUser
            ? 'rounded-br-md bg-[#579dff] text-[#092957]'
            : 'rounded-bl-md bg-white/10 text-[#eef1f7]'
        }`}
      >
        {!message.isCurrentUser && <p className="mb-1 text-[11px] font-bold text-[#a9c7ff]">{message.senderName}</p>}
        <p className="text-sm leading-snug">{message.message}</p>
        <p className={`mt-1 text-right text-[10px] ${message.isCurrentUser ? 'text-[#123d72]' : 'text-[#9fa6b4]'}`}>
          {message.sentAt}
        </p>
      </div>
    </div>
  );
}

function InboxChatPanel({ messages, members = [], compact = false, onSend }: { messages: ChatMessage[]; members?: WorkspaceMember[]; compact?: boolean; onSend: (message: string) => Promise<void> }) {
  const [draft, setDraft] = useState('');

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden border-[#3b4048] bg-[#101204]/95 text-[#d7d9df] shadow-2xl backdrop-blur ${
        compact ? 'rounded-2xl border' : 'h-full rounded-2xl border'
      }`}
    >
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1f2024] text-[#b6c2cf] ring-1 ring-white/10">
            <Inbox size={19} />
          </span>
          <div>
            <h2 className="text-lg font-black text-white">Bandeja de entrada</h2>
            <p className="mt-1 text-xs leading-snug text-[#aeb6c2]">Chat interno conectado a Supabase y listo para Realtime.</p>
          </div>
        </div>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[#c6d4e8] transition hover:bg-white/10" type="button">
          <MoreHorizontal size={19} />
        </button>
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <div className="rounded-2xl bg-[#1f2024]/90 p-3 ring-1 ring-white/10">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#85b8ff]">Usuarios activos</p>
          <div className="flex items-center gap-2">
            {members.slice(0, 6).map((member) => (
              <Avatar key={member.id} label={member.avatarText} />
            ))}
            <span className="ml-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/20">
              {members.length} miembros
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length > 0 ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[.04] p-5 text-center text-sm text-[#aeb6c2]">
            Todavía no hay mensajes en este tablero. Escribí el primero para iniciar la conversación.
          </div>
        )}
      </div>

      <form
        className="border-t border-white/10 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const cleanDraft = draft.trim();
          if (!cleanDraft) return;
          void onSend(cleanDraft).then(() => setDraft(''));
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-[#1f2024] px-3 py-2 ring-1 ring-white/10 focus-within:ring-[#579dff]">
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#9fa8b7]"
            placeholder="Escribí un mensaje..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            className="grid h-9 w-9 place-items-center rounded-xl bg-[#579dff] text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!draft.trim()}
            aria-label="Enviar mensaje"
          >
            <Send size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}

function BoardTask({
  card,
  onOpen,
  onToggleCompleted,
  isDragging = false,
  labelOptions,
}: {
  card: BoardTaskCard;
  onOpen: () => void;
  onToggleCompleted: () => void;
  isDragging?: boolean;
  labelOptions: BoardLabelOption[];
}) {
  const selectedLabelOptions = labelOptions.filter((label) => (card.labels ?? []).includes(label.id));
  const checklistProgress = getChecklistProgress(card.checklists ?? []);
  const cardMembers = card.members ?? [];
  const hasFooter = checklistProgress.total > 0 || cardMembers.length > 0 || Boolean(card.dueDateEnabled && card.dueDate);

  return (
    <article
      className={`group/card relative min-h-[40px] cursor-grab overflow-hidden rounded-lg bg-[#22252b] px-3 py-2 text-[#dfe3ea] shadow-[0_1px_0_rgba(255,255,255,.06),0_2px_6px_rgba(0,0,0,.28)] transition hover:bg-[#292d34] active:cursor-grabbing ${
        isDragging ? 'scale-[.975] opacity-30' : ''
      }`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
    >
      {selectedLabelOptions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedLabelOptions.slice(0, 4).map((label) => (
            <span
              key={label.id}
              className="h-2 w-12 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-1.5">
        <button
          className={`mt-0.5 grid h-5 shrink-0 place-items-center text-[#b6c2cf] transition-all duration-150 ${
            card.completed ? 'w-5 opacity-100' : 'w-0 opacity-0 group-hover/card:w-5 group-hover/card:opacity-100'
          }`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCompleted();
          }}
          aria-label={card.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
          onPointerDown={(event) => event.stopPropagation()}
          data-no-list-drag="true"
        >
          {card.completed ? <CheckCircle2 size={18} className="text-[#4bce97]" /> : <Circle size={18} />}
        </button>

        <p
          className={`min-w-0 flex-1 truncate text-[15px] leading-snug ${card.completed ? 'text-[#9ca3af] line-through' : 'text-[#dfe3ea]'}`}
          title={card.title}
        >
          {card.title}
        </p>
      </div>

      {hasFooter && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-[#b6c2cf]">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {card.dueDateEnabled && card.dueDate && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-1 transition group-hover/card:bg-white/5">
                <Clock3 size={14} />
                {formatDateForTrello(card.dueDate, card.dueTime)}
              </span>
            )}
            {checklistProgress.total > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-1 ${
                  checklistProgress.completed === checklistProgress.total
                    ? 'bg-[#1f6f4a] text-[#baf3db]'
                    : 'text-[#b6c2cf]'
                }`}
                title="Total de elementos de todos los checklists"
              >
                <CheckSquare2 size={14} />
                {checklistProgress.completed}/{checklistProgress.total}
              </span>
            )}
          </div>

          {cardMembers.length > 0 && (
            <div className="ml-auto flex shrink-0 -space-x-1">
              {cardMembers.slice(0, 4).map((memberText) => (
                <Avatar key={memberText} label={memberText} className="h-7 w-7 text-[10px]" />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SortableBoardTask({
  listId,
  card,
  onOpen,
  onToggleCompleted,
  labelOptions,
}: {
  listId: string;
  card: BoardTaskCard;
  onOpen: () => void;
  onToggleCompleted: () => void;
  labelOptions: BoardLabelOption[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getCardSortableId(card.id),
    data: { type: 'card', cardId: card.id, listId } satisfies DndEntityData,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="py-1"
      {...(attributes as unknown as Record<string, unknown>)}
      {...(listeners as Record<string, unknown>)}
    >
      <BoardTask
        card={card}
        isDragging={isDragging}
        labelOptions={labelOptions}
        onOpen={onOpen}
        onToggleCompleted={onToggleCompleted}
      />
    </div>
  );
}

function BoardTaskDragPreview({ card, labelOptions }: { card: BoardTaskCard; labelOptions: BoardLabelOption[] }) {
  return (
    <div className="w-[276px] rotate-[1.5deg] opacity-80 shadow-2xl">
      <BoardTask card={card} labelOptions={labelOptions} onOpen={() => undefined} onToggleCompleted={() => undefined} />
    </div>
  );
}

function BoardListDragPreview({ list }: { list: BoardList }) {
  return (
    <div className="w-[300px] rotate-[1deg] rounded-xl bg-[#101204]/95 p-3 text-[#dfe3ea] opacity-80 shadow-2xl ring-2 ring-[#579dff]/60 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="truncate text-[15px] font-black text-[#f1f2f4]">{list.title}</p>
        <span className="text-base font-medium text-[#b6c2cf]">{list.cards.length}</span>
      </div>
      <div className="space-y-2">
        {list.cards.slice(0, 5).map((card) => (
          <div key={card.id} className="rounded-lg bg-[#22252b] px-3 py-2 text-sm font-semibold text-[#dfe3ea] shadow-sm">
            {card.title}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddCardComposer({ listId, onCreate }: { listId: string; onCreate: (listId: string, title: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const submitCard = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setTitle('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    void onCreate(listId, cleanTitle).catch((error) => {
      console.error('[Tableros] No se pudo crear la tarjeta', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo crear la tarjeta.');
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitCard();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitCard();
    }
  };

  if (!isOpen) {
    return (
      <button
        className="mt-3 flex h-9 w-full items-center justify-between rounded-lg px-2 text-sm font-semibold text-[#aab0bb] transition hover:bg-white/10 hover:text-white"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <span className="inline-flex items-center gap-2">
          <Plus size={17} />
          Añade una tarjeta
        </span>
        <SquarePlus size={16} />
      </button>
    );
  }

  return (
    <form className="mt-2 space-y-2" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="min-h-[74px] w-full resize-none rounded-lg border-0 bg-[#22252b] px-3 py-2 text-[15px] leading-relaxed text-[#f1f2f4] outline-none placeholder:text-[#a6adbb] shadow-[inset_0_0_0_1px_rgba(255,255,255,.03),0_1px_1px_rgba(0,0,0,.3)] focus:shadow-[inset_0_0_0_2px_#579dff]"
        placeholder="Introduce un título o pega un enlace"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center gap-2">
        <button
          className="min-h-10 rounded bg-[#579dff] px-4 py-2 text-sm font-bold text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={!title.trim()}
        >
          Añadir tarjeta
        </button>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded bg-[#5b2a78] px-4 py-2 text-sm font-bold text-[#f1d6ff] transition hover:bg-[#6f3590]"
          type="button"
        >
          <Lightbulb size={17} />
          Consejo
        </button>
        <button
          className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-[#b6c2cf] transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={() => {
            setTitle('');
            setIsOpen(false);
          }}
          aria-label="Cancelar tarjeta"
        >
          <X size={24} />
        </button>
      </div>
    </form>
  );
}


function AddListComposer({ boardId, onCreate }: { boardId: string; onCreate: (boardId: string, title: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const submitList = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setTitle('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
    void onCreate(boardId, cleanTitle).catch((error) => {
      console.error('[Tableros] No se pudo crear la lista', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo crear la lista.');
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitList();
  };

  if (!isOpen) {
    return (
      <button
        className="flex h-12 w-[290px] shrink-0 items-center gap-2 rounded-xl bg-[#579dff]/70 px-4 text-base font-bold text-white shadow-xl ring-1 ring-white/10 backdrop-blur transition hover:bg-[#579dff]/85"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <Plus size={19} />
        Añade una lista
      </button>
    );
  }

  return (
    <form className="w-[300px] shrink-0 rounded-xl bg-[#101204]/95 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="h-9 w-full rounded border border-[#85b8ff] bg-transparent px-3 text-[15px] font-semibold text-[#f1f2f4] outline-none placeholder:text-[#a6adbb] shadow-[inset_0_0_0_1px_#579dff]"
        placeholder="Introduce el nombre de la lista..."
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          className="rounded bg-[#579dff] px-4 py-2 text-sm font-bold text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={!title.trim()}
        >
          Añadir lista
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg text-[#b6c2cf] transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={() => {
            setTitle('');
            setIsOpen(false);
          }}
          aria-label="Cancelar lista"
        >
          <X size={24} />
        </button>
      </div>
    </form>
  );
}


type CardPopover = 'add' | 'labels' | 'dates' | 'checklist' | 'members' | null;

type FloatingPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

function getPopoverWidth(className: string) {
  if (className.includes('360')) return 360;
  if (className.includes('335')) return 335;
  if (className.includes('330')) return 330;
  return 340;
}

function getFloatingPosition(anchor: HTMLElement | null | undefined, popover: HTMLElement | null, className: string): FloatingPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = Math.max(360, window.innerHeight - 86);
  const margin = 14;
  const gap = 8;
  const estimatedWidth = getPopoverWidth(className);
  const popoverWidth = popover?.offsetWidth || estimatedWidth;
  const naturalHeight = popover?.scrollHeight || 420;
  const maxAvailableHeight = Math.max(260, viewportHeight - margin * 2);
  const popoverHeight = Math.min(naturalHeight, maxAvailableHeight);

  if (!anchor) {
    return {
      top: margin,
      left: Math.max(margin, Math.min(120, viewportWidth - popoverWidth - margin)),
      maxHeight: maxAvailableHeight,
    };
  }

  const rect = anchor.getBoundingClientRect();
  const spaceBelow = viewportHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const shouldOpenAbove = spaceBelow < Math.min(popoverHeight, 340) && spaceAbove > spaceBelow;
  const availableHeight = Math.max(220, shouldOpenAbove ? spaceAbove - gap : spaceBelow - gap);
  const maxHeight = Math.min(maxAvailableHeight, availableHeight);

  let top = shouldOpenAbove
    ? rect.top - Math.min(popoverHeight, maxHeight) - gap
    : rect.bottom + gap;

  if (top + Math.min(popoverHeight, maxHeight) > viewportHeight - margin) {
    top = viewportHeight - Math.min(popoverHeight, maxHeight) - margin;
  }
  if (top < margin) top = margin;

  let left = rect.left;
  if (left + popoverWidth > viewportWidth - margin) {
    left = viewportWidth - popoverWidth - margin;
  }
  if (left < margin) left = margin;

  return { top, left, maxHeight };
}

function PopoverShell({
  title,
  onClose,
  children,
  anchorRef,
  className = 'w-[340px]',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  anchorRef?: RefObject<HTMLElement>;
  className?: string;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
    let frameId = 0;

    const updatePosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setPosition(getFloatingPosition(anchorRef?.current, popoverRef.current, className));
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, className, children]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsidePopover = popoverRef.current?.contains(target);
      const clickedInsideAnchor = anchorRef?.current?.contains(target);

      if (!clickedInsidePopover && !clickedInsideAnchor) {
        onClose();
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      className={`fixed z-[160] overflow-y-auto overflow-x-hidden rounded-lg border border-[#3b4048] bg-[#282a2f] p-3 text-[#d7dce5] shadow-[0_16px_48px_rgba(0,0,0,.65)] ${className}`}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight ?? 'calc(100dvh - 28px)',
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="mb-3 grid grid-cols-[32px_minmax(0,1fr)_32px] items-center">
        <span />
        <h3 className="text-center text-sm font-black text-[#c9d0dc]">{title}</h3>
        <button
          className="grid h-8 w-8 place-items-center rounded text-[#b8c0cc] transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}

function EditableBoardListTitle({
  title,
  onSave,
  editSignal = 0,
}: {
  title: string;
  onSave: (title: string) => Promise<void>;
  editSignal?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setDraft(title), [title]);
  useEffect(() => {
    if (editing) window.setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  useEffect(() => {
    if (editSignal > 0) setEditing(true);
  }, [editSignal]);

  const save = async () => {
    const cleanTitle = draft.trim();
    if (!cleanTitle) {
      window.alert('El nombre de la lista no puede quedar vacío.');
      setDraft(title);
      setEditing(false);
      return;
    }

    if (cleanTitle !== title) await onSave(cleanTitle);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="min-w-0 flex-1 rounded border border-[#85b8ff] bg-[#22252b] px-2 py-1 text-[15px] font-black text-[#f1f2f4] outline-none ring-1 ring-[#579dff]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save();
          if (event.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className="min-w-0 max-w-[168px] flex-1 truncate rounded px-1 py-1 text-left text-[15px] font-black text-[#f1f2f4] transition hover:bg-white/10"
      type="button"
      onClick={() => setEditing(true)}
      title={title}
    >
      {title}
    </button>
  );
}

function BoardListOptionsPopover({
  list,
  onClose,
  onRename,
  onDelete,
  onEmptyList,
  onSort,
  anchorRef,
}: {
  list: BoardList;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEmptyList: () => void;
  onSort: (sortBy: 'name' | 'newest' | 'oldest') => void;
  anchorRef?: RefObject<HTMLElement>;
}) {
  return (
    <PopoverShell title="Opciones de la lista" onClose={onClose} anchorRef={anchorRef} className="w-[300px]">
      <div className="space-y-1">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10" type="button" onClick={onRename}>
          <Pencil size={16} />
          Editar nombre
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10" type="button" onClick={onEmptyList}>
          <Archive size={16} />
          Vaciar lista
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-200 transition hover:bg-red-500/15" type="button" onClick={onDelete}>
          <Trash2 size={16} />
          Eliminar lista
        </button>
      </div>

      <div className="mt-3 border-t border-[#3b4048] pt-3">
        <p className="mb-2 px-3 text-xs font-black uppercase text-[#aeb6c2]">Ordenar tarjetas</p>
        <div className="space-y-1">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10" type="button" onClick={() => onSort('name')}>Por nombre</button>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10" type="button" onClick={() => onSort('newest')}>Más recientes primero</button>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10" type="button" onClick={() => onSort('oldest')}>Más antiguas primero</button>
        </div>
      </div>
    </PopoverShell>
  );
}

function BoardListColumn({
  list,
  isListDragging = false,
  onCreateCard,
  onOpenCard,
  onToggleCard,
  onRenameList,
  onDeleteList,
  onEmptyList,
  onSortListCards,
  labelOptions,
  selectionMode = false,
  isSelectedForDelete = false,
  onToggleSelectedForDelete,
  sortableRef,
  sortableStyle,
  sortableAttributes,
  sortableListeners,
}: {
  list: BoardList;
  isListDragging?: boolean;
  onCreateCard: (listId: string, title: string) => Promise<void>;
  onOpenCard: (listId: string, cardId: string) => void;
  onToggleCard: (listId: string, card: BoardTaskCard) => Promise<void>;
  onRenameList: (listId: string, title: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onEmptyList: (listId: string) => Promise<void>;
  onSortListCards: (listId: string, sortBy: 'name' | 'newest' | 'oldest') => Promise<void>;
  labelOptions: BoardLabelOption[];
  selectionMode?: boolean;
  isSelectedForDelete?: boolean;
  onToggleSelectedForDelete?: (listId: string) => void;
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: CSSProperties;
  sortableAttributes?: Record<string, unknown>;
  sortableListeners?: Record<string, unknown>;
}) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [forceRename, setForceRename] = useState(0);
  const optionsButtonRef = useRef<HTMLDivElement | null>(null);

  const handleDelete = () => {
    const confirmed = window.confirm(`¿Querés eliminar la lista "${list.title}" y todas sus tarjetas? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setIsOptionsOpen(false);
    void onDeleteList(list.id).catch((error) => {
      console.error('[Tableros] No se pudo eliminar lista', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo eliminar la lista.');
    });
  };

  const handleEmptyList = () => {
    if (list.cards.length === 0) {
      window.alert('Esta lista ya está vacía.');
      setIsOptionsOpen(false);
      return;
    }

    const confirmed = window.confirm(`¿Querés vaciar la lista "${list.title}"? Se eliminarán ${list.cards.length} tarjeta${list.cards.length === 1 ? '' : 's'}.`);
    if (!confirmed) return;
    setIsOptionsOpen(false);
    void onEmptyList(list.id).catch((error) => {
      console.error('[Tableros] No se pudo vaciar lista', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo vaciar la lista.');
    });
  };

  return (
    <section
      ref={sortableRef}
      style={sortableStyle}
      className={`group/list flex max-h-[calc(100dvh-180px)] w-[300px] shrink-0 cursor-grab flex-col rounded-xl bg-[#101204]/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur transition-all duration-150 active:cursor-grabbing ${
        isListDragging ? 'scale-[.99] opacity-35' : ''
      }`}
      {...sortableAttributes}
      {...sortableListeners}
    >
      <div className="mb-3 flex shrink-0 items-center gap-2 px-1">
        {selectionMode && (
          <button
            className={`grid h-7 w-7 shrink-0 place-items-center rounded border transition ${
              isSelectedForDelete
                ? 'border-[#579dff] bg-[#579dff] text-[#092957]'
                : 'border-[#6b7280] bg-white/[.04] text-[#aeb6c2] hover:border-[#85b8ff] hover:text-white'
            }`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelectedForDelete?.(list.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={isSelectedForDelete ? 'Quitar lista de selección' : 'Marcar lista para eliminar'}
            data-no-list-drag="true"
          >
            {isSelectedForDelete && <Check size={15} />}
          </button>
        )}
        <span
          className="grid h-7 w-6 shrink-0 place-items-center rounded text-[#8f98a8] transition group-hover/list:bg-white/10 group-hover/list:text-white"
          aria-hidden="true"
        >
          <GripVertical size={16} />
        </span>
        <div className="min-w-0 flex-1" onPointerDown={(event) => event.stopPropagation()}>
          <EditableBoardListTitle
            title={list.title}
            editSignal={forceRename}
            onSave={(title) => onRenameList(list.id, title)}
          />
        </div>
        <span className="text-base font-medium text-[#b6c2cf]">{list.cards.length}</span>
        <div ref={optionsButtonRef} className="relative" data-no-list-drag="true" onPointerDown={(event) => event.stopPropagation()}>
          <button className="grid h-8 w-8 place-items-center rounded-lg text-[#aab0bb] transition hover:bg-white/10" type="button" onClick={() => setIsOptionsOpen((current) => !current)}>
            <MoreHorizontal size={18} />
          </button>
          {isOptionsOpen && (
            <BoardListOptionsPopover
              list={list}
              onClose={() => setIsOptionsOpen(false)}
              onRename={() => {
                setIsOptionsOpen(false);
                setForceRename((current) => current + 1);
              }}
              onDelete={() => void handleDelete()}
              onEmptyList={() => void handleEmptyList()}
              onSort={(sortBy) => {
                setIsOptionsOpen(false);
                void onSortListCards(list.id, sortBy);
              }}
              anchorRef={optionsButtonRef}
            />
          )}
        </div>
      </div>

      <SortableContext items={list.cards.map((card) => getCardSortableId(card.id))} strategy={verticalListSortingStrategy}>
        <div className="min-h-[48px] flex-1 overflow-y-auto pr-1">
          {list.cards.map((card) => (
            <SortableBoardTask
              key={card.id}
              listId={list.id}
              card={card}
              onOpen={() => onOpenCard(list.id, card.id)}
              onToggleCompleted={() => onToggleCard(list.id, card)}
              labelOptions={labelOptions}
            />
          ))}
        </div>
      </SortableContext>

      <div className="shrink-0" data-no-list-drag="true" onPointerDown={(event) => event.stopPropagation()}>
        <AddCardComposer listId={list.id} onCreate={onCreateCard} />
      </div>
    </section>
  );
}

function SortableBoardListColumn(props: Omit<Parameters<typeof BoardListColumn>[0], 'sortableRef' | 'sortableStyle' | 'sortableAttributes' | 'sortableListeners' | 'isListDragging'> & { isListDragging?: boolean }) {
  const { list, isListDragging = false } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getListSortableId(list.id),
    data: { type: 'list', listId: list.id } satisfies DndEntityData,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <BoardListColumn
      {...props}
      isListDragging={isListDragging || isDragging}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableAttributes={attributes as unknown as Record<string, unknown>}
      sortableListeners={listeners as Record<string, unknown>}
    />
  );
}

function AddToCardPopover({
  onClose,
  onSelect,
  anchorRef,
}: {
  onClose: () => void;
  onSelect: (popover: Exclude<CardPopover, null>) => void;
  anchorRef?: RefObject<HTMLElement>;
}) {
  const items: Array<{ icon: LucideIcon; title: string; description: string; panel: Exclude<CardPopover, null> }> = [
    { icon: Tag, title: 'Etiquetas', description: 'Organizar, categorizar y priorizar', panel: 'labels' },
    { icon: Clock3, title: 'Fechas', description: 'Fechas de inicio, fechas de vencimiento y recordatorios', panel: 'dates' },
    { icon: CheckSquare2, title: 'Checklist', description: 'Añadir subtareas', panel: 'checklist' },
    { icon: UsersRound, title: 'Miembros', description: 'Asignar miembros', panel: 'members' },
    { icon: Paperclip, title: 'Adjunto', description: 'Añade enlaces, páginas, actividades y más', panel: 'add' },
    { icon: LayoutPanelLeft, title: 'Campos personalizados', description: 'Crear tus propios campos', panel: 'add' },
  ];

  return (
    <PopoverShell title="Añadir a la tarjeta" onClose={onClose} anchorRef={anchorRef} className="w-[335px]">
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const disabled = item.title === 'Adjunto' || item.title === 'Campos personalizados';
          return (
            <button
              key={item.title}
              className="grid w-full grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-lg p-2 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item.panel)}
            >
              <span className="grid h-10 w-10 place-items-center rounded border border-[#454a53] text-[#d1d6df]">
                <Icon size={19} />
              </span>
              <span>
                <span className="block text-base font-black text-[#d7dce5]">{item.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-[#aeb6c2]">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </PopoverShell>
  );
}

function LabelsPopover({
  selectedLabels,
  labelOptions,
  onToggleLabel,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  onClose,
  anchorRef,
}: {
  selectedLabels: string[];
  labelOptions: BoardLabelOption[];
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (name: string, color: string) => Promise<BoardLabelOption>;
  onUpdateLabel: (labelId: string, input: { name?: string; color?: string }) => Promise<BoardLabelOption | null>;
  onDeleteLabel: (labelId: string) => Promise<void>;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement>;
}) {
  const colorPresets = [
    '#216e4e', '#4bce97', '#7f5f01', '#e2b203', '#a54800', '#f97316',
    '#ae2e24', '#f87168', '#7f3f98', '#c084fc', '#0c66e4', '#579dff',
    '#5e4db2', '#9f8fef', '#227d9b', '#60c6d2', '#5f3811', '#94a3b8',
  ];
  const [query, setQuery] = useState('');
  const [editingLabel, setEditingLabel] = useState<BoardLabelOption | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(colorPresets[0]);
  const [saving, setSaving] = useState(false);

  const visibleLabels = labelOptions.filter((label) =>
    label.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const openCreateForm = () => {
    setEditingLabel(null);
    setIsCreating(true);
    setDraftName('');
    setDraftColor(colorPresets[0]);
  };

  const openEditForm = (label: BoardLabelOption) => {
    setIsCreating(false);
    setEditingLabel(label);
    setDraftName(label.name);
    setDraftColor(label.color);
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingLabel(null);
    setDraftName('');
    setDraftColor(colorPresets[0]);
  };

  const saveLabel = async () => {
    const cleanName = draftName.trim();
    if (!cleanName || saving) return;

    setSaving(true);
    try {
      if (editingLabel) {
        await onUpdateLabel(editingLabel.id, { name: cleanName, color: draftColor });
      } else {
        await onCreateLabel(cleanName, draftColor);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const deleteLabel = async () => {
    if (!editingLabel || saving) return;
    const confirmed = window.confirm(`¿Querés eliminar la etiqueta "${editingLabel.name}"? Se quitará de todas las tarjetas que la usen.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await onDeleteLabel(editingLabel.id);
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopoverShell title="Etiquetas" onClose={onClose} anchorRef={anchorRef} className="w-[340px]">
      <input
        className="mb-3 h-10 w-full rounded border border-[#7a818c] bg-[#1f2024] px-3 text-sm text-[#f1f2f4] outline-none placeholder:text-[#aeb6c2] focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
        placeholder="Buscar etiquetas..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {(isCreating || editingLabel) ? (
        <div className="rounded-lg border border-[#3b4048] bg-[#202126] p-3">
          <p className="mb-3 text-sm font-black text-[#dfe3ea]">
            {editingLabel ? 'Editar etiqueta' : 'Crear etiqueta nueva'}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-black text-[#aeb6c2]">Nombre</span>
            <input
              className="h-10 w-full rounded border border-[#7a818c] bg-[#17191c] px-3 text-sm text-[#f1f2f4] outline-none placeholder:text-[#8f96a3] focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
              placeholder="Nombre de etiqueta"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveLabel();
                if (event.key === 'Escape') closeForm();
              }}
              autoFocus
            />
          </label>
          <div className="mt-3">
            <p className="mb-2 text-xs font-black text-[#aeb6c2]">Color</p>
            <div className="grid grid-cols-6 gap-2">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  className={`h-8 rounded transition hover:brightness-110 ${draftColor === color ? 'ring-2 ring-[#85b8ff] ring-offset-2 ring-offset-[#202126]' : ''}`}
                  style={{ backgroundColor: color }}
                  type="button"
                  onClick={() => setDraftColor(color)}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              className="h-9 rounded bg-[#579dff] px-4 text-sm font-black text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!draftName.trim() || saving}
              onClick={() => void saveLabel()}
            >
              {saving ? 'Guardando...' : editingLabel ? 'Guardar' : 'Crear'}
            </button>
            <button
              className="h-9 rounded px-3 text-sm font-black text-[#aeb6c2] transition hover:bg-white/10 hover:text-white"
              type="button"
              onClick={closeForm}
            >
              Cancelar
            </button>
            {editingLabel && (
              <button
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded px-3 text-sm font-black text-[#f87168] transition hover:bg-[#44201d] hover:text-[#ffb4aa]"
                type="button"
                onClick={() => void deleteLabel()}
                disabled={saving}
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs font-black text-[#b8c0cc]">Etiquetas</p>
          <div className="space-y-2">
            {visibleLabels.map((label) => {
              const checked = selectedLabels.includes(label.id);
              return (
                <div key={label.id} className="grid grid-cols-[26px_minmax(0,1fr)_28px] items-center gap-2">
                  <button
                    className={`grid h-5 w-5 place-items-center rounded border transition ${
                      checked ? 'border-[#85b8ff] bg-[#579dff] text-[#092957]' : 'border-[#818895] bg-transparent'
                    }`}
                    type="button"
                    onClick={() => onToggleLabel(label.id)}
                    aria-label={checked ? 'Quitar etiqueta' : 'Agregar etiqueta'}
                  >
                    {checked && <Check size={14} />}
                  </button>
                  <button
                    className="h-9 rounded px-3 text-left text-sm font-bold text-white transition hover:brightness-110"
                    style={{ backgroundColor: label.color }}
                    type="button"
                    onClick={() => onToggleLabel(label.id)}
                  >
                    {label.name}
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded text-[#b8c0cc] transition hover:bg-white/10 hover:text-white"
                    type="button"
                    onClick={() => openEditForm(label)}
                    aria-label="Editar etiqueta"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              );
            })}
            {visibleLabels.length === 0 && (
              <p className="rounded bg-white/[.04] px-3 py-3 text-center text-sm text-[#aeb6c2]">No encontramos etiquetas.</p>
            )}
          </div>

          <button
            className="mt-4 h-10 w-full rounded border border-[#3d424b] bg-[#2d3036] text-sm font-black text-[#c9d0dc] transition hover:bg-[#363a42]"
            type="button"
            onClick={openCreateForm}
          >
            Crear una etiqueta nueva
          </button>
        </>
      )}
    </PopoverShell>
  );
}

function DatesPopover({
  card,
  onSave,
  onRemove,
  onClose,
  anchorRef,
}: {
  card: BoardTaskCard;
  onSave: (input: Pick<UpdateBoardTaskCardInput, 'startDate' | 'dueDate' | 'dueTime' | 'startDateEnabled' | 'dueDateEnabled' | 'periodicity'>) => void;
  onRemove: () => void;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement>;
}) {
  const today = useMemo(() => new Date(), []);
  const initialDueDate = card.dueDate || formatDateToInput(today);
  const [startDateEnabled, setStartDateEnabled] = useState(Boolean(card.startDateEnabled));
  const [dueDateEnabled, setDueDateEnabled] = useState(card.dueDateEnabled ?? true);
  const [startDate, setStartDate] = useState(card.startDate || '');
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [startDateText, setStartDateText] = useState(formatDateForField(card.startDate));
  const [dueDateText, setDueDateText] = useState(formatDateForField(initialDueDate));
  const [dueTime, setDueTime] = useState(card.dueTime || '09:59');
  const [periodicity, setPeriodicity] = useState(card.periodicity || 'Nunca');
  const [calendarDate, setCalendarDate] = useState(() => dateFromInput(initialDueDate, today));
  const timeListId = `time-options-${card.id}`;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = index - offset + 1;
    if (value < 1) return { day: previousMonthDays + value, current: false, date: new Date(year, month - 1, previousMonthDays + value) };
    if (value > daysInMonth) return { day: value - daysInMonth, current: false, date: new Date(year, month + 1, value - daysInMonth) };
    return { day: value, current: true, date: new Date(year, month, value) };
  });

  const syncDueDateText = (value: string) => {
    setDueDateText(value);
    const parsedDate = parseDateField(value);
    if (parsedDate) {
      setDueDate(parsedDate);
      setDueDateEnabled(true);
      setCalendarDate(dateFromInput(parsedDate, today));
    }
  };

  const syncStartDateText = (value: string) => {
    setStartDateText(value);
    const parsedDate = parseDateField(value);
    if (parsedDate) {
      setStartDate(parsedDate);
      setStartDateEnabled(true);
    }
  };

  const saveDates = () => {
    const parsedStartDate = startDateEnabled ? parseDateField(startDateText) || startDate : '';
    const parsedDueDate = dueDateEnabled ? parseDateField(dueDateText) || dueDate : '';

    onSave({
      startDate: parsedStartDate,
      dueDate: parsedDueDate,
      dueTime,
      startDateEnabled: Boolean(startDateEnabled && parsedStartDate),
      dueDateEnabled: Boolean(dueDateEnabled && parsedDueDate),
      periodicity,
    });
  };

  return (
    <PopoverShell title="Fechas" onClose={onClose} anchorRef={anchorRef} className="w-[340px]">
      <div className="px-1">
        <div className="mb-3 grid grid-cols-[32px_32px_minmax(0,1fr)_32px_32px] items-center text-[#aeb6c2]">
          <button className="grid h-8 w-8 place-items-center rounded hover:bg-white/10" type="button" onClick={() => setCalendarDate((current) => addMonths(current, -12))}>«</button>
          <button className="grid h-8 w-8 place-items-center rounded hover:bg-white/10" type="button" onClick={() => setCalendarDate((current) => addMonths(current, -1))}>‹</button>
          <h4 className="text-center text-base font-black capitalize text-[#d7dce5]">{monthName}</h4>
          <button className="grid h-8 w-8 place-items-center rounded hover:bg-white/10" type="button" onClick={() => setCalendarDate((current) => addMonths(current, 1))}>›</button>
          <button className="grid h-8 w-8 place-items-center rounded hover:bg-white/10" type="button" onClick={() => setCalendarDate((current) => addMonths(current, 12))}>»</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-[#aeb6c2]">
          {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((day) => (
            <span key={day} className="py-1">{day}</span>
          ))}
        </div>
        <div className="mb-5 grid grid-cols-7 gap-1 text-center text-sm font-semibold">
          {cells.map((cell, index) => {
            const dateValue = formatDateToInput(cell.date);
            const selected = dateValue === dueDate;
            const isToday = dateValue === formatDateToInput(today);
            return (
              <button
                key={`${cell.day}-${index}`}
                className={`h-9 rounded transition ${
                  selected
                    ? 'bg-[#1f3555] text-[#85b8ff] ring-1 ring-[#579dff]'
                    : cell.current
                      ? 'text-[#d7dce5] hover:bg-white/10'
                      : 'text-[#777f8c] hover:bg-white/5'
                } ${isToday && !selected ? 'text-[#85b8ff]' : ''}`}
                type="button"
                onClick={() => {
                  const nextDate = formatDateToInput(cell.date);
                  setDueDate(nextDate);
                  setDueDateText(formatDateForField(nextDate));
                  setDueDateEnabled(true);
                  setCalendarDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black text-[#aeb6c2]">Fecha de inicio</span>
            <span className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
              <input
                className="h-5 w-5 accent-[#579dff]"
                type="checkbox"
                checked={startDateEnabled}
                onChange={(event) => setStartDateEnabled(event.target.checked)}
              />
              <input
                className="h-10 min-w-0 rounded border border-[#7a818c] bg-[#202126] px-2 text-sm text-[#dfe3ea] outline-none placeholder:text-[#8f96a3] disabled:cursor-not-allowed disabled:bg-[#3a3d44] disabled:text-[#8f96a3]"
                placeholder="D/M/AAAA"
                value={startDateText}
                disabled={!startDateEnabled}
                onChange={(event) => syncStartDateText(event.target.value)}
                onBlur={() => {
                  const parsed = parseDateField(startDateText);
                  if (startDateText && parsed) setStartDateText(formatDateForField(parsed));
                }}
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black text-[#aeb6c2]">Fecha de vencimiento</span>
            <span className="grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
              <input
                className="h-5 w-5 accent-[#579dff]"
                type="checkbox"
                checked={dueDateEnabled}
                onChange={(event) => setDueDateEnabled(event.target.checked)}
              />
              <input
                className="h-10 min-w-0 rounded border border-[#7a818c] bg-[#202126] px-2 text-sm text-[#dfe3ea] outline-none placeholder:text-[#8f96a3] disabled:cursor-not-allowed disabled:bg-[#3a3d44] disabled:text-[#8f96a3]"
                placeholder="D/M/AAAA"
                value={dueDateText}
                disabled={!dueDateEnabled}
                onChange={(event) => syncDueDateText(event.target.value)}
                onBlur={() => {
                  const parsed = parseDateField(dueDateText);
                  if (dueDateText && parsed) setDueDateText(formatDateForField(parsed));
                }}
              />
              <input
                className="h-10 min-w-0 rounded border border-[#7a818c] bg-[#202126] px-2 text-sm text-[#dfe3ea] outline-none disabled:cursor-not-allowed disabled:bg-[#3a3d44] disabled:text-[#8f96a3]"
                list={timeListId}
                value={dueTime}
                disabled={!dueDateEnabled}
                onChange={(event) => setDueTime(event.target.value)}
              />
              <datalist id={timeListId}>
                {timeOptions.map((timeOption) => <option key={timeOption} value={timeOption} />)}
              </datalist>
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black text-[#aeb6c2]">Periódico</span>
            <select
              className="h-11 w-full rounded border border-[#7a818c] bg-[#202126] px-3 text-sm text-[#dfe3ea] outline-none focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
              value={periodicity}
              onChange={(event) => setPeriodicity(event.target.value)}
            >
              <option>Nunca</option>
              <option>Diario</option>
              <option>Semanal</option>
              <option>Mensual</option>
            </select>
          </label>
        </div>

        <button
          className="mt-5 h-10 w-full rounded bg-[#579dff] text-sm font-black text-[#092957] transition hover:bg-[#85b8ff]"
          type="button"
          onClick={saveDates}
        >
          Guardar
        </button>
        <button
          className="mt-2 h-10 w-full rounded border border-[#3d424b] bg-[#282a2f] text-sm font-black text-[#aeb6c2] transition hover:bg-[#343841] hover:text-white"
          type="button"
          onClick={onRemove}
        >
          Quitar
        </button>
      </div>
    </PopoverShell>
  );
}

function ChecklistPopover({
  checklists,
  onCreate,
  onClose,
  anchorRef,
}: {
  checklists: BoardTaskChecklist[];
  onCreate: (title: string, copyFromChecklistId?: string) => void;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement>;
}) {
  const [title, setTitle] = useState('Checklist');
  const [copyFromChecklistId, setCopyFromChecklistId] = useState(checklists[0]?.id ?? '');

  return (
    <PopoverShell title="Añadir checklist" onClose={onClose} anchorRef={anchorRef} className="w-[335px]">
      <label className="block">
        <span className="mb-1 block text-xs font-black text-[#aeb6c2]">Título</span>
        <input
          className="h-10 w-full rounded border border-[#85b8ff] bg-[#202126] px-3 text-sm font-semibold text-[#f1f2f4] outline-none ring-1 ring-[#579dff]"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-base font-black text-[#d7dce5]">Copiar elementos desde...</span>
        <select
          className="h-11 w-full rounded border border-[#7a818c] bg-[#202126] px-3 text-sm text-[#dfe3ea] outline-none focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
          value={copyFromChecklistId}
          onChange={(event) => setCopyFromChecklistId(event.target.value)}
        >
          <option value="">Ninguno</option>
          {checklists.map((checklist) => (
            <option key={checklist.id} value={checklist.id}>
              {checklist.title}
            </option>
          ))}
        </select>
      </label>

      <button
        className="mt-4 h-10 w-full rounded bg-[#579dff] text-sm font-black text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!title.trim()}
        onClick={() => onCreate(title, copyFromChecklistId || undefined)}
      >
        Añadir
      </button>
    </PopoverShell>
  );
}

function MembersPopover({
  selectedMembers,
  members,
  onToggleMember,
  onClose,
  anchorRef,
}: {
  selectedMembers: string[];
  members: WorkspaceMember[];
  onToggleMember: (memberText: string) => void;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement>;
}) {
  const [query, setQuery] = useState('');
  const filteredMembers = members.filter((member) =>
    `${member.fullName} ${member.username}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <PopoverShell title="Miembros" onClose={onClose} anchorRef={anchorRef} className="w-[330px]">
      <input
        className="mb-3 h-10 w-full rounded border border-[#7a818c] bg-[#1f2024] px-3 text-sm text-[#f1f2f4] outline-none placeholder:text-[#aeb6c2] focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
        placeholder="Buscar miembros..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="space-y-1">
        {filteredMembers.map((member) => {
          const selected = selectedMembers.includes(member.avatarText);
          return (
            <button
              key={member.id}
              className="grid w-full grid-cols-[34px_minmax(0,1fr)_24px] items-center gap-2 rounded px-2 py-2 text-left transition hover:bg-white/10"
              type="button"
              onClick={() => onToggleMember(member.avatarText)}
            >
              <Avatar label={member.avatarText} className="h-8 w-8" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[#dfe3ea]">{member.fullName}</span>
                <span className="block truncate text-xs text-[#aeb6c2]">@{member.username}</span>
              </span>
              {selected && <Check size={17} className="text-[#85b8ff]" />}
            </button>
          );
        })}
        {filteredMembers.length === 0 && (
          <p className="rounded-lg bg-white/[.04] px-3 py-3 text-center text-sm text-[#aeb6c2]">
            No hay miembros disponibles para asignar. Primero agregalos al tablero y, para subtareas, a esta tarjeta.
          </p>
        )}
      </div>
    </PopoverShell>
  );
}


function BoardShareModal({
  board,
  allMembers,
  selectedMemberIds,
  onToggleMember,
  onClose,
}: {
  board: Board;
  allMembers: WorkspaceMember[];
  selectedMemberIds: string[];
  onToggleMember: (memberId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const normalizedMembers = useMemo(() => {
    const byId = new Map<string, WorkspaceMember>();
    allMembers.forEach((member) => {
      if (!byId.has(member.id)) byId.set(member.id, member);
    });
    return Array.from(byId.values());
  }, [allMembers]);

  const typeOptions = useMemo(
    () => Array.from(new Set(normalizedMembers.map((member) => member.userTypeName || 'Sin tipo').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [normalizedMembers],
  );
  const branchOptions = useMemo(
    () => Array.from(new Set(normalizedMembers.map((member) => member.branch || 'Sin sucursal').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [normalizedMembers],
  );
  const roleOptions = useMemo(
    () => Array.from(new Set(normalizedMembers.map((member) => member.systemRole || 'Sin rol').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [normalizedMembers],
  );

  const cleanQuery = query.trim().toLowerCase();
  const filteredMembers = normalizedMembers.filter((member) => {
    const memberType = member.userTypeName || 'Sin tipo';
    const memberBranch = member.branch || 'Sin sucursal';
    const memberRole = member.systemRole || 'Sin rol';
    const matchesQuery = `${member.fullName} ${member.username} ${member.avatarText} ${memberType} ${memberBranch} ${memberRole}`
      .toLowerCase()
      .includes(cleanQuery);
    return (
      matchesQuery &&
      (typeFilter === 'all' || memberType === typeFilter) &&
      (branchFilter === 'all' || memberBranch === branchFilter) &&
      (roleFilter === 'all' || memberRole === roleFilter)
    );
  });

  const selectClass = 'h-10 min-w-0 rounded-lg border border-[#3b4048] bg-[#17191c] px-3 text-xs font-bold text-[#dfe3ea] outline-none focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]';

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-16 z-[180] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#3b4048] bg-[#1f2024] text-[#dfe3ea] shadow-[0_24px_80px_rgba(0,0,0,.75)]">
        <header className="flex items-start justify-between border-b border-[#32363d] px-5 py-4">
          <div>
            <h2 className="text-lg font-black">Compartir tablero</h2>
            <p className="mt-1 text-sm text-[#aeb6c2]">Invitá usuarios a <span className="font-bold text-[#dfe3ea]">{board.title}</span>.</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg text-[#b6c2cf] transition hover:bg-white/10 hover:text-white" type="button" onClick={onClose} aria-label="Cerrar compartir">
            <X size={22} />
          </button>
        </header>

        <div className="p-5">
          <input
            className="h-11 w-full rounded-lg border border-[#7a818c] bg-[#17191c] px-3 text-sm text-[#f1f2f4] outline-none placeholder:text-[#aeb6c2] focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
            placeholder="Buscar usuarios por nombre, usuario, tipo, sucursal o rol..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />

          <div className="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#9fadbc]">Tipo de usuario</span>
              <select className={selectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Todos</option>
                {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#9fadbc]">Sucursal</span>
              <select className={selectClass} value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                <option value="all">Todas</option>
                {branchOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#9fadbc]">Rol</span>
              <select className={selectClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">Todos</option>
                {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 max-h-[46dvh] space-y-1 overflow-y-auto pr-1">
            {filteredMembers.map((member) => {
              const selected = selectedMemberIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  className="grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
                  type="button"
                  onClick={() => onToggleMember(member.id)}
                >
                  <Avatar label={member.avatarText} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#f1f2f4]">{member.fullName}</span>
                    <span className="block truncate text-xs text-[#aeb6c2]">@{member.username}</span>
                    <span className="mt-1 block truncate text-[11px] text-[#8f99a8]">
                      {[member.userTypeName, member.branch, member.systemRole].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                    </span>
                  </span>
                  <span className={`rounded px-3 py-1.5 text-sm font-black transition ${selected ? 'bg-[#1f6f4a] text-[#baf3db]' : 'bg-[#579dff] text-[#092957]'}`}>
                    {selected ? 'Invitado' : 'Añadir'}
                  </span>
                </button>
              );
            })}
            {filteredMembers.length === 0 && (
              <p className="rounded-lg bg-white/[.04] px-3 py-4 text-center text-sm text-[#aeb6c2]">No se encontraron usuarios.</p>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function BoardOptionsPopover({
  board,
  listSelectionMode,
  onClose,
  onDeleteBoard,
  onEmptyBoard,
  onToggleListSelectionMode,
  onToggleFavorite,
  onChangeVisibility,
  onChangeCover,
  canManageBoard,
  anchorRef,
}: {
  board: Board;
  listSelectionMode: boolean;
  onClose: () => void;
  onDeleteBoard: () => void;
  onEmptyBoard: () => void;
  onToggleListSelectionMode: () => void;
  onToggleFavorite: () => void;
  onChangeVisibility: () => void;
  onChangeCover: (coverIndex: number) => void;
  canManageBoard: boolean;
  anchorRef?: RefObject<HTMLElement>;
}) {
  return (
    <PopoverShell title="Opciones del tablero" onClose={onClose} anchorRef={anchorRef} className="w-[335px]">
      <div className="space-y-1">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10" type="button" onClick={onToggleFavorite}>
          <Star size={17} className={board.favorite ? 'fill-[#e2b203] text-[#e2b203]' : ''} />
          {board.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!canManageBoard} onClick={onChangeVisibility}>
          {board.visibility === 'publico' ? <Globe2 size={17} /> : <LockKeyhole size={17} />}
          Visibilidad: {board.visibility === 'publico' ? 'Público' : 'Privado'}
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!canManageBoard} onClick={onEmptyBoard}>
          <Archive size={17} />
          Vaciar tablero
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#dfe3ea] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!canManageBoard} onClick={onToggleListSelectionMode}>
          <CheckSquare2 size={17} />
          {listSelectionMode ? 'Cancelar marcado de listas' : 'Marcar listas'}
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!canManageBoard} onClick={onDeleteBoard}>
          <Trash2 size={17} />
          Eliminar tablero
        </button>
      </div>

      <div className="mt-4 border-t border-[#3b4048] pt-4">
        <p className="mb-2 text-xs font-black uppercase text-[#aeb6c2]">Cambiar fondo</p>
        <div className="grid grid-cols-3 gap-2">
          {boardCovers.map((cover, index) => (
            <button
              key={`${cover.value}-${index}`}
              className="h-14 rounded-lg border border-white/10 shadow-inner transition hover:scale-[1.02] hover:ring-2 hover:ring-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-45"
              style={getBoardCoverStyle(cover, { contain: cover.value.startsWith('/trello-backgrounds/') })}
              type="button"
              disabled={!canManageBoard}
              onClick={() => onChangeCover(index)}
              aria-label={`Fondo ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </PopoverShell>
  );
}

function ChecklistItemsComposer({
  checklistId,
  members,
  onAddItem,
}: {
  checklistId: string;
  members: WorkspaceMember[];
  onAddItem: (
    checklistId: string,
    title: string,
    input?: Partial<Pick<BoardTaskChecklistItem, 'assignedTo' | 'dueDate' | 'dueTime' | 'dueDateEnabled'>>,
  ) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:59');
  const [activeMetaPopover, setActiveMetaPopover] = useState<'members' | 'dates' | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composerMembersRef = useRef<HTMLDivElement | null>(null);
  const composerDatesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const resetMeta = () => {
    setAssignedTo('');
    setDueDate('');
    setDueTime('09:59');
    setActiveMetaPopover(null);
  };

  const submit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    onAddItem(checklistId, cleanTitle, {
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      dueTime: dueDate ? dueTime : undefined,
      dueDateEnabled: Boolean(dueDate),
    });
    setTitle('');
    resetMeta();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const composerDateCard: BoardTaskCard = {
    id: `composer-date-${checklistId}`,
    title: 'Fecha del elemento',
    dueDate,
    dueTime,
    dueDateEnabled: Boolean(dueDate),
    labels: [],
    members: [],
    comments: [],
    activities: [],
    checklists: [],
  };

  if (!isOpen) {
    return (
      <button className="mt-3 rounded bg-[#32363d] px-3 py-2 text-sm font-black text-[#c9d0dc] transition hover:bg-[#3d424b]" type="button" onClick={() => setIsOpen(true)}>
        Añadir un elemento
      </button>
    );
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        className="h-10 w-full rounded border border-[#85b8ff] bg-[#22252b] px-3 text-sm text-[#f1f2f4] outline-none ring-1 ring-[#579dff] placeholder:text-[#a6adbb]"
        placeholder="Añade un elemento"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') {
            setTitle('');
            resetMeta();
            setIsOpen(false);
          }
        }}
      />

      {(assignedTo || dueDate) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#aeb6c2]">
          {assignedTo && (
            <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1">
              <UserPlus size={12} /> {assignedTo}
            </span>
          )}
          {dueDate && (
            <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1">
              <Clock3 size={12} /> {formatDateForTrello(dueDate, dueTime)}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="rounded bg-[#579dff] px-4 py-2 text-sm font-black text-[#092957] transition hover:bg-[#85b8ff] disabled:opacity-50" type="button" onClick={submit} disabled={!title.trim()}>
          Añadir
        </button>
        <button
          className="rounded px-2 py-2 text-sm font-black text-[#aeb6c2] transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={() => {
            setTitle('');
            resetMeta();
            setIsOpen(false);
          }}
        >
          Cancelar
        </button>
        <div ref={composerMembersRef} className="relative ml-auto">
          <button
            className={`inline-flex items-center gap-1 rounded px-2 py-2 text-sm font-semibold transition hover:bg-white/10 hover:text-white ${assignedTo ? 'text-[#85b8ff]' : 'text-[#aeb6c2]'}`}
            type="button"
            onClick={() => setActiveMetaPopover(activeMetaPopover === 'members' ? null : 'members')}
          >
            <UserPlus size={16} /> Asignar
          </button>
          {activeMetaPopover === 'members' && (
            <MembersPopover
              selectedMembers={assignedTo ? [assignedTo] : []}
              members={members}
              onToggleMember={(memberText) => {
                setAssignedTo((current) => (current === memberText ? '' : memberText));
                setActiveMetaPopover(null);
              }}
              onClose={() => setActiveMetaPopover(null)}
              anchorRef={composerMembersRef}
            />
          )}
        </div>
        <div ref={composerDatesRef} className="relative">
          <button
            className={`inline-flex items-center gap-1 rounded px-2 py-2 text-sm font-semibold transition hover:bg-white/10 hover:text-white ${dueDate ? 'text-[#85b8ff]' : 'text-[#aeb6c2]'}`}
            type="button"
            onClick={() => setActiveMetaPopover(activeMetaPopover === 'dates' ? null : 'dates')}
          >
            <CalendarClock size={16} /> Fecha de vencimiento
          </button>
          {activeMetaPopover === 'dates' && (
            <DatesPopover
              card={composerDateCard}
              onSave={(input) => {
                setDueDate(input.dueDateEnabled ? input.dueDate ?? '' : '');
                setDueTime(input.dueTime ?? '09:59');
                setActiveMetaPopover(null);
              }}
              onRemove={() => {
                setDueDate('');
                setDueTime('09:59');
                setActiveMetaPopover(null);
              }}
              onClose={() => setActiveMetaPopover(null)}
              anchorRef={composerDatesRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EditableChecklistTitle({
  checklist,
  onRenameChecklist,
}: {
  checklist: BoardTaskChecklist;
  onRenameChecklist: (checklistId: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(checklist.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(checklist.title);
  }, [checklist.title]);

  useEffect(() => {
    if (editing) window.setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  const save = () => {
    const cleanTitle = draft.trim();
    if (!cleanTitle) {
      setDraft(checklist.title);
      setEditing(false);
      return;
    }

    if (cleanTitle !== checklist.title) {
      onRenameChecklist(checklist.id, cleanTitle);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="min-w-0 flex-1 rounded border border-[#85b8ff] bg-[#22252b] px-2 py-1 text-lg font-black text-[#dfe3ea] outline-none ring-1 ring-[#579dff]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') {
            setDraft(checklist.title);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-lg font-black text-[#dfe3ea] transition hover:bg-white/10"
      type="button"
      onClick={() => setEditing(true)}
      title="Click para editar el checklist"
    >
      {checklist.title}
    </button>
  );
}

function ChecklistItemRow({
  checklistId,
  item,
  members,
  onUpdateItem,
  onToggleItem,
  onDeleteItem,
}: {
  checklistId: string;
  item: BoardTaskChecklistItem;
  members: WorkspaceMember[];
  onUpdateItem: (checklistId: string, itemId: string, input: Partial<Pick<BoardTaskChecklistItem, 'title' | 'assignedTo' | 'dueDate' | 'dueTime' | 'dueDateEnabled'>>) => void;
  onToggleItem: (checklistId: string, itemId: string) => void;
  onDeleteItem: (checklistId: string, itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [activeItemPopover, setActiveItemPopover] = useState<'members' | 'dates' | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemMembersRef = useRef<HTMLDivElement | null>(null);
  const itemDatesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(item.title);
  }, [item.title]);

  useEffect(() => {
    if (editing) window.setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  const saveTitle = () => {
    const cleanTitle = draft.trim();
    if (!cleanTitle) {
      window.alert('El elemento no puede quedar vacío. Para quitarlo usá el botón eliminar.');
      setDraft(item.title);
      setEditing(false);
      return;
    }

    if (cleanTitle !== item.title) {
      onUpdateItem(checklistId, item.id, { title: cleanTitle });
    }
    setEditing(false);
  };

  const itemDateCard: BoardTaskCard = {
    id: `checkitem-date-${item.id}`,
    title: item.title,
    dueDate: item.dueDate ?? '',
    dueTime: item.dueTime ?? '09:59',
    dueDateEnabled: item.dueDateEnabled ?? Boolean(item.dueDate),
    labels: [],
    members: [],
    comments: [],
    activities: [],
    checklists: [],
  };

  return (
    <div className="group/checkitem grid min-h-9 w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 text-left transition hover:bg-white/10">
      <button
        className={`grid h-5 w-5 place-items-center rounded border transition ${
          item.completed ? 'border-[#4bce97] bg-[#4bce97] text-[#0b1f17]' : 'border-[#9aa3b2] hover:border-[#dfe3ea]'
        }`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleItem(checklistId, item.id);
        }}
        aria-label={item.completed ? 'Marcar elemento como pendiente' : 'Marcar elemento como completado'}
      >
        {item.completed && <Check size={14} />}
      </button>

      <div className="min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            className="h-8 w-full rounded border border-[#85b8ff] bg-[#22252b] px-2 text-sm text-[#f1f2f4] outline-none ring-1 ring-[#579dff]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveTitle();
              if (event.key === 'Escape') {
                setDraft(item.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className={`block w-full rounded px-1 py-1 text-left text-sm transition hover:bg-white/5 ${
              item.completed ? 'text-[#9fa8b7] line-through' : 'text-[#dfe3ea]'
            }`}
            type="button"
            onClick={() => setEditing(true)}
            title="Click para editar el elemento"
          >
            {item.title}
          </button>
        )}

        {(item.assignedTo || item.dueDate) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[11px] font-bold text-[#aeb6c2]">
            {item.assignedTo && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5">
                <UserPlus size={12} /> {item.assignedTo}
              </span>
            )}
            {item.dueDate && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5">
                <Clock3 size={12} /> {formatDateForTrello(item.dueDate, item.dueTime)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 transition group-hover/checkitem:opacity-100">
        <div ref={itemDatesRef} className="relative">
          <button
            className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#3d424b] hover:text-white ${item.dueDate ? 'text-[#85b8ff]' : 'text-[#aeb6c2]'}`}
            type="button"
            onClick={() => setActiveItemPopover(activeItemPopover === 'dates' ? null : 'dates')}
            title="Agregar fecha de vencimiento"
          >
            <CalendarClock size={15} />
          </button>
          {activeItemPopover === 'dates' && (
            <DatesPopover
              card={itemDateCard}
              onSave={(input) => {
                onUpdateItem(checklistId, item.id, {
                  dueDate: input.dueDateEnabled ? input.dueDate : undefined,
                  dueTime: input.dueDateEnabled ? input.dueTime : undefined,
                  dueDateEnabled: Boolean(input.dueDateEnabled && input.dueDate),
                });
                setActiveItemPopover(null);
              }}
              onRemove={() => {
                onUpdateItem(checklistId, item.id, { dueDate: undefined, dueTime: undefined, dueDateEnabled: false });
                setActiveItemPopover(null);
              }}
              onClose={() => setActiveItemPopover(null)}
              anchorRef={itemDatesRef}
            />
          )}
        </div>
        <div ref={itemMembersRef} className="relative">
          <button
            className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[#3d424b] hover:text-white ${item.assignedTo ? 'text-[#85b8ff]' : 'text-[#aeb6c2]'}`}
            type="button"
            onClick={() => setActiveItemPopover(activeItemPopover === 'members' ? null : 'members')}
            title="Agregar miembro"
          >
            <UserPlus size={15} />
          </button>
          {activeItemPopover === 'members' && (
            <MembersPopover
              selectedMembers={item.assignedTo ? [item.assignedTo] : []}
              members={members}
              onToggleMember={(memberText) => {
                onUpdateItem(checklistId, item.id, { assignedTo: item.assignedTo === memberText ? undefined : memberText });
                setActiveItemPopover(null);
              }}
              onClose={() => setActiveItemPopover(null)}
              anchorRef={itemMembersRef}
            />
          )}
        </div>
        <button
          className="grid h-8 w-8 place-items-center rounded-lg text-[#aeb6c2] transition hover:bg-red-500/15 hover:text-red-200"
          type="button"
          onClick={() => onDeleteItem(checklistId, item.id)}
          title="Eliminar elemento"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function CardChecklistsSection({
  checklists,
  members,
  onDeleteChecklist,
  onRenameChecklist,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onDeleteItem,
}: {
  checklists: BoardTaskChecklist[];
  members: WorkspaceMember[];
  onDeleteChecklist: (checklistId: string) => void;
  onRenameChecklist: (checklistId: string, title: string) => void;
  onAddItem: (checklistId: string, title: string, input?: Partial<Pick<BoardTaskChecklistItem, 'assignedTo' | 'dueDate' | 'dueTime' | 'dueDateEnabled'>>) => void;
  onToggleItem: (checklistId: string, itemId: string) => void;
  onUpdateItem: (checklistId: string, itemId: string, input: Partial<Pick<BoardTaskChecklistItem, 'title' | 'assignedTo' | 'dueDate' | 'dueTime' | 'dueDateEnabled'>>) => void;
  onDeleteItem: (checklistId: string, itemId: string) => void;
}) {
  const [hiddenCompletedByChecklist, setHiddenCompletedByChecklist] = useState<Record<string, boolean>>({});

  if (checklists.length === 0) return null;

  return (
    <div className="mt-8 space-y-7">
      {checklists.map((checklist) => {
        const completedCount = checklist.items.filter((item) => item.completed).length;
        const progress = checklist.items.length > 0 ? Math.round((completedCount / checklist.items.length) * 100) : 0;
        const hideCompleted = Boolean(hiddenCompletedByChecklist[checklist.id]);
        const visibleItems = hideCompleted ? checklist.items.filter((item) => !item.completed) : checklist.items;

        return (
          <section key={checklist.id}>
            <div className="mb-3 flex items-center gap-4">
              <CheckSquare2 size={24} className="text-[#c5ccd7]" />
              <EditableChecklistTitle checklist={checklist} onRenameChecklist={onRenameChecklist} />
              {completedCount > 0 && (
                <button
                  className="rounded border border-[#3d424b] bg-[#282a2f] px-4 py-2 text-sm font-black text-[#aeb6c2] transition hover:bg-[#343841] hover:text-white"
                  type="button"
                  onClick={() =>
                    setHiddenCompletedByChecklist((current) => ({
                      ...current,
                      [checklist.id]: !current[checklist.id],
                    }))
                  }
                >
                  {hideCompleted ? 'Mostrar los elementos marcados' : 'Ocultar los elementos marcados'}
                </button>
              )}
              <button
                className="rounded border border-[#3d424b] bg-[#282a2f] px-4 py-2 text-sm font-black text-[#aeb6c2] transition hover:bg-red-500/15 hover:text-red-200"
                type="button"
                onClick={() => onDeleteChecklist(checklist.id)}
              >
                Eliminar
              </button>
            </div>

            <div className="ml-10">
              <div className="mb-3 grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2">
                <span className="text-xs font-semibold text-[#aeb6c2]">{progress}%</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#30343b]">
                  <div className="h-full rounded-full bg-[#4bce97] transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    checklistId={checklist.id}
                    item={item}
                    members={members}
                    onUpdateItem={onUpdateItem}
                    onToggleItem={onToggleItem}
                    onDeleteItem={onDeleteItem}
                  />
                ))}
                {hideCompleted && visibleItems.length === 0 && (
                  <p className="rounded bg-white/[.04] px-3 py-2 text-sm text-[#aeb6c2]">Todos los elementos completados están ocultos.</p>
                )}
              </div>

              <ChecklistItemsComposer checklistId={checklist.id} members={members} onAddItem={onAddItem} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CardActionButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={`inline-flex h-9 items-center gap-2 rounded border px-3 text-sm font-bold transition ${
        active
          ? 'border-[#aeb6c2] bg-[#aeb6c2] text-[#1f2024]'
          : 'border-[#3b4048] bg-[#26282d] text-[#b8c0cc] hover:bg-[#30333a] hover:text-[#f1f2f4]'
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function RichDescriptionEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="trello-description-editor">
      <Editor
        value={value}
        onChange={(event: ContentEditableEvent) => onChange(event.target.value)}
        placeholder="Agrega una descripción más detallada..."
        containerProps={{ className: 'trello-description-editor-container' }}
      >
        <Toolbar>
          <BtnBold />
          <BtnItalic />
          <BtnBulletList />
          <BtnNumberedList />
          <BtnLink />
        </Toolbar>
      </Editor>
    </div>
  );
}

function CardTitleEditor({
  card,
  onSave,
}: {
  card: BoardTaskCard;
  onSave: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(card.title);
  }, [card.title]);

  useEffect(() => {
    if (editing) {
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing]);

  const save = async () => {
    const cleanTitle = draft.trim();
    if (!cleanTitle) {
      setDraft(card.title);
      setEditing(false);
      return;
    }

    if (cleanTitle !== card.title) {
      await onSave(cleanTitle);
    }

    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="min-w-0 flex-1 rounded-md border-2 border-[#579dff] bg-[#22252b] px-2 py-1 text-3xl font-black leading-tight text-[#f1f2f4] outline-none"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save();
          if (event.key === 'Escape') {
            setDraft(card.title);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className="min-w-0 rounded-md px-1 text-left text-3xl font-black leading-tight text-[#f1f2f4] decoration-red-500 decoration-wavy underline-offset-4 transition hover:bg-white/10"
      type="button"
      onClick={() => setEditing(true)}
      title="Click para editar el nombre de la tarjeta"
    >
      {card.title}
    </button>
  );
}

function BoardTitleEditor({
  board,
  onSave,
}: {
  board: Board;
  onSave: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setDraft(board.title), [board.title]);
  useEffect(() => {
    if (editing) window.setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  const save = async () => {
    const cleanTitle = draft.trim();
    if (!cleanTitle) {
      window.alert('El nombre del tablero no puede quedar vacío.');
      setDraft(board.title);
      setEditing(false);
      return;
    }

    if (cleanTitle !== board.title) await onSave(cleanTitle);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="h-9 min-w-[180px] max-w-[360px] rounded border border-[#85b8ff] bg-black/35 px-2 text-lg font-black text-white outline-none ring-1 ring-[#579dff]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save();
          if (event.key === 'Escape') {
            setDraft(board.title);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className="max-w-[360px] truncate rounded-lg px-2 py-1 text-left text-lg font-black text-white transition hover:bg-white/10"
      type="button"
      onClick={() => setEditing(true)}
      title="Click para editar el nombre del tablero"
    >
      {board.title}
    </button>
  );
}


function CommentOrActivityItem({
  item,
  type,
}: {
  item: BoardTaskComment | BoardTaskActivity;
  type: 'comment' | 'activity';
}) {
  const isComment = type === 'comment';
  const actorName = isComment ? (item as BoardTaskComment).authorName : (item as BoardTaskActivity).actorName;
  const message = isComment ? (item as BoardTaskComment).message : (item as BoardTaskActivity).message;

  return (
    <div className="flex gap-3">
      <Avatar label={item.avatarText} className="h-9 w-9 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[#c9d0dc]">
          <span className="font-black text-[#f1f2f4]">{actorName}</span>{' '}
          {isComment ? 'comentó:' : message}
        </p>
        {isComment && (
          <div
            className="mt-1 rounded-lg border border-[#2e333a] bg-[#22252b] px-3 py-2 text-sm leading-relaxed text-[#dfe3ea]"
            dangerouslySetInnerHTML={{ __html: message }}
          />
        )}
        <button className="mt-1 text-xs font-medium text-[#579dff] hover:underline" type="button">
          {formatRelativeDate(item.createdAt)}
        </button>
      </div>
    </div>
  );
}

function CardDetailModal({
  card,
  list,
  onClose,
  onUpdateCard,
  onToggleCompleted,
  members,
  labelOptions,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: {
  card: BoardTaskCard;
  list: BoardList;
  onClose: () => void;
  onUpdateCard: (input: UpdateBoardTaskCardInput) => Promise<void>;
  onToggleCompleted: () => Promise<void>;
  members: WorkspaceMember[];
  labelOptions: BoardLabelOption[];
  onCreateLabel: (name: string, color: string) => Promise<BoardLabelOption>;
  onUpdateLabel: (labelId: string, input: { name?: string; color?: string }) => Promise<BoardLabelOption | null>;
  onDeleteLabel: (labelId: string) => Promise<void>;
}) {
  const [descriptionDraft, setDescriptionDraft] = useState(card.description ?? '');
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(!stripHtml(card.description ?? ''));
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [activePopover, setActivePopover] = useState<CardPopover>(null);
  const [showActivityDetails, setShowActivityDetails] = useState(true);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const addButtonRef = useRef<HTMLDivElement | null>(null);
  const labelsButtonRef = useRef<HTMLDivElement | null>(null);
  const datesButtonRef = useRef<HTMLDivElement | null>(null);
  const checklistButtonRef = useRef<HTMLDivElement | null>(null);
  const membersButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDescriptionDraft(card.description ?? '');
    setIsDescriptionEditing(!stripHtml(card.description ?? ''));
  }, [card.id]);

  const fallbackActivity: BoardTaskActivity = {
    id: `activity-fallback-${card.id}`,
    actorName: 'Jeremias Goytia',
    avatarText: 'JG',
    message: `ha añadido esta tarjeta a ${list.title}`,
    createdAt: card.createdAt ?? new Date().toISOString(),
  };

  const activities = card.activities && card.activities.length > 0 ? card.activities : [fallbackActivity];
  const comments = card.comments ?? [];
  const timelineItems = useMemo(
    () =>
      [
        ...comments.map((comment) => ({
          id: `comment-${comment.id}`,
          type: 'comment' as const,
          item: comment,
          createdAt: comment.createdAt,
        })),
        ...activities.map((activity) => ({
          id: `activity-${activity.id}`,
          type: 'activity' as const,
          item: activity,
          createdAt: activity.createdAt,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [comments, activities],
  );
  const visibleTimelineItems = showActivityDetails ? timelineItems : timelineItems.slice(0, 1);

  const handleSaveDescription = async () => {
    if (isSavingDescription) return;

    const previousDescription = card.description ?? '';
    setIsDescriptionEditing(false);
    setIsSavingDescription(true);
    try {
      await onUpdateCard({ description: descriptionDraft });
    } catch (error) {
      setDescriptionDraft(previousDescription);
      setIsDescriptionEditing(true);
      throw error;
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleCancelDescription = () => {
    setDescriptionDraft(card.description ?? '');
    setIsDescriptionEditing(!stripHtml(card.description ?? ''));
  };

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanComment = stripHtml(commentDraft);
    if (!cleanComment || isSavingComment) return;

    const newComment: BoardTaskComment = {
      id: `comment-${crypto.randomUUID()}`,
      authorName: 'Jeremias Goytia',
      avatarText: 'JG',
      message: commentDraft.trim(),
      createdAt: new Date().toISOString(),
      isCurrentUser: true,
    };

    const previousDraft = commentDraft;
    setCommentDraft('');
    setShowActivityDetails(true);
    setIsSavingComment(true);
    try {
      await onUpdateCard({ comments: [newComment, ...(card.comments ?? [])] });
    } catch (error) {
      setCommentDraft(previousDraft);
      throw error;
    } finally {
      setIsSavingComment(false);
    }
  };

  const cardLabels = card.labels ?? [];
  const cardMembers = card.members ?? [];
  const cardAssignableMembers = members.filter((member) => cardMembers.includes(member.avatarText));
  const cardChecklists = card.checklists ?? [];

  const updateCardWithActivity = async (input: UpdateBoardTaskCardInput, activityMessage?: string) => {
    const nextInput = activityMessage
      ? { ...input, activities: [createActivity(activityMessage), ...activities] }
      : input;
    await onUpdateCard(nextInput);
  };

  const handleToggleLabel = async (labelId: string) => {
    const nextLabels = cardLabels.includes(labelId)
      ? cardLabels.filter((currentLabelId) => currentLabelId !== labelId)
      : [...cardLabels, labelId];

    void onUpdateCard({ labels: nextLabels }).catch((error) => {
      console.error('[Tableros] No se pudieron actualizar etiquetas', error);
      window.alert(error instanceof Error ? error.message : 'No se pudieron actualizar las etiquetas.');
    });
  };

  const handleToggleMember = async (memberText: string) => {
    const nextMembers = cardMembers.includes(memberText)
      ? cardMembers.filter((currentMemberText) => currentMemberText !== memberText)
      : [...cardMembers, memberText];

    void onUpdateCard({ members: nextMembers }).catch((error) => {
      console.error('[Tableros] No se pudieron actualizar miembros', error);
      window.alert(error instanceof Error ? error.message : 'No se pudieron actualizar los miembros.');
    });
  };

  const handleSaveDates = async (
    input: Pick<UpdateBoardTaskCardInput, 'startDate' | 'dueDate' | 'dueTime' | 'startDateEnabled' | 'dueDateEnabled' | 'periodicity'>,
  ) => {
    setActivePopover(null);
    void updateCardWithActivity(input, 'ha actualizado las fechas de esta tarjeta').catch((error) => {
      console.error('[Tableros] No se pudieron guardar fechas', error);
      window.alert(error instanceof Error ? error.message : 'No se pudieron guardar las fechas.');
    });
  };

  const handleRemoveDates = async () => {
    setActivePopover(null);
    void updateCardWithActivity(
      {
        startDate: '',
        dueDate: '',
        dueTime: '09:59',
        startDateEnabled: false,
        dueDateEnabled: false,
        periodicity: 'Nunca',
      },
      'ha quitado las fechas de esta tarjeta',
    ).catch((error) => {
      console.error('[Tableros] No se pudieron quitar fechas', error);
      window.alert(error instanceof Error ? error.message : 'No se pudieron quitar las fechas.');
    });
  };

  const handleCreateChecklist = async (title: string, copyFromChecklistId?: string) => {
    const sourceChecklist = cardChecklists.find((checklist) => checklist.id === copyFromChecklistId);
    const now = new Date().toISOString();
    const newChecklist: BoardTaskChecklist = {
      id: `checklist-${crypto.randomUUID()}`,
      title: title.trim(),
      items:
        sourceChecklist?.items.map((item) => ({
          ...item,
          id: `checkitem-${crypto.randomUUID()}`,
          completed: false,
          assignedTo: undefined,
          dueDate: undefined,
          createdAt: now,
          updatedAt: now,
        })) ?? [],
      createdAt: now,
      updatedAt: now,
    };

    setActivePopover(null);
    void updateCardWithActivity(
      { checklists: [...cardChecklists, newChecklist] },
      `ha añadido ${newChecklist.title} a esta tarjeta`,
    ).catch((error) => {
      console.error('[Tableros] No se pudo crear checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo crear el checklist.');
    });
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    const checklist = cardChecklists.find((currentChecklist) => currentChecklist.id === checklistId);
    const confirmed = window.confirm(`¿Querés eliminar el checklist "${checklist?.title ?? 'sin título'}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    void updateCardWithActivity(
      { checklists: cardChecklists.filter((currentChecklist) => currentChecklist.id !== checklistId) },
      `ha quitado ${checklist?.title ?? 'un checklist'} de esta tarjeta`,
    ).catch((error) => {
      console.error('[Tableros] No se pudo eliminar checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo eliminar el checklist.');
    });
  };

  const handleRenameChecklist = async (checklistId: string, title: string) => {
    const now = new Date().toISOString();
    const nextChecklists = cardChecklists.map((checklist) =>
      checklist.id === checklistId
        ? { ...checklist, title: title.trim(), updatedAt: now }
        : checklist,
    );

    void updateCardWithActivity({ checklists: nextChecklists }, 'ha actualizado un checklist de esta tarjeta').catch((error) => {
      console.error('[Tableros] No se pudo renombrar checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo renombrar el checklist.');
    });
  };

  const handleAddChecklistItem = async (
    checklistId: string,
    title: string,
    input?: Partial<Pick<BoardTaskChecklistItem, 'assignedTo' | 'dueDate' | 'dueTime' | 'dueDateEnabled'>>,
  ) => {
    const now = new Date().toISOString();
    const newItem: BoardTaskChecklistItem = {
      id: `checkitem-${crypto.randomUUID()}`,
      title: title.trim(),
      completed: false,
      assignedTo: input?.assignedTo,
      dueDate: input?.dueDate,
      dueTime: input?.dueTime ?? '09:59',
      dueDateEnabled: Boolean(input?.dueDateEnabled && input?.dueDate),
      createdAt: now,
      updatedAt: now,
    };

    const nextChecklists = cardChecklists.map((checklist) =>
      checklist.id === checklistId
        ? { ...checklist, items: [...checklist.items, newItem], updatedAt: now }
        : checklist,
    );

    void onUpdateCard({ checklists: nextChecklists }).catch((error) => {
      console.error('[Tableros] No se pudo actualizar checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo actualizar el checklist.');
    });
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string) => {
    const now = new Date().toISOString();
    const nextChecklists = cardChecklists.map((checklist) =>
      checklist.id === checklistId
        ? {
            ...checklist,
            items: checklist.items.map((item) =>
              item.id === itemId ? { ...item, completed: !item.completed, updatedAt: now } : item,
            ),
            updatedAt: now,
          }
        : checklist,
    );

    void onUpdateCard({ checklists: nextChecklists }).catch((error) => {
      console.error('[Tableros] No se pudo actualizar checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo actualizar el checklist.');
    });
  };

  const handleUpdateChecklistItem = async (
    checklistId: string,
    itemId: string,
    input: Partial<Pick<BoardTaskChecklistItem, 'title' | 'assignedTo' | 'dueDate' | 'dueTime' | 'dueDateEnabled'>>,
  ) => {
    if (input.title !== undefined && !input.title.trim()) {
      window.alert('El elemento no puede quedar vacío.');
      return;
    }

    const now = new Date().toISOString();
    const nextChecklists = cardChecklists.map((checklist) =>
      checklist.id === checklistId
        ? {
            ...checklist,
            items: checklist.items.map((item) => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                ...input,
                title: input.title !== undefined ? input.title.trim() : item.title,
                updatedAt: now,
              };
            }),
            updatedAt: now,
          }
        : checklist,
    );

    void onUpdateCard({ checklists: nextChecklists }).catch((error) => {
      console.error('[Tableros] No se pudo actualizar checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo actualizar el checklist.');
    });
  };

  const handleDeleteChecklistItem = async (checklistId: string, itemId: string) => {
    const checklist = cardChecklists.find((currentChecklist) => currentChecklist.id === checklistId);
    const item = checklist?.items.find((currentItem) => currentItem.id === itemId);
    const confirmed = window.confirm(`¿Querés eliminar el elemento "${item?.title ?? 'sin título'}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const now = new Date().toISOString();
    const nextChecklists = cardChecklists.map((currentChecklist) =>
      currentChecklist.id === checklistId
        ? {
            ...currentChecklist,
            items: currentChecklist.items.filter((currentItem) => currentItem.id !== itemId),
            updatedAt: now,
          }
        : currentChecklist,
    );

    void onUpdateCard({ checklists: nextChecklists }).catch((error) => {
      console.error('[Tableros] No se pudo actualizar checklist', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo actualizar el checklist.');
    });
  };

  const selectedLabelOptions = labelOptions.filter((label) => cardLabels.includes(label.id));

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-16 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="grid max-h-[80dvh] w-[min(80vw,1190px)] grid-cols-[minmax(0,1fr)_minmax(380px,42%)] grid-rows-[62px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[#34373e] bg-[#1f2024] text-[#c9d0dc] shadow-[0_24px_90px_rgba(0,0,0,.72)]">
        <header className="col-span-2 flex h-[62px] items-center justify-between border-b border-[#32363d] bg-[#202126] px-7">
          <button
            className="inline-flex h-8 items-center gap-1 rounded bg-[#3a3d44] px-2.5 text-sm font-black text-[#dfe3ea] transition hover:bg-[#464a52]"
            type="button"
          >
            {list.title}
            <ChevronDown size={15} />
          </button>

          <div className="flex items-center gap-3 text-[#b6c2cf]">
            <button className="grid h-9 w-9 place-items-center rounded-full text-[#d7dce5] transition hover:bg-white/10 hover:text-white" type="button" onClick={onClose} aria-label="Cerrar tarjeta">
              <X size={26} />
            </button>
          </div>
        </header>

        <div className="min-w-0 overflow-y-auto px-7 py-7">
          <div className="mb-6 flex items-start gap-4">
            <button
              className="mt-2 grid h-6 w-6 shrink-0 place-items-center text-[#b6c2cf] transition hover:text-[#4bce97]"
              type="button"
              onClick={() => void onToggleCompleted()}
              aria-label={card.completed ? 'Marcar pendiente' : 'Marcar completada'}
            >
              {card.completed ? <CheckCircle2 size={22} className="text-[#4bce97]" /> : <Circle size={22} />}
            </button>
            <CardTitleEditor card={card} onSave={(title) => onUpdateCard({ title })} />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 pl-10">
            <div ref={addButtonRef} className="relative">
              <CardActionButton icon={Plus} label="Añadir" active={activePopover === 'add'} onClick={() => setActivePopover(activePopover === 'add' ? null : 'add')} />
              {activePopover === 'add' && (
                <AddToCardPopover
                  onClose={() => setActivePopover(null)}
                  onSelect={(popover) => setActivePopover(popover)}
                  anchorRef={addButtonRef}
                />
              )}
            </div>
            <div ref={labelsButtonRef} className="relative">
              <CardActionButton icon={Tag} label="Etiquetas" active={activePopover === 'labels'} onClick={() => setActivePopover(activePopover === 'labels' ? null : 'labels')} />
              {activePopover === 'labels' && (
                <LabelsPopover selectedLabels={cardLabels} labelOptions={labelOptions} onToggleLabel={(labelId) => void handleToggleLabel(labelId)} onCreateLabel={onCreateLabel} onUpdateLabel={onUpdateLabel} onDeleteLabel={onDeleteLabel} onClose={() => setActivePopover(null)} anchorRef={labelsButtonRef} />
              )}
            </div>
            <div ref={datesButtonRef} className="relative">
              <CardActionButton icon={CalendarClock} label="Fechas" active={activePopover === 'dates'} onClick={() => setActivePopover(activePopover === 'dates' ? null : 'dates')} />
              {activePopover === 'dates' && (
                <DatesPopover card={card} onSave={(input) => void handleSaveDates(input)} onRemove={() => void handleRemoveDates()} onClose={() => setActivePopover(null)} anchorRef={datesButtonRef} />
              )}
            </div>
            <div ref={checklistButtonRef} className="relative">
              <CardActionButton icon={CheckSquare2} label="Checklist" active={activePopover === 'checklist'} onClick={() => setActivePopover(activePopover === 'checklist' ? null : 'checklist')} />
              {activePopover === 'checklist' && (
                <ChecklistPopover checklists={cardChecklists} onCreate={(title, copyFromChecklistId) => void handleCreateChecklist(title, copyFromChecklistId)} onClose={() => setActivePopover(null)} anchorRef={checklistButtonRef} />
              )}
            </div>
            <div ref={membersButtonRef} className="relative">
              <CardActionButton icon={UserRoundPlus} label="Miembros" active={activePopover === 'members'} onClick={() => setActivePopover(activePopover === 'members' ? null : 'members')} />
              {activePopover === 'members' && (
                <MembersPopover selectedMembers={cardMembers} members={members} onToggleMember={(memberText) => void handleToggleMember(memberText)} onClose={() => setActivePopover(null)} anchorRef={membersButtonRef} />
              )}
            </div>
          </div>

          {(selectedLabelOptions.length > 0 || cardMembers.length > 0 || (card.dueDateEnabled && card.dueDate)) && (
            <div className="mb-7 grid gap-4 pl-10 md:grid-cols-[repeat(3,max-content)]">
              {selectedLabelOptions.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-black uppercase text-[#9fa8b7]">Etiquetas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLabelOptions.map((label) => (
                      <span key={label.id} className="h-8 min-w-[48px] rounded px-3 text-xs font-black leading-8 text-white" style={{ backgroundColor: label.color }}>
                        {label.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cardMembers.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-black uppercase text-[#9fa8b7]">Miembros</p>
                  <div className="flex -space-x-1.5">
                    {cardMembers.map((memberText) => <Avatar key={memberText} label={memberText} className="h-8 w-8" />)}
                  </div>
                </div>
              )}
              {card.dueDateEnabled && card.dueDate && (
                <div>
                  <p className="mb-1 text-xs font-black uppercase text-[#9fa8b7]">Fecha de vencimiento</p>
                  <button className="inline-flex h-8 items-center gap-2 rounded bg-[#32363d] px-3 text-sm font-bold text-[#dfe3ea] transition hover:bg-[#3d424b]" type="button" onClick={() => setActivePopover('dates')}>
                    <Clock3 size={15} />
                    {formatDateForTrello(card.dueDate, card.dueTime)}
                  </button>
                </div>
              )}
            </div>
          )}

          <section className="pl-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ListChecks size={24} className="text-[#c5ccd7]" />
                <h2 className="text-lg font-black text-[#dfe3ea]">Descripción</h2>
              </div>
              {!isDescriptionEditing && stripHtml(card.description ?? '') && (
                <button
                  className="mr-10 rounded border border-[#3d424b] bg-[#282a2f] px-4 py-2 text-sm font-black text-[#aeb6c2] transition hover:bg-[#343841] hover:text-white"
                  type="button"
                  onClick={() => setIsDescriptionEditing(true)}
                >
                  Editar
                </button>
              )}
            </div>

            <div className="ml-10 max-w-[580px]">
              {isDescriptionEditing ? (
                <>
                  <RichDescriptionEditor value={descriptionDraft} onChange={setDescriptionDraft} />

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      className="rounded bg-[#579dff] px-4 py-2 text-sm font-bold text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={isSavingDescription}
                      onClick={() => void handleSaveDescription()}
                    >
                      {isSavingDescription ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      className="rounded px-4 py-2 text-sm font-bold text-[#aeb6c2] transition hover:bg-white/10 hover:text-white"
                      type="button"
                      onClick={handleCancelDescription}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : stripHtml(card.description ?? '') ? (
                <div
                  className="trello-description-content rounded-lg px-4 py-3 text-base leading-relaxed text-[#dfe3ea]"
                  dangerouslySetInnerHTML={{ __html: card.description ?? '' }}
                />
              ) : (
                <button
                  className="min-h-[68px] w-full rounded-lg border border-[#4b515d] bg-[#22252b] px-4 py-3 text-left text-sm font-semibold text-[#aeb6c2] transition hover:bg-[#2a2e36] hover:text-white"
                  type="button"
                  onClick={() => setIsDescriptionEditing(true)}
                >
                  Añadir una descripción más detallada...
                </button>
              )}
            </div>
          </section>

          <CardChecklistsSection
            checklists={cardChecklists}
            members={cardAssignableMembers}
            onDeleteChecklist={(checklistId) => void handleDeleteChecklist(checklistId)}
            onRenameChecklist={(checklistId, title) => void handleRenameChecklist(checklistId, title)}
            onAddItem={(checklistId, title, input) => void handleAddChecklistItem(checklistId, title, input)}
            onToggleItem={(checklistId, itemId) => void handleToggleChecklistItem(checklistId, itemId)}
            onUpdateItem={(checklistId, itemId, input) => void handleUpdateChecklistItem(checklistId, itemId, input)}
            onDeleteItem={(checklistId, itemId) => void handleDeleteChecklistItem(checklistId, itemId)}
          />
        </div>

        <aside className="overflow-y-auto border-l border-[#32363d] bg-[#17191c] px-7 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquareText size={20} className="text-[#c5ccd7]" />
              <h2 className="font-black text-[#dfe3ea]">Comentarios y Actividad</h2>
            </div>
            <button
              className="rounded border border-[#343941] bg-[#1d1f23] px-4 py-2 text-sm font-bold text-[#aeb6c2] transition hover:bg-[#272a30] hover:text-white"
              type="button"
              onClick={() => setShowActivityDetails((current) => !current)}
            >
              {showActivityDetails ? 'Ocultar detalles' : 'Mostrar detalles'}
            </button>
          </div>

          <form className="mb-5" onSubmit={handleAddComment}>
            <textarea
              className="min-h-[48px] w-full resize-none rounded-lg border border-transparent bg-[#22252b] px-3 py-3 text-sm leading-relaxed text-[#f1f2f4] outline-none placeholder:text-[#9fa8b7] shadow-[inset_0_0_0_1px_rgba(255,255,255,.03)] transition focus:border-[#85b8ff] focus:ring-1 focus:ring-[#85b8ff]"
              placeholder="Escribe un comentario..."
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {stripHtml(commentDraft) && (
              <div className="mt-2 flex justify-end">
                <button
                  className="rounded bg-[#579dff] px-3 py-1.5 text-sm font-bold text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={isSavingComment}
                >
                  {isSavingComment ? 'Guardando...' : 'Comentar'}
                </button>
              </div>
            )}
          </form>

          <div className="space-y-5">
            {visibleTimelineItems.map((timelineItem) => (
              <CommentOrActivityItem key={timelineItem.id} item={timelineItem.item} type={timelineItem.type} />
            ))}
          </div>

          {!showActivityDetails && timelineItems.length > 1 && (
            <p className="mt-5 rounded-lg bg-white/[.04] px-3 py-2 text-xs font-semibold text-[#9fa8b7]">
              Detalles ocultos. Se muestra solo la última actividad.
            </p>
          )}

          <div className="mt-8 rounded-xl border border-[#2f333a] bg-[#1e2025] p-4 text-sm text-[#9fa8b7]">
            <p className="mb-2 font-black text-[#dfe3ea]">Detalles por tarjeta</p>
            <p>Esta información vive dentro de cada item. Después se puede reemplazar por tablas como cards, comments, members, labels y activity_log.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

export function BoardDetailPage() {
  const {
    selectedBoard,
    selectedBoardLists,
    boardLabels,
    members,
    setActiveView,
    currentWorkspace,
    canManageSelectedBoard,
    createBoardList,
    updateBoardList,
    deleteBoardList,
    sortBoardListCards,
    moveBoardTaskCard,
    reorderBoardList,
    createBoardTaskCard,
    updateTaskCard,
    toggleTaskCardCompleted,
    updateBoard,
    deleteBoard,
    createBoardLabel,
    updateBoardLabel,
    deleteBoardLabel,
    boardMessages,
    sendBoardMessage,
  } = useBoards();
  const [activePanel, setActivePanel] = useState<BoardPanel>('board');
  const [selectedTask, setSelectedTask] = useState<SelectedTaskRef | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBoardOptionsOpen, setIsBoardOptionsOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const [dragPreviewLists, setDragPreviewLists] = useState<BoardList[] | null>(null);
  const [listSelectionMode, setListSelectionMode] = useState(false);
  const [selectedListIdsForDelete, setSelectedListIdsForDelete] = useState<string[]>([]);
  const boardOptionsButtonRef = useRef<HTMLDivElement | null>(null);


  const boardMemberIds = selectedBoard?.memberIds && selectedBoard.memberIds.length > 0 ? selectedBoard.memberIds : [];
  const uniqueMembers = Array.from(new Map(members.map((member) => [member.id, member])).values());
  const boardMembers = uniqueMembers.filter((member) => boardMemberIds.includes(member.id));
  const selectedBoardLabelOptions = useMemo(
    () => selectedBoard ? boardLabels.filter((label) => !label.boardId || label.boardId === selectedBoard.id) : [],
    [boardLabels, selectedBoard],
  );

  const selectedTaskData = useMemo(() => {
    if (!selectedTask) return null;
    const list = selectedBoardLists.find((currentList) => currentList.id === selectedTask.listId);
    const card = list?.cards.find((currentCard) => currentCard.id === selectedTask.cardId);
    return list && card ? { list, card } : null;
  }, [selectedBoardLists, selectedTask]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const renderedBoardLists = dragPreviewLists ?? selectedBoardLists;

  const activeCardPreview = activeDrag?.type === 'card' ? findCardLocation(renderedBoardLists, activeDrag.cardId)?.card ?? null : null;
  const activeListPreview = activeDrag?.type === 'list' ? renderedBoardLists.find((list) => list.id === activeDrag.listId) ?? null : null;

  const handleCreateList = (boardId: string, title: string) => createBoardList({ boardId, title }).then(() => undefined);

  const handleRenameList = (listId: string, title: string) => updateBoardList(listId, { title }).then(() => undefined);

  const handleDeleteList = (listId: string) => {
    setSelectedListIdsForDelete((current) => current.filter((currentListId) => currentListId !== listId));
    return deleteBoardList(listId);
  };

  const handleEmptyList = (listId: string) => updateBoardList(listId, { cards: [] }).then(() => undefined);

  const handleToggleListMarkedForDelete = (listId: string) => {
    setSelectedListIdsForDelete((current) =>
      current.includes(listId) ? current.filter((currentListId) => currentListId !== listId) : [...current, listId],
    );
  };

  const handleDeleteMarkedLists = async () => {
    if (selectedListIdsForDelete.length === 0) return;
    const confirmed = window.confirm(`¿Querés eliminar ${selectedListIdsForDelete.length} lista${selectedListIdsForDelete.length === 1 ? '' : 's'} marcada${selectedListIdsForDelete.length === 1 ? '' : 's'}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    await Promise.all(selectedListIdsForDelete.map((listId) => deleteBoardList(listId)));
    setSelectedListIdsForDelete([]);
    setListSelectionMode(false);
  };

  const handleSortListCards = (listId: string, sortBy: 'name' | 'newest' | 'oldest') => sortBoardListCards(listId, sortBy).then(() => undefined);

  const clearDndState = () => {
    setActiveDrag(null);
    setDragPreviewLists(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = getSortableData(event.active.data.current);
    if (!data) return;

    if (data.type === 'card') {
      setActiveDrag({ type: 'card', cardId: data.cardId, sourceListId: data.listId });
    } else {
      setActiveDrag({
        type: 'list',
        listId: data.listId,
        sourceIndex: selectedBoardLists.findIndex((list) => list.id === data.listId),
      });
    }

    setDragPreviewLists(selectedBoardLists);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) return;

    const activeData = getSortableData(event.active.data.current);
    const overData = getSortableData(event.over.data.current);
    if (!activeData || !overData) return;

    setDragPreviewLists((currentLists) => {
      const lists = currentLists ?? selectedBoardLists;

      if (activeData.type === 'card') {
        const targetListId = overData.type === 'card' ? overData.listId : overData.listId;
        const targetList = lists.find((list) => list.id === targetListId);
        if (!targetList) return lists;

        const targetIndex = overData.type === 'card'
          ? getCardInsertIndex(event, targetList.cards, overData.cardId)
          : targetList.cards.length;

        const nextLists = moveCardInLists(lists, activeData.cardId, targetListId, targetIndex);
        return nextLists === lists ? lists : nextLists;
      }

      if (activeData.type === 'list' && overData.type === 'list') {
        if (activeData.listId === overData.listId) return lists;
        const targetIndex = getListInsertIndex(event, lists, overData.listId);
        const nextLists = moveListInLists(lists, activeData.listId, targetIndex);
        return nextLists === lists ? lists : nextLists;
      }

      return lists;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!selectedBoard || !activeDrag) {
      clearDndState();
      return;
    }

    const finalLists = dragPreviewLists ?? selectedBoardLists;
    const pendingAction = activeDrag.type === 'card'
      ? (() => {
          const finalLocation = findCardLocation(finalLists, activeDrag.cardId);
          if (!finalLocation) return null;
          return moveBoardTaskCard({
            cardId: activeDrag.cardId,
            fromListId: activeDrag.sourceListId,
            toListId: finalLocation.listId,
            targetIndex: finalLocation.cardIndex,
          });
        })()
      : (() => {
          const finalIndex = finalLists.findIndex((list) => list.id === activeDrag.listId);
          if (finalIndex === -1) return null;
          return reorderBoardList({ boardId: selectedBoard.id, listId: activeDrag.listId, targetIndex: finalIndex });
        })();

    clearDndState();
    void pendingAction?.catch((error) => {
      console.error('[Tableros] No se pudo guardar drag and drop', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.');
    });
  };

  const handleDragCancel = (_event?: DragCancelEvent) => {
    clearDndState();
  };

  const handleCreateCard = (listId: string, title: string) => createBoardTaskCard({ listId, title }).then(() => undefined);

  const handleToggleCard = (listId: string, card: BoardTaskCard) => toggleTaskCardCompleted(listId, card.id, !card.completed);

  const handleUpdateSelectedCard = async (input: UpdateBoardTaskCardInput) => {
    if (!selectedTaskData) return;
    await updateTaskCard(selectedTaskData.list.id, selectedTaskData.card.id, input);
  };

  const handleToggleBoardMember = async (memberId: string) => {
    if (!selectedBoard) return;
    const currentMemberIds = selectedBoard.memberIds && selectedBoard.memberIds.length > 0 ? selectedBoard.memberIds : [];
    const nextMemberIds = currentMemberIds.includes(memberId)
      ? currentMemberIds.filter((currentMemberId) => currentMemberId !== memberId)
      : [...currentMemberIds, memberId];

    await updateBoard(selectedBoard.id, { memberIds: nextMemberIds });
  };

  const handleDeleteCurrentBoard = async () => {
    if (!selectedBoard) return;
    if (!canManageSelectedBoard) {
      window.alert('Solo un administrador del tablero o del espacio puede eliminar este tablero.');
      return;
    }
    const confirmed = window.confirm(`¿Querés eliminar el tablero "${selectedBoard.title}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setIsBoardOptionsOpen(false);
    await deleteBoard(selectedBoard.id);
  };

  const handleEmptyCurrentBoard = async () => {
    if (!selectedBoard) return;
    if (!canManageSelectedBoard) {
      window.alert('Solo un administrador puede vaciar este tablero.');
      return;
    }
    if (selectedBoardLists.length === 0) {
      window.alert('Este tablero ya está vacío.');
      setIsBoardOptionsOpen(false);
      return;
    }

    const confirmed = window.confirm(`¿Querés vaciar el tablero "${selectedBoard.title}"? Se eliminarán todas sus listas y tarjetas.`);
    if (!confirmed) return;

    setIsBoardOptionsOpen(false);
    await Promise.all(selectedBoardLists.map((list) => deleteBoardList(list.id)));
    setSelectedListIdsForDelete([]);
    setListSelectionMode(false);
  };

  const handleToggleListSelectionMode = () => {
    if (!canManageSelectedBoard) {
      window.alert('Solo un administrador puede marcar listas para eliminarlas.');
      return;
    }
    setListSelectionMode((current) => {
      const next = !current;
      if (!next) setSelectedListIdsForDelete([]);
      return next;
    });
    setIsBoardOptionsOpen(false);
  };

  const handleToggleFavorite = async () => {
    if (!selectedBoard) return;
    await updateBoard(selectedBoard.id, { favorite: !selectedBoard.favorite });
  };

  const handleToggleBoardVisibility = async () => {
    if (!selectedBoard) return;
    if (!canManageSelectedBoard) {
      window.alert('Solo un administrador puede cambiar la visibilidad del tablero.');
      return;
    }
    await updateBoard(selectedBoard.id, { visibility: selectedBoard.visibility === 'publico' ? 'privado' : 'publico' });
  };

  const handleChangeBoardCover = async (coverIndex: number) => {
    if (!selectedBoard) return;
    if (!canManageSelectedBoard) {
      window.alert('Solo un administrador puede cambiar el fondo del tablero.');
      return;
    }
    await updateBoard(selectedBoard.id, { cover: boardCovers[coverIndex] ?? boardCovers[0] });
  };


  if (!selectedBoard) {
    return (
      <main className="grid h-full min-h-0 place-items-center bg-[#1d1d1f] px-6 text-[#d7d9df]">
        <div className="max-w-md rounded-2xl border border-[#323338] bg-[#242528] p-6 text-center shadow-trello">
          <h1 className="text-xl font-bold">No hay tablero seleccionado</h1>
          <p className="mt-2 text-[#a6a8b0]">Volvé a la lista y abrí un tablero para trabajar.</p>
          <button
            className="mt-5 rounded bg-[#579dff] px-4 py-2 font-bold text-[#092957] transition hover:bg-[#85b8ff]"
            type="button"
            onClick={() => setActiveView('boards')}
          >
            Ver tableros
          </button>
        </div>
      </main>
    );
  }

  const VisibilityIcon = selectedBoard.visibility === 'publico' ? Globe2 : LockKeyhole;

  return (
    <main className="relative grid h-full grid-cols-[305px_minmax(0,1fr)] gap-3 overflow-hidden bg-[#1d1d1f] p-3 font-sans text-[#d7d9df]">
      <InboxChatPanel messages={boardMessages} members={boardMembers} onSend={(message) => selectedBoard ? sendBoardMessage(selectedBoard.id, message) : Promise.resolve()} />

      <section className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10" style={getBoardCoverStyle(selectedBoard.cover, { overlay: true, contain: selectedBoard.cover.value.startsWith('/trello-backgrounds/') })}>
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-sky-950/10 to-black/45" />

        <header className="relative z-10 flex h-[72px] items-center justify-between border-b border-white/10 bg-black/55 px-6 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/90 transition hover:bg-white/10"
              type="button"
              onClick={() => setActiveView('boards')}
              title="Ir a los tableros del espacio de trabajo"
            >
              <LayoutPanelLeft size={24} />
            </button>
            <BoardTitleEditor board={selectedBoard} onSave={(title) => updateBoard(selectedBoard.id, { title }).then(() => undefined)} />
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/25 px-2.5 py-1 text-xs font-bold text-white/85 ring-1 ring-white/10">
              <VisibilityIcon size={13} />
              {selectedBoard.visibility === 'publico' ? 'Público' : 'Privado'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-white/90">
            <div className="flex -space-x-1.5 pr-1">
              {boardMembers.map((member) => (
                <Avatar key={member.id} label={member.avatarText} className="h-8 w-8 text-[10px]" />
              ))}
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 rounded bg-white/80 px-3 font-bold text-[#183153] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!canManageSelectedBoard}
              onClick={() => setIsShareModalOpen(true)}
            >
              <UserPlus size={17} />
              Compartir
            </button>
            <div ref={boardOptionsButtonRef} className="relative">
              <button
                className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10"
                type="button"
                onClick={() => setIsBoardOptionsOpen((current) => !current)}
                aria-label="Opciones del tablero"
              >
                <MoreHorizontal size={20} />
              </button>
              {isBoardOptionsOpen && selectedBoard && (
                <BoardOptionsPopover
                  board={selectedBoard}
                  listSelectionMode={listSelectionMode}
                  onClose={() => setIsBoardOptionsOpen(false)}
                  onDeleteBoard={() => void handleDeleteCurrentBoard()}
                  onEmptyBoard={() => void handleEmptyCurrentBoard()}
                  onToggleListSelectionMode={handleToggleListSelectionMode}
                  onToggleFavorite={() => void handleToggleFavorite()}
                  onChangeVisibility={() => void handleToggleBoardVisibility()}
                  onChangeCover={(coverIndex) => void handleChangeBoardCover(coverIndex)}
                  canManageBoard={canManageSelectedBoard}
                  anchorRef={boardOptionsButtonRef}
                />
              )}
            </div>
          </div>
        </header>

        <div className="relative z-10 h-[calc(100%-72px)] overflow-hidden px-5 py-4">
          {activePanel === 'board' ? (
            <>
              {listSelectionMode && (
                <div className="absolute left-5 top-4 z-30 flex items-center gap-3 rounded-xl border border-white/15 bg-[#1b1d22]/95 px-3 py-2 text-sm font-bold text-[#dfe3ea] shadow-2xl backdrop-blur">
                  <span>{selectedListIdsForDelete.length} lista{selectedListIdsForDelete.length === 1 ? '' : 's'} marcada{selectedListIdsForDelete.length === 1 ? '' : 's'}</span>
                  <button
                    className="rounded bg-red-500/20 px-3 py-1.5 text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={selectedListIdsForDelete.length === 0}
                    onClick={() => void handleDeleteMarkedLists()}
                  >
                    Eliminar marcadas
                  </button>
                  <button
                    className="rounded px-2 py-1.5 text-[#aeb6c2] transition hover:bg-white/10 hover:text-white"
                    type="button"
                    onClick={() => {
                      setListSelectionMode(false);
                      setSelectedListIdsForDelete([]);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <DndContext
              sensors={dndSensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={(event) => void handleDragEnd(event)}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={renderedBoardLists.map((list) => getListSortableId(list.id))} strategy={horizontalListSortingStrategy}>
                <div className="flex h-full items-start gap-4 overflow-x-auto pb-20">
                  {renderedBoardLists.map((list) => (
                    <SortableBoardListColumn
                      key={list.id}
                      list={list}
                      isListDragging={activeDrag?.type === 'list' && activeDrag.listId === list.id}
                      onCreateCard={handleCreateCard}
                      onOpenCard={(listId, cardId) => setSelectedTask({ listId, cardId })}
                      onToggleCard={handleToggleCard}
                      onRenameList={handleRenameList}
                      onDeleteList={handleDeleteList}
                      onEmptyList={handleEmptyList}
                      onSortListCards={handleSortListCards}
                      labelOptions={selectedBoardLabelOptions}
                      selectionMode={listSelectionMode}
                      isSelectedForDelete={selectedListIdsForDelete.includes(list.id)}
                      onToggleSelectedForDelete={handleToggleListMarkedForDelete}
                    />
                  ))}

                  <AddListComposer boardId={selectedBoard.id} onCreate={handleCreateList} />
                </div>
              </SortableContext>

              <DragOverlay adjustScale={false} dropAnimation={null}>
                {activeCardPreview ? <BoardTaskDragPreview card={activeCardPreview} labelOptions={selectedBoardLabelOptions} /> : null}
                {!activeCardPreview && activeListPreview ? <BoardListDragPreview list={activeListPreview} /> : null}
              </DragOverlay>
            </DndContext>
            </>
          ) : (
            <div className="grid h-full place-items-center pb-20">
              <div className="h-[min(72dvh,760px)] w-full max-w-3xl">
                <InboxChatPanel messages={boardMessages} members={boardMembers} onSend={(message) => selectedBoard ? sendBoardMessage(selectedBoard.id, message) : Promise.resolve()} />
              </div>
            </div>
          )}
        </div>

        <nav className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/15 bg-[#1b1d22]/90 p-1.5 text-sm font-bold shadow-2xl backdrop-blur" aria-label="Navegación del tablero">
          <button
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 transition ${
              activePanel === 'inbox' ? 'bg-[#1f3555] text-[#579dff]' : 'text-[#d5d9e2] hover:bg-white/10'
            }`}
            type="button"
            onClick={() => setActivePanel('inbox')}
          >
            <Inbox size={17} />
            Bandeja de entrada
          </button>
          <button
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 transition ${
              activePanel === 'board' ? 'bg-[#1f3555] text-[#579dff]' : 'text-[#d5d9e2] hover:bg-white/10'
            }`}
            type="button"
            onClick={() => setActivePanel('board')}
          >
            <Archive size={17} />
            Tablero
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[#d5d9e2] transition hover:bg-white/10"
            type="button"
            onClick={() => setActiveView('boards')}
          >
            <Sparkles size={17} />
            Cambiar de tablero
          </button>
        </nav>

        <div className="absolute bottom-4 right-5 z-10 rounded-lg bg-black/25 px-3 py-2 text-xs font-semibold text-white/70 backdrop-blur">
          {currentWorkspace?.name}
        </div>
      </section>

      {selectedTaskData && (
        <CardDetailModal
          card={selectedTaskData.card}
          list={selectedTaskData.list}
          onClose={() => setSelectedTask(null)}
          onUpdateCard={handleUpdateSelectedCard}
          onToggleCompleted={() => handleToggleCard(selectedTaskData.list.id, selectedTaskData.card)}
          members={boardMembers}
          labelOptions={selectedBoardLabelOptions}
          onCreateLabel={(name, color) => createBoardLabel({ name, color, boardId: selectedBoard.id })}
          onUpdateLabel={(labelId, input) => updateBoardLabel(labelId, input)}
          onDeleteLabel={(labelId) => deleteBoardLabel(labelId)}
        />
      )}

      {isShareModalOpen && selectedBoard && (
        <BoardShareModal
          board={selectedBoard}
          allMembers={uniqueMembers}
          selectedMemberIds={boardMemberIds}
          onToggleMember={(memberId) => void handleToggleBoardMember(memberId)}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </main>
  );
}
