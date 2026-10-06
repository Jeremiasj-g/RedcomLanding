'use client';

import { useEffect, useState } from 'react';
import { Clock3, Loader2, MessageSquareText, Send, Trash2 } from 'lucide-react';

import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  type TaskComment,
} from '@/lib/tasks';
import { errorMessage, notify } from '@/lib/notifications';

export default function TaskCommentsTimeline({
  taskId,
  compact = false,
  readOnly = false,
}: {
  taskId: number;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchTaskComments(taskId);
        if (!cancelled) setComments(data);
      } catch (error) {
        console.error('Error loading task comments', error);
        if (!cancelled) notify.error(errorMessage(error, 'No se pudieron cargar los comentarios.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function removeComment(comment: TaskComment) {
    if (!confirm('¿Eliminar este comentario?')) return;

    try {
      setDeletingId(comment.id);
      await deleteTaskComment(comment.id);
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
      notify.success('Comentario eliminado.');
    } catch (error) {
      console.error('Error deleting task comment', error);
      notify.error(errorMessage(error, 'No se pudo eliminar el comentario.'));
    } finally {
      setDeletingId(null);
    }
  }

  async function submit() {
    const clean = text.trim();
    if (!clean || sending) return;

    try {
      setSending(true);
      const created = await createTaskComment(taskId, clean);
      setComments((prev) => [...prev, created]);
      setText('');
    } catch (error) {
      console.error('Error creating task comment', error);
      notify.error(errorMessage(error, 'No se pudo agregar el comentario.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={compact ? 'border-t border-white/[0.07] px-4 py-4' : 'border-t border-white/[0.07] px-5 py-5'}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/[0.86]">
            <MessageSquareText className="h-4 w-4 text-[#5ac8fa]" />
            Comentarios y actualizaciones
          </div>
          <p className="mt-1 text-[10px] leading-4 text-white/[0.34]">
            {readOnly
              ? 'Historial cronológico registrado por el usuario.'
              : 'Registrá avances breves para conservar el contexto cronológico de la tarea.'}
          </p>
        </div>
        <span className="rounded-full bg-white/[0.045] px-2 py-1 text-[9px] font-medium text-white/[0.38]">
          {comments.length}
        </span>
      </div>

      {!readOnly ? (
              <div className="mb-4 flex gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  rows={2}
                  placeholder="Ej: Ya enviaron el archivo, continúo con la revisión..."
                  className="min-h-[66px] flex-1 resize-none rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 py-2 text-[11px] leading-5 text-white/[0.82] outline-none placeholder:text-white/[0.24] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
                />
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={sending || !text.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-[11px] bg-[#0a84ff] text-white transition hover:bg-[#409cff] disabled:cursor-not-allowed disabled:opacity-30"
                  title="Agregar actualización"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
      ) : comments.length > 0 ? (
        <p className="mb-3 text-[10px] leading-4 text-white/[0.28]">
          Historial registrado por el usuario. Vista de supervisión en solo lectura.
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[10px] text-white/[0.32]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando historial...
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-white/[0.08] px-3 py-4 text-center text-[10px] text-white/[0.28]">
          Todavía no hay actualizaciones registradas.
        </div>
      ) : (
        <div className={compact ? 'relative max-h-[15rem] space-y-0 overflow-y-auto pl-3 pr-1' : 'relative space-y-0 pl-3'}>
          <div className="absolute bottom-2 left-[17px] top-2 w-px bg-white/[0.07]" />
          {comments.map((comment) => {
            const date = new Date(comment.created_at);
            return (
              <div key={comment.id} className="relative flex gap-3 py-2.5">
                <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#151517] bg-[#0a84ff]" />
                <div className="min-w-0 flex-1 rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-white/[0.68]">
                      {comment.author_name || 'Usuario'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[9px] text-white/[0.30]">
                        <Clock3 className="h-3 w-3" />
                        {date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}{' '}
                        {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!readOnly ? (
                                              <button
                                                type="button"
                                                onClick={() => void removeComment(comment)}
                                                disabled={deletingId === comment.id}
                                                className="grid h-7 w-7 place-items-center rounded-[8px] text-white/[0.24] transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
                                                title="Eliminar comentario"
                                              >
                                                {deletingId === comment.id ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <Trash2 className="h-3 w-3" />
                                                )}
                                              </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-[11px] leading-5 text-white/[0.66]">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
