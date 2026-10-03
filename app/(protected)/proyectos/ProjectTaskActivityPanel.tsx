"use client";

import {
  ArrowRightLeft,
  CalendarDays,
  FilePenLine,
  Flag,
  FolderKanban,
  History,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import { errorMessage, notify } from "@/lib/notifications";
import {
  createProjectTaskComment,
  deleteProjectTaskComment,
  fetchProjectTaskConversation,
  type ProjectTaskActivity,
  type ProjectTaskComment,
} from "@/lib/projectTaskActivity";

type FeedFilter = "all" | "comments" | "changes";

type FeedItem =
  | {
      kind: "comment";
      id: string;
      createdAt: string;
      comment: ProjectTaskComment;
    }
  | {
      kind: "activity";
      id: string;
      createdAt: string;
      activity: ProjectTaskActivity;
    };

type Props = {
  taskId: number;
  currentUserId: string | null;
  canComment: boolean;
  locked?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Sin empezar",
  in_progress: "En curso",
  done: "Completada",
  cancelled: "Cancelada",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

function profileLabel(
  name: string | null,
  email: string | null,
  fallback = "Sistema",
) {
  return name ?? email ?? fallback;
}

function initials(value: string) {
  const pieces = value.trim().split(/\s+/).filter(Boolean);
  if (!pieces.length) return "?";

  return pieces
    .slice(0, 2)
    .map((piece) => piece[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (sameDay) return `Hoy · ${time}`;
  if (wasYesterday) return `Ayer · ${time}`;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dateLabel(value: unknown) {
  if (typeof value !== "string" || !value) return "Sin fecha";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function eventPresentation(activity: ProjectTaskActivity) {
  const metadata = activity.metadata ?? {};
  const actor = profileLabel(
    activity.actor_name,
    activity.actor_email,
    "Sistema",
  );
  const target = profileLabel(
    activity.target_name,
    activity.target_email,
    "un responsable",
  );

  switch (activity.event_type) {
    case "task_created":
      return {
        icon: Sparkles,
        tone: "text-sky-300 bg-sky-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            creó la tarea
          </>
        ),
      };

    case "status_changed":
      return {
        icon: ArrowRightLeft,
        tone: "text-sky-300 bg-sky-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            cambió el estado de{" "}
            <span className="text-white/[0.56]">
              {STATUS_LABELS[String(metadata.old ?? "")] ??
                String(metadata.old ?? "—")}
            </span>{" "}
            a{" "}
            <span className="text-white/[0.80]">
              {STATUS_LABELS[String(metadata.new ?? "")] ??
                String(metadata.new ?? "—")}
            </span>
          </>
        ),
      };

    case "priority_changed":
      return {
        icon: Flag,
        tone: "text-amber-300 bg-amber-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            cambió la prioridad de{" "}
            <span className="text-white/[0.56]">
              {PRIORITY_LABELS[String(metadata.old ?? "")] ??
                String(metadata.old ?? "—")}
            </span>{" "}
            a{" "}
            <span className="text-white/[0.80]">
              {PRIORITY_LABELS[String(metadata.new ?? "")] ??
                String(metadata.new ?? "—")}
            </span>
          </>
        ),
      };

    case "due_date_changed":
      return {
        icon: CalendarDays,
        tone: "text-violet-300 bg-violet-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            cambió la fecha límite de{" "}
            <span className="text-white/[0.56]">{dateLabel(metadata.old)}</span>{" "}
            a{" "}
            <span className="text-white/[0.80]">{dateLabel(metadata.new)}</span>
          </>
        ),
      };

    case "project_changed":
      return {
        icon: FolderKanban,
        tone: "text-cyan-300 bg-cyan-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            movió la tarea de{" "}
            <span className="text-white/[0.56]">
              {String(metadata.old ?? "Sin proyecto")}
            </span>{" "}
            a{" "}
            <span className="text-white/[0.80]">
              {String(metadata.new ?? "Sin proyecto")}
            </span>
          </>
        ),
      };

    case "details_changed":
      return {
        icon: FilePenLine,
        tone: "text-white/[0.60] bg-white/[0.055]",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            actualizó el resumen o la descripción
          </>
        ),
      };

    case "title_changed":
      return {
        icon: FilePenLine,
        tone: "text-white/[0.60] bg-white/[0.055]",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            renombró la tarea a{" "}
            <span className="text-white/[0.80]">
              {String(metadata.new ?? "—")}
            </span>
          </>
        ),
      };

    case "assignee_added":
      return {
        icon: UserPlus,
        tone: "text-emerald-300 bg-emerald-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            agregó a{" "}
            <span className="text-white/[0.80]">{target}</span> como responsable
          </>
        ),
      };

    case "assignee_removed":
      return {
        icon: UserMinus,
        tone: "text-rose-300 bg-rose-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            quitó a{" "}
            <span className="text-white/[0.80]">{target}</span> de responsables
          </>
        ),
      };

    case "task_locked":
      return {
        icon: LockKeyhole,
        tone: "text-amber-300 bg-amber-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            cerró la tarea
          </>
        ),
      };

    case "task_unlocked":
      return {
        icon: LockKeyhole,
        tone: "text-emerald-300 bg-emerald-400/10",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            reabrió la tarea
          </>
        ),
      };

    default:
      return {
        icon: History,
        tone: "text-white/[0.55] bg-white/[0.05]",
        text: (
          <>
            <strong className="font-medium text-white/[0.84]">{actor}</strong>{" "}
            actualizó la tarea
          </>
        ),
      };
  }
}

export default function ProjectTaskActivityPanel({
  taskId,
  currentUserId,
  canComment,
  locked = false,
}: Props) {
  const [comments, setComments] = useState<ProjectTaskComment[]>([]);
  const [activities, setActivities] = useState<ProjectTaskActivity[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadConversation = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const data = await fetchProjectTaskConversation(taskId);
        setComments(data.comments);
        setActivities(data.activities);
      } catch (error) {
        console.error("Error loading task activity", error);
        if (!quiet) {
          notify.error(
            errorMessage(error, "No se pudo cargar la actividad de la tarea."),
          );
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    void loadConversation();

    const channel = supabase
      .channel(`project_task_conversation_${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        () => void loadConversation(true),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_task_activity",
          filter: `task_id=eq.${taskId}`,
        },
        () => void loadConversation(true),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConversation, taskId]);

  const feed = useMemo(() => {
    const items: FeedItem[] = [];

    if (filter !== "changes") {
      comments.forEach((item) => {
        items.push({
          kind: "comment",
          id: `comment-${item.id}`,
          createdAt: item.created_at,
          comment: item,
        });
      });
    }

    if (filter !== "comments") {
      activities.forEach((item) => {
        items.push({
          kind: "activity",
          id: `activity-${item.id}`,
          createdAt: item.created_at,
          activity: item,
        });
      });
    }

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activities, comments, filter]);

  const handlePost = async () => {
    const clean = comment.trim();
    if (!clean || !canComment || locked || posting) return;

    try {
      setPosting(true);
      await createProjectTaskComment(taskId, clean);
      setComment("");
      await loadConversation(true);
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo publicar el comentario."));
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (item: ProjectTaskComment) => {
    if (item.author_id !== currentUserId || deletingId !== null) return;

    const ok = window.confirm("¿Eliminar este comentario?");
    if (!ok) return;

    try {
      setDeletingId(item.id);
      await deleteProjectTaskComment(item.id);
      setComments((current) =>
        current.filter((commentItem) => commentItem.id !== item.id),
      );
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo eliminar el comentario."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.07] pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#5ac8fa]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.75]">
                Actividad y comentarios
              </span>
            </div>
            <p className="mt-1 text-[11px] font-normal text-white/[0.48]">
              Conversación y trazabilidad de cambios.
            </p>
          </div>

          <span className="rounded-lg bg-white/[0.055] px-2 py-1 text-[10px] font-medium text-white/[0.58]">
            {comments.length} comentario{comments.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1 rounded-[11px] bg-white/[0.035] p-1">
          {(
            [
              ["all", "Todo"],
              ["comments", "Comentarios"],
              ["changes", "Cambios"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`h-7 flex-1 rounded-[8px] px-2 text-[10px] font-medium transition ${
                filter === value
                  ? "bg-white/[0.09] text-white/[0.90]"
                  : "text-white/[0.46] hover:text-white/[0.70]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-white/[0.07] py-3">
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void handlePost();
            }
          }}
          disabled={!canComment || locked}
          maxLength={4000}
          rows={3}
          placeholder={
            locked
              ? "La tarea está cerrada."
              : canComment
                ? "Escribí un comentario..."
                : "Solo lectura"
          }
          className="w-full resize-none rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-[11px] font-normal leading-5 text-white/[0.88] outline-none transition placeholder:text-white/[0.38] focus:border-[#0a84ff]/50 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#0a84ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[9px] font-normal text-white/[0.30]">
            Ctrl/⌘ + Enter para enviar
          </span>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={
              posting || !comment.trim() || !canComment || locked
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#0a84ff] px-3 text-[10px] font-medium text-white transition hover:bg-[#409cff] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/[0.38]"
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publicar
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
        {loading ? (
          <div className="grid min-h-[180px] place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/[0.38]" />
          </div>
        ) : feed.length === 0 ? (
          <div className="grid min-h-[180px] place-items-center text-center">
            <div>
              <History className="mx-auto h-5 w-5 text-white/[0.24]" />
              <p className="mt-2 text-[11px] font-medium text-white/[0.55]">
                Todavía no hay actividad en esta vista
              </p>
              <p className="mt-1 text-[10px] font-normal text-white/[0.32]">
                Los cambios y comentarios aparecerán acá.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {feed.map((item) =>
              item.kind === "comment" ? (
                <CommentRow
                  key={item.id}
                  item={item.comment}
                  own={item.comment.author_id === currentUserId}
                  deleting={deletingId === item.comment.id}
                  onDelete={() => void handleDelete(item.comment)}
                />
              ) : (
                <ActivityRow key={item.id} item={item.activity} />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentRow({
  item,
  own,
  deleting,
  onDelete,
}: {
  item: ProjectTaskComment;
  own: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const author = profileLabel(item.author_name, item.author_email, "Usuario");

  return (
    <div className="group rounded-[13px] border border-transparent px-2.5 py-2.5 transition hover:border-white/[0.055] hover:bg-white/[0.025]">
      <div className="flex items-start gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[9px] font-medium text-white/[0.72]">
          {initials(author)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[11px] font-medium text-white/[0.82]">
              {author}
            </span>
            <span className="shrink-0 text-[9px] font-normal text-white/[0.30]">
              {formatDateTime(item.created_at)}
            </span>

            {own ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                title="Eliminar comentario"
                className="ml-auto grid h-6 w-6 place-items-center rounded-lg text-white/[0.20] opacity-0 transition hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100 disabled:opacity-30"
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            ) : null}
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-[11px] font-normal leading-[1.55] text-white/[0.70]">
            {item.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ProjectTaskActivity }) {
  const presentation = eventPresentation(item);
  const Icon = presentation.icon;

  return (
    <div className="flex items-start gap-2.5 rounded-[12px] px-2.5 py-2">
      <div
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${presentation.tone}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-normal leading-5 text-white/[0.58]">
          {presentation.text}
        </div>
        <div className="mt-0.5 text-[9px] font-normal text-white/[0.28]">
          {formatDateTime(item.created_at)}
        </div>
      </div>
    </div>
  );
}
