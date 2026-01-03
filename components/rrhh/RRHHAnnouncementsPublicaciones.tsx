'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnnouncementEditor } from '@/components/rrhh/AnnouncementEditorV1';

import {
  rrhhArchiveAnnouncement,
  rrhhDeleteAnnouncement,
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
  Search,
  Filter,
  X,
  ChevronsUpDown,
  Check,
  Users2, // ✅ NEW
} from 'lucide-react';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

type FilterTab = 'activos' | 'archivados' | 'todos';
type TypeFilter = 'all' | 'news' | 'weekly' | 'birthday';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'news', label: 'Noticias' },
  { value: 'weekly', label: 'Semanales' },
  { value: 'birthday', label: 'Cumpleaños' },
];

export default function RRHHAnnouncementsPublicaciones({
  items,
  loading,
  countActivos,
  countArchivados,
  onReload,
}: {
  items: AnnouncementMetric[];
  loading: boolean;
  countActivos: number;
  countArchivados: number;
  onReload: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<FilterTab>('activos');
  const [q, setQ] = useState('');

  // filtro tipo
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // estado
  const [showAllToggle, setShowAllToggle] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);
  const [onlyArchived, setOnlyArchived] = useState(false);

  // modals
  const [editing, setEditing] = useState<any | null>(null);

  const [readsOpen, setReadsOpen] = useState(false);
  const [readsFor, setReadsFor] = useState<AnnouncementMetric | null>(null);
  const [reads, setReads] = useState<any[]>([]);
  const [readsLoading, setReadsLoading] = useState(false);

  // ✅ NEW: audience modal
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [audienceFor, setAudienceFor] = useState<AnnouncementMetric | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ✅ selection / bulk actions (id es string en tu typing)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Sync tab con toggles
  useEffect(() => {
    if (showAllToggle) {
      setTab('todos');
      setOnlyActive(false);
      setOnlyArchived(false);
      return;
    }
    if (onlyArchived) {
      setTab('archivados');
      return;
    }
    setTab('activos');
  }, [showAllToggle, onlyActive, onlyArchived]);

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

      const byType = typeFilter === 'all' ? true : it.type === typeFilter;

      return byTab && byQ && byType;
    });
  }, [items, q, tab, typeFilter]);

  // Reset page cuando cambian filtros
  useEffect(() => {
    setPage(1);
  }, [q, tab, typeFilter, pageSize]);

  // Limpia selección cuando cambian filtros (evita borrar cosas “ocultas”)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [q, tab, typeFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const rangeText = useMemo(() => {
    if (total === 0) return '0';
    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, total);
    return `${start}–${end}`;
  }, [total, safePage, pageSize]);

  // ✅ selection helpers
  const selectedCount = selectedIds.size;

  const isSelected = (id: string) => selectedIds.has(id);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const pageIds = useMemo<string[]>(
    () => pageItems.map((x) => String(x.id)),
    [pageItems]
  );

  const allPageSelected = useMemo(() => {
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => selectedIds.has(id));
  }, [pageIds, selectedIds]);

  const somePageSelected = useMemo(() => {
    if (pageIds.length === 0) return false;
    return pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;
  }, [pageIds, selectedIds, allPageSelected]);

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = !allPageSelected;
      pageIds.forEach((id) => {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  // actions
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

  // ✅ NEW
  const openAudience = (it: AnnouncementMetric) => {
    setAudienceFor(it);
    setAudienceOpen(true);
  };

  const toggleActive = async (it: AnnouncementMetric) => {
    await rrhhUpdateAnnouncement(it.id, { is_active: !it.is_active });
    await onReload();
  };

  const togglePinned = async (it: AnnouncementMetric) => {
    await rrhhUpdateAnnouncement(it.id, { pinned: !it.pinned });
    await onReload();
  };

  const archive = async (it: AnnouncementMetric) => {
    await rrhhArchiveAnnouncement(it.id);
    await onReload();
  };

  const restore = async (it: AnnouncementMetric) => {
    await rrhhRestoreAnnouncement(it.id);
    await onReload();
  };

  const removeOne = async (it: AnnouncementMetric) => {
    const ok = confirm(`Eliminar "${it.title}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    await rrhhDeleteAnnouncement(it.id);
    await onReload();
  };

  // ✅ Bulk: delete selected
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const ok = confirm(
      `Eliminar ${selectedIds.size} publicación(es)? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => rrhhDeleteAnnouncement(id)));
      clearSelection();
      await onReload();
    } finally {
      setBulkDeleting(false);
    }
  };

  // ✅ Bulk: delete all filtered (opcional)
  const deleteAllFiltered = async () => {
    if (filtered.length === 0) return;

    const ok = confirm(
      `Eliminar TODO lo filtrado (${filtered.length})?\n\nTip: si querés algo más seguro, usá “Eliminar seleccionados”.`
    );
    if (!ok) return;

    setBulkDeleting(true);
    try {
      await Promise.all(filtered.map((it) => rrhhDeleteAnnouncement(it.id)));
      clearSelection();
      await onReload();
    } finally {
      setBulkDeleting(false);
    }
  };

  const resetFilters = () => {
    setQ('');
    setTypeFilter('all');
    setShowAllToggle(false);
    setOnlyActive(true);
    setOnlyArchived(false);
    clearSelection();
  };

  return (
    <>
      {/* Controles */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-900">Publicaciones</div>
              <div className="mt-1 text-sm text-slate-500">
                {loading ? 'Cargando…' : `${filtered.length} resultados`}
                <span className="mx-2 text-slate-300">•</span>
                <span className="text-slate-600 font-semibold">{countActivos}</span> activos
                <span className="mx-2 text-slate-300">•</span>
                <span className="text-slate-600 font-semibold">{countArchivados}</span> archivados
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className={cn('w-[min(420px,92vw)] rounded-2xl pl-9 h-11')}
                  placeholder="Buscar por título / tipo / severidad…"
                />
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <Combo
              label="Tipo"
              value={typeFilter}
              display={TYPE_OPTIONS.find((x) => x.value === typeFilter)?.label ?? '—'}
              options={TYPE_OPTIONS}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
            />

            <div className="flex items-end justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl h-11"
                onClick={resetFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="rounded-2xl h-11"
                onClick={deleteAllFiltered}
                disabled={loading || bulkDeleting || filtered.length === 0}
                title="Elimina todo lo filtrado"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Borrar todo
              </Button>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Estado */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <Badge variant="secondary" className="rounded-xl inline-flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Estado
              </Badge>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showAllToggle}
                    onCheckedChange={(v) => {
                      setShowAllToggle(v);
                      if (v) {
                        setOnlyActive(false);
                        setOnlyArchived(false);
                      } else {
                        setOnlyActive(true);
                        setOnlyArchived(false);
                      }
                    }}
                  />
                  <span className="text-sm font-semibold text-slate-800">Todos</span>
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={onlyActive}
                    onCheckedChange={(v) => {
                      const next = Boolean(v);
                      setOnlyActive(next);
                      if (next) {
                        setOnlyArchived(false);
                        setShowAllToggle(false);
                      }
                    }}
                    disabled={showAllToggle}
                  />
                  <span className={cn('text-sm font-semibold', showAllToggle ? 'text-slate-400' : 'text-slate-700')}>
                    Solo activos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={onlyArchived}
                    onCheckedChange={(v) => {
                      const next = Boolean(v);
                      setOnlyArchived(next);
                      if (next) {
                        setOnlyActive(false);
                        setShowAllToggle(false);
                      } else {
                        setOnlyActive(true);
                      }
                    }}
                    disabled={showAllToggle}
                  />
                  <span className={cn('text-sm font-semibold', showAllToggle ? 'text-slate-400' : 'text-slate-700')}>
                    Solo archivados
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Filtro actual:</span>
              <Badge className="rounded-xl" variant="secondary">
                {tab.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Bulk bar */}
          {selectedCount > 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-700">
                <span className="font-extrabold">{selectedCount}</span> seleccionadas
                {somePageSelected ? <span className="text-slate-500"> (parcial en esta página)</span> : null}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl h-9"
                  onClick={clearSelection}
                  disabled={bulkDeleting}
                >
                  Limpiar
                </Button>

                <Button
                  variant="destructive"
                  className="rounded-xl h-9"
                  onClick={deleteSelected}
                  disabled={bulkDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar seleccionados
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Tabla */}
        <div className="border-t border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  {/* checkbox header */}
                  <th className="px-3 py-3 w-[48px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleSelectAllPage}
                        aria-label="Seleccionar todos los items de la página"
                      />
                    </div>
                  </th>

                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vistos / ACK</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pageItems.map((it) => {
                  const id = String(it.id);

                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected(id)}
                            onCheckedChange={() => toggleSelect(id)}
                            aria-label={`Seleccionar ${it.title}`}
                          />
                        </div>
                      </td>

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
                          {it.is_published ? 'Publicado' : 'Borrador'} • {it.is_active ? 'Activo' : 'Inactivo'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl h-9 text-xs font-bold"
                          onClick={() => openReads(it)}
                        >
                          {it.seen_count} vistos • {it.ack_count} ack
                        </Button>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(it.created_at).toLocaleString()}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
                            <IconButton label="Editar" onClick={() => setEditing(it)} icon={<Pencil className="h-4 w-4" />} />

                            {/* ✅ NEW: Audiencia */}
                            <IconButton label="Audiencia" onClick={() => openAudience(it)} icon={<Users2 className="h-4 w-4" />} />

                            <IconButton
                              label={it.is_active ? 'Desactivar' : 'Activar'}
                              onClick={() => toggleActive(it)}
                              icon={it.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            />

                            <IconButton
                              label={it.pinned ? 'Quitar pin' : 'Fijar (pin)'}
                              onClick={() => togglePinned(it)}
                              icon={it.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                            />

                            {!it.archived_at ? (
                              <IconButton label="Archivar" onClick={() => archive(it)} icon={<Archive className="h-4 w-4" />} />
                            ) : (
                              <IconButton label="Restaurar" onClick={() => restore(it)} icon={<RotateCcw className="h-4 w-4" />} />
                            )}

                            <IconButton label="Vistos / ACK" onClick={() => openReads(it)} icon={<Eye className="h-4 w-4" />} />

                            <IconButton label="Eliminar" onClick={() => removeOne(it)} danger icon={<Trash2 className="h-4 w-4" />} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-600">
                      No hay publicaciones para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              Mostrando <span className="font-bold text-slate-900">{rangeText}</span> de{' '}
              <span className="font-bold text-slate-900">{total}</span>
            </div>

            <div className="flex items-center gap-2">
              <PageSizeSelect value={pageSize} onChange={setPageSize} />
              <div className="w-px h-7 bg-slate-200 mx-1" />

              <Button
                variant="outline"
                className="rounded-xl h-9 px-3"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Anterior
              </Button>

              <div className="text-xs font-bold text-slate-700 px-2">
                {safePage} / {totalPages}
              </div>

              <Button
                variant="outline"
                className="rounded-xl h-9 px-3"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Siguiente
              </Button>
            </div>
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
                onReload();
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

      {/* ✅ NEW: Audience modal */}
      <AnimatePresence>
        {audienceOpen ? (
          <Modal
            onClose={() => setAudienceOpen(false)}
            title={`Audiencia — ${audienceFor?.title ?? ''}`}
          >
            <div className="text-xs text-slate-500 mb-3">
              A quién le aparece esta publicación (según <span className="font-semibold">audience</span>).
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {renderAudience((audienceFor as any)?.audience)}
            </div>

            <Separator className="my-4" />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-extrabold text-slate-700">JSON (debug)</div>
              <pre className="mt-2 text-[12px] leading-relaxed text-slate-700 overflow-auto">
                {JSON.stringify((audienceFor as any)?.audience ?? null, null, 2)}
              </pre>
            </div>
          </Modal>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ---------------- Dropdown PRO (Popover + Command) ---------------- */
function Combo({
  label,
  value,
  display,
  options,
  onChange,
}: {
  label: string;
  value: string;
  display: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-extrabold text-slate-700">{label}</div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-800',
              'shadow-sm hover:bg-slate-50 transition flex items-center justify-between'
            )}
          >
            <span className="truncate">{display}</span>
            <ChevronsUpDown className="h-4 w-4 text-slate-500" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="p-0 w-[280px]" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
            <CommandList className="max-h-[240px]">
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <span className="font-semibold">{opt.label}</span>
                    {value === opt.value ? <Check className="h-4 w-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ---------------- Page size select ---------------- */
function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const options = [5, 10, 15, 20, 30];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-600">Filas:</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
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

// ✅ NEW helper: render audience
function renderAudience(audience: any) {
  const a = audience ?? null;

  if (!a) {
    return (
      <div className="text-sm text-slate-700">
        <div className="font-extrabold text-slate-900">No disponible</div>
        <div className="mt-1 text-xs text-slate-500">
          Este item no trae <span className="font-semibold">audience</span> en la lista. Si querés verlo siempre,
          incluí <span className="font-semibold">audience</span> en el select del hook que arma <code>items</code>.
        </div>
      </div>
    );
  }

  const all = Boolean(a.all ?? true);
  const roles: string[] = Array.isArray(a.roles) ? a.roles : [];
  const branches: string[] = Array.isArray(a.branches) ? a.branches : [];

  if (all) {
    return (
      <div>
        <div className="text-sm font-extrabold text-slate-900">Todos los usuarios</div>
        <div className="mt-1 text-xs text-slate-500">No hay filtros por rol ni sucursal.</div>
      </div>
    );
  }

  const hasRoles = roles.length > 0;
  const hasBranches = branches.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-extrabold text-slate-700">Modo</div>
        <div className="mt-1 text-sm font-extrabold text-slate-900">Audiencia segmentada</div>
        <div className="mt-1 text-xs text-slate-500">
          Para ver esta publicación, el usuario debe cumplir los filtros configurados.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-extrabold text-slate-700">Roles</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {!hasRoles ? (
              <span className="text-xs text-slate-500">Sin filtro (todos los roles)</span>
            ) : (
              roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-800"
                >
                  {String(r).toUpperCase()}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-extrabold text-slate-700">Sucursales</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {!hasBranches ? (
              <span className="text-xs text-slate-500">Sin filtro (todas las sucursales)</span>
            ) : (
              branches.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800"
                >
                  {String(b)}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
          <Button onClick={onClose} className="rounded-xl">
            Cerrar
          </Button>
        </div>

        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}
