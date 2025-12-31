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
  Sparkles,
  PlusCircle,
  LayoutGrid,
  Search,
  RefreshCw,
} from 'lucide-react';

type FilterTab = 'activos' | 'archivados' | 'todos';
type ViewTab = 'publicar' | 'publicaciones';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'activos', label: 'Activos' },
  { key: 'archivados', label: 'Archivados' },
  { key: 'todos', label: 'Todos' },
];

export default function RRHHPage() {
  const [items, setItems] = useState<AnnouncementMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewTab, setViewTab] = useState<ViewTab>('publicar'); // ✅ NUEVO
  const [tab, setTab] = useState<FilterTab>('activos'); // filtro de publicaciones
  const [q, setQ] = useState('');

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

  const countActivos = useMemo(() => items.filter((x) => !x.archived_at).length, [items]);
  const countArchivados = useMemo(() => items.filter((x) => !!x.archived_at).length, [items]);

  return (
    <RequireAuth roles={['rrhh', 'admin']}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Panel RRHH
              </h1>
              <p className="text-sm text-slate-500">
                Publicá novedades y gestioná publicaciones con control de lectura (Seen/ACK).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className={cn(
                  'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold',
                  'border border-slate-200 bg-white shadow-sm hover:bg-slate-50',
                  'focus:outline-none focus:ring-4 focus:ring-slate-200/60'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Actualizar
              </button>
            </div>
          </div>

          {/* ✅ Tabs principales (Publicar / Publicaciones) */}
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-2 shadow-sm backdrop-blur">
            <div className="flex flex-wrap gap-2">
              <PrimaryTab
                active={viewTab === 'publicar'}
                onClick={() => setViewTab('publicar')}
                icon={<PlusCircle className="h-4 w-4" />}
                title="Publicar"
                subtitle="Crear / editar contenido"
              />
              <PrimaryTab
                active={viewTab === 'publicaciones'}
                onClick={() => setViewTab('publicaciones')}
                icon={<LayoutGrid className="h-4 w-4" />}
                title="Publicaciones"
                subtitle="Ver, filtrar y gestionar"
                badge={items.length}
              />
            </div>
          </div>

          {/* ✅ Contenido */}
          <div className="mt-6">
            <AnimatePresence mode="wait" initial={false}>
              {viewTab === 'publicar' ? (
                <motion.section
                  key="tab-publicar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/10 via-sky-500/8 to-transparent" />
                    <div className="relative p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm">
                            <Sparkles className="h-4 w-4" />
                            Editor de Novedades
                          </span>
                          <span className="text-xs text-slate-500">
                            Publicá avisos, noticias, semanales o cumpleaños.
                          </span>
                        </div>

                        <div className="text-xs text-slate-500">
                          Tip: si editás una publicación, se abre en modal desde “Publicaciones”.
                        </div>
                      </div>

                      <div className="mt-4">
                        <AnnouncementEditor
                          onSaved={() => {
                            load();
                            // UX: cuando guardás, te llevo al tab de publicaciones
                            setViewTab('publicaciones');
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="tab-publicaciones"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Controles */}
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-lg font-extrabold text-slate-900">Publicaciones</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {loading ? 'Cargando…' : `${filtered.length} resultados`}
                            <span className="mx-2 text-slate-300">•</span>
                            <span className="text-slate-600 font-semibold">{countActivos}</span>{' '}
                            activos
                            <span className="mx-2 text-slate-300">•</span>
                            <span className="text-slate-600 font-semibold">{countArchivados}</span>{' '}
                            archivados
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              className={cn(
                                'w-[min(380px,92vw)] rounded-2xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm',
                                'shadow-sm outline-none',
                                'focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60'
                              )}
                              placeholder="Buscar por título / tipo / severidad…"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tabs de filtro */}
                      <div className="mt-4 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                        {filterTabs.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                              'px-4 py-2 text-sm font-semibold rounded-xl transition',
                              tab === t.key
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tabla */}
                    <div className="border-t border-slate-200 overflow-hidden">
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
                                        icon={
                                          it.pinned ? (
                                            <PinOff className="h-4 w-4" />
                                          ) : (
                                            <Pin className="h-4 w-4" />
                                          )
                                        }
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
                  </div>

                  {/* Modals */}
                  <AnimatePresence>
                    {editing ? (
                      <Modal onClose={() => setEditing(null)} title="Editar publicación">
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
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}

/* ---------------- UI: Tabs principales ---------------- */
function PrimaryTab({
  active,
  onClick,
  icon,
  title,
  subtitle,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex-1 min-w-[260px] rounded-3xl border p-4 text-left transition',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <span
            className={cn(
              'grid place-items-center h-9 w-9 rounded-2xl border',
              active ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-white'
            )}
          >
            {icon}
          </span>

          <div>
            <div className={cn('font-extrabold', active ? 'text-white' : 'text-slate-900')}>
              {title}
            </div>
            <div className={cn('text-xs', active ? 'text-white/80' : 'text-slate-500')}>
              {subtitle}
            </div>
          </div>
        </div>

        {typeof badge === 'number' ? (
          <span
            className={cn(
              'inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-extrabold',
              active ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {active ? (
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/20" />
      ) : null}
    </button>
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
        className={cn(
          'grid place-items-center h-9 w-9 rounded-xl border transition',
          'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300',
          'focus:outline-none focus:ring-2 focus:ring-slate-300',
          danger && 'text-red-700 hover:bg-red-50 hover:border-red-200'
        )}
      >
        {icon}
      </button>

      <div
        className={cn(
          'pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2',
          'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100',
          'group-focus-within:opacity-100 group-focus-within:scale-100',
          'transition bg-slate-900 text-white text-[11px] font-semibold',
          'px-2 py-1 rounded-md shadow-lg whitespace-nowrap'
        )}
      >
        {label}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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
          <div className="font-extrabold text-slate-900">{title ?? 'Detalle'}</div>
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
