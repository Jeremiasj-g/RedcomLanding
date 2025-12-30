'use client';

import { useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '@/components/RouteGuards';
import { AnnouncementEditor } from '@/components/rrhh/AnnouncementEditor';

import {
  rrhhArchiveAnnouncement,
  rrhhDeleteAnnouncement,
  rrhhFetchAnnouncementsMetrics,
  rrhhFetchReads,
  rrhhRestoreAnnouncement,
  rrhhUpdateAnnouncement,
  type AnnouncementMetric,
} from '@/hooks/rrhh/announcements';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Pencil,
  Power,
  PowerOff,
  Pin,
  PinOff,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
} from 'lucide-react';



type Tab = 'activos' | 'archivados' | 'todos';

export default function RRHHPage() {
  const [items, setItems] = useState<AnnouncementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('activos');

  const [editing, setEditing] = useState<any | null>(null);
  const [readsOpen, setReadsOpen] = useState(false);
  const [readsFor, setReadsFor] = useState<AnnouncementMetric | null>(null);
  const [reads, setReads] = useState<any[]>([]);
  const [readsLoading, setReadsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await rrhhFetchAnnouncementsMetrics();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return items.filter((it) => {
      const byTab =
        tab === 'todos'
          ? true
          : tab === 'activos'
            ? it.archived_at == null
            : it.archived_at != null;

      const byQ =
        !query ||
        it.title.toLowerCase().includes(query) ||
        it.type.toLowerCase().includes(query) ||
        it.severity.toLowerCase().includes(query);

      return byTab && byQ;
    });
  }, [items, q, tab]);

  const openReads = async (it: AnnouncementMetric) => {
    setReadsFor(it);
    setReadsOpen(true);
    setReadsLoading(true);
    try {
      const data = await rrhhFetchReads(it.id);
      setReads(data);
    } finally {
      setReadsLoading(false);
    }
  };

  const toggleActive = async (it: AnnouncementMetric) => {
    await rrhhUpdateAnnouncement(it.id, { is_active: !it.is_active });
    load();
  };

  const togglePinned = async (it: AnnouncementMetric) => {
    await rrhhUpdateAnnouncement(it.id, { pinned: !it.pinned });
    load();
  };

  const archive = async (it: AnnouncementMetric) => {
    await rrhhArchiveAnnouncement(it.id);
    load();
  };

  const restore = async (it: AnnouncementMetric) => {
    await rrhhRestoreAnnouncement(it.id);
    load();
  };

  const remove = async (it: AnnouncementMetric) => {
    const ok = confirm(`Eliminar "${it.title}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    await rrhhDeleteAnnouncement(it.id);
    load();
  };

  return (
    <RequireAuth roles={['rrhh', 'admin']}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Panel RRHH</h1>
            <p className="text-sm text-slate-500">Gestión profesional de novedades y alertas.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[min(320px,60vw)] rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Buscar por título / tipo / severidad…"
            />
            <button
              onClick={load}
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {[
            { key: 'activos', label: 'Activos' },
            { key: 'archivados', label: 'Archivados' },
            { key: 'todos', label: 'Todos' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={[
                'px-4 py-2 text-sm font-semibold rounded-xl transition',
                tab === t.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="mt-6">
          <AnnouncementEditor onSaved={load} />
        </div>

        {/* Table */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="font-extrabold text-slate-900">Publicaciones</div>
            <div className="text-xs text-slate-500">
              {loading ? 'Cargando…' : `${filtered.length} resultados`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vistos / ACK</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-slate-900">{it.title}</div>
                      <div className="mt-1 flex gap-2 flex-wrap text-xs">
                        {it.pinned ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-bold">
                            PINNED
                          </span>
                        ) : null}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                          {it.severity.toUpperCase()}
                        </span>
                        {it.require_ack ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-bold">
                            REQUIERE ACK
                          </span>
                        ) : null}
                        {it.archived_at ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold">
                            ARCHIVADO
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-700">{it.type}</td>

                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600">
                        {it.is_published ? 'Publicado' : 'Borrador'} •{' '}
                        {it.is_active ? 'Activo' : 'Inactivo'}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => openReads(it)}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        {it.seen_count} vistos • {it.ack_count} ack
                      </button>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(it.created_at).toLocaleString()}
                    </td>

                    {/* ✅ Acciones con iconos + tooltip */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                          <IconButton
                            label="Editar"
                            onClick={() => setEditing(it)}
                            icon={<Pencil className="h-4 w-4" />}
                          />

                          <IconButton
                            label={it.is_active ? 'Desactivar' : 'Activar'}
                            onClick={() => toggleActive(it)}
                            icon={
                              it.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )
                            }
                          />

                          <IconButton
                            label={it.pinned ? 'Quitar pin' : 'Fijar (pin)'}
                            onClick={() => togglePinned(it)}
                            icon={it.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                          />

                          {!it.archived_at ? (
                            <IconButton
                              label="Archivar"
                              onClick={() => archive(it)}
                              icon={<Archive className="h-4 w-4" />}
                            />
                          ) : (
                            <IconButton
                              label="Restaurar"
                              onClick={() => restore(it)}
                              icon={<RotateCcw className="h-4 w-4" />}
                            />
                          )}

                          <IconButton
                            label="Vistos / ACK"
                            onClick={() => openReads(it)}
                            icon={<Eye className="h-4 w-4" />}
                          />

                          <IconButton
                            label="Eliminar"
                            onClick={() => remove(it)}
                            danger
                            icon={<Trash2 className="h-4 w-4" />}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-600">
                      No hay publicaciones para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal edición */}
        <AnimatePresence>
          {editing ? (
            <Modal onClose={() => setEditing(null)}>
              <AnnouncementEditor
                initial={editing}
                onSaved={() => {
                  setEditing(null);
                  load();
                }}
              />
            </Modal>
          ) : null}
        </AnimatePresence>

        {/* Modal vistos */}
        <AnimatePresence>
          {readsOpen ? (
            <Modal
              onClose={() => setReadsOpen(false)}
              title={`Vistos / ACK — ${readsFor?.title ?? ''}`}
            >
              <div className="text-xs text-slate-500 mb-3">
                {readsFor?.seen_count ?? 0} vistos • {readsFor?.ack_count ?? 0} ack
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-4 bg-slate-50 text-xs font-bold text-slate-600">
                  <div className="p-3">User</div>
                  <div className="p-3">Seen</div>
                  <div className="p-3">ACK</div>
                  <div className="p-3">Dismiss</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {readsLoading ? (
                    <div className="p-4 text-sm text-slate-600">Cargando…</div>
                  ) : reads.length === 0 ? (
                    <div className="p-4 text-sm text-slate-600">Sin lecturas aún.</div>
                  ) : (
                    reads.map((r) => (
                      <div key={r.user_id} className="grid grid-cols-4 text-xs">
                        <div className="p-3 text-slate-900 font-semibold">
                          {r.full_name ?? r.email ?? r.user_id}
                        </div>
                        <div className="p-3 text-slate-600">{fmt(r.seen_at)}</div>
                        <div className="p-3 text-slate-600">{fmt(r.acknowledged_at)}</div>
                        <div className="p-3 text-slate-600">{fmt(r.dismissed_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Modal>
          ) : null}
        </AnimatePresence>
      </div>
    </RequireAuth>
  );
}

/* ---------------- Icon button con tooltip ---------------- */
function IconButton({
  label,
  onClick,
  icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={[
          'grid place-items-center h-9 w-9 rounded-xl border text-slate-700 transition',
          'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300',
          'focus:outline-none focus:ring-2 focus:ring-slate-300',
          danger ? 'text-red-700 hover:bg-red-50 hover:border-red-200' : '',
        ].join(' ')}
      >
        {icon}
      </button>

      {/* tooltip */}
      <div
        className={[
          'pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2',
          'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100',
          'group-focus-within:opacity-100 group-focus-within:scale-100',
          'transition bg-slate-900 text-white text-[11px] font-semibold',
          'px-2 py-1 rounded-md shadow-lg whitespace-nowrap',
        ].join(' ')}
      >
        {label}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function fmt(v?: string | null) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />

      <motion.div
        className="relative w-[min(1100px,92vw)] max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        initial={{ y: 18, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="font-extrabold text-slate-900">{title ?? 'Editar'}</div>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}
