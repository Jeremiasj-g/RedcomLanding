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
  Filter,
  Check,
  ChevronsUpDown,
  Calendar as CalendarIcon,
  X,
  CheckCircle2,
  Clock,
  ListChecks,
  Wand2,
  Heart,
  Newspaper,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

type FilterTab = 'activos' | 'archivados' | 'todos';
type ViewTab = 'publicar' | 'publicaciones';

type TypeFilter = 'all' | 'news' | 'weekly' | 'birthday';
type SeverityFilter = 'all' | 'info' | 'success' | 'warning' | 'danger';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'news', label: 'Noticias' },
  { value: 'weekly', label: 'Semanales' },
  { value: 'birthday', label: 'Cumpleaños' },
];

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'Todas las severidades' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'OK' },
  { value: 'warning', label: 'Atención' },
  { value: 'danger', label: 'Crítico' },
];

// Plantillas rápidas (texto sugerido)
const QUICK_TEMPLATES = [
  {
    key: 'birthday',
    title: 'Cumpleaños del día',
    icon: <Heart className="h-4 w-4" />,
    hint: 'Post rápido para festejar en la home',
    payload: {
      type: 'birthday',
      severity: 'info',
      title: '🎉 Cumpleaños de hoy',
      content:
        '¡Feliz cumple! 🎂\n\n• Nombre Apellido\n• Nombre Apellido\n\nQue tengan un gran día 🙌',
      pinned: true,
      require_ack: false,
    },
  },
  {
    key: 'weekly',
    title: 'Resumen semanal',
    icon: <CalendarDays className="h-4 w-4" />,
    hint: 'Ideal para objetivos / recordatorios',
    payload: {
      type: 'weekly',
      severity: 'info',
      title: '📌 Resumen semanal',
      content:
        'Esta semana:\n\n• Punto 1\n• Punto 2\n• Punto 3\n\nGracias a todos 🙌',
      pinned: false,
      require_ack: false,
    },
  },
  {
    key: 'news',
    title: 'Noticia interna',
    icon: <Newspaper className="h-4 w-4" />,
    hint: 'Comunicado general',
    payload: {
      type: 'news',
      severity: 'success',
      title: '📰 Novedad',
      content:
        'Compartimos la siguiente novedad:\n\n—\n\nGracias.',
      pinned: false,
      require_ack: false,
    },
  },
  {
    key: 'warning',
    title: 'Aviso importante',
    icon: <AlertTriangle className="h-4 w-4" />,
    hint: 'Cuando hay impacto operativo',
    payload: {
      type: 'news',
      severity: 'warning',
      title: '⚠️ Aviso importante',
      content:
        'Atención:\n\n• Qué cambia\n• Desde cuándo\n• A quién afecta\n\nGracias.',
      pinned: true,
      require_ack: true,
    },
  },
] as const;

export default function RRHHPage() {
  const [items, setItems] = useState<AnnouncementMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewTab, setViewTab] = useState<ViewTab>('publicar');
  const [tab, setTab] = useState<FilterTab>('activos');
  const [q, setQ] = useState('');

  // Filtros pro (Publicaciones)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // “Todos” como toggle + checkboxes lindos
  const [showAllToggle, setShowAllToggle] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);
  const [onlyArchived, setOnlyArchived] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);

  const [readsOpen, setReadsOpen] = useState(false);
  const [readsFor, setReadsFor] = useState<AnnouncementMetric | null>(null);
  const [reads, setReads] = useState<any[]>([]);
  const [readsLoading, setReadsLoading] = useState(false);

  // ✅ NUEVO: “template draft” para inyectar al editor (sin tocar tu componente)
  const [templateDraft, setTemplateDraft] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await rrhhFetchAnnouncementsMetrics();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Sync tab base con toggles
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
      const bySeverity = severityFilter === 'all' ? true : it.severity === severityFilter;

      const created = safeDate(it.created_at);
      const byFrom = !dateFrom ? true : created ? created >= startOfDay(dateFrom) : true;
      const byTo = !dateTo ? true : created ? created <= endOfDay(dateTo) : true;

      return byTab && byQ && byType && bySeverity && byFrom && byTo;
    });
  }, [items, q, tab, typeFilter, severityFilter, dateFrom, dateTo]);

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

  const resetFilters = () => {
    setQ('');
    setTypeFilter('all');
    setSeverityFilter('all');
    setDateFrom(null);
    setDateTo(null);

    setShowAllToggle(false);
    setOnlyActive(true);
    setOnlyArchived(false);
  };

  const countActivos = useMemo(() => items.filter((x) => !x.archived_at).length, [items]);
  const countArchivados = useMemo(() => items.filter((x) => !!x.archived_at).length, [items]);

  return (
    <RequireAuth roles={['rrhh', 'admin']}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/6 via-indigo-500/8 to-transparent" />
            <div className="relative p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900 shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    Panel RRHH
                  </div>

                  <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    Publicaciones internas
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Publicá novedades y gestioná publicaciones con control de lectura (Seen/ACK).
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-xl">
                      {items.length} total
                    </Badge>
                    <Badge variant="secondary" className="rounded-xl">
                      {countActivos} activos
                    </Badge>
                    <Badge variant="secondary" className="rounded-xl">
                      {countArchivados} archivados
                    </Badge>
                  </div>
                </div>

                <Button onClick={load} variant="outline" className="rounded-2xl bg-white">
                  <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                  Actualizar
                </Button>
              </div>

              <Separator className="my-5" />

              {/* Tabs principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          </div>

          {/* Contenido */}
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
                  {/* ✅ Split layout: Editor + Checklist + Plantillas */}
                  <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
                    {/* Editor */}
                    <div className="relative overflow-hidden rounded-3xl shadow-sm">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/10 via-sky-500/8 to-transparent" />
                      <div className="relative">
                        <div>
                          {/* ✅ Si tu AnnouncementEditor acepta initial, esto funciona.
                              Si no lo acepta, no rompe: simplemente no pasa nada.
                              (pero lo más probable es que sí, porque ya lo usás para editar) */}
                          <AnnouncementEditor
                            initial={templateDraft ?? undefined}
                            onSaved={() => {
                              setTemplateDraft(null);
                              load();
                              setViewTab('publicaciones');
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Side panel */}
                    <div className="space-y-4">
                      {/* Checklist pro (restaurado) */}
                      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-5 sm:p-6">
                          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-800">
                            <ListChecks className="h-4 w-4" />
                            Checklist
                          </div>

                          <div className="mt-4 space-y-3">
                            <TipRow
                              icon={<CheckCircle2 className="h-4 w-4" />}
                              title="Título corto y claro"
                              desc="Máximo 1 línea en mobile."
                            />
                            <TipRow
                              icon={<Clock className="h-4 w-4" />}
                              title="Programá horario"
                              desc="Usá el selector de hora buscable."
                            />
                            <TipRow
                              icon={<CheckCircle2 className="h-4 w-4" />}
                              title="Severidad coherente"
                              desc="Info / Warning / Danger según impacto."
                            />
                            <TipRow
                              icon={<AlertTriangle className="h-4 w-4" />}
                              title="Evitar paredes de texto"
                              desc="Usá saltos de línea y bullets."
                              tone="warn"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Plantillas rápidas (restaurado + mejorado) */}
                      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-800">
                                <Wand2 className="h-4 w-4" />
                                Plantillas rápidas
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2">
                            {QUICK_TEMPLATES.map((t) => (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => {
                                  setTemplateDraft({
                                    ...t.payload,
                                    // por si tu editor usa otros nombres internos,
                                    // al menos title/content/type/severity suelen coincidir
                                  });
                                  // aseguramos que estás en publicar
                                  setViewTab('publicar');
                                }}
                                className={cn(
                                  'group rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition',
                                  'hover:bg-slate-50 hover:border-slate-300'
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <span className="grid place-items-center h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 group-hover:bg-white">
                                      {t.icon}
                                    </span>
                                    <div>
                                      <div className="text-sm font-extrabold text-slate-900">
                                        {t.title}
                                      </div>
                                      <div className="text-xs text-slate-500">{t.hint}</div>
                                    </div>
                                  </div>

                                  <Badge className="rounded-xl" variant="secondary">
                                    {String((t.payload as any).type).toUpperCase()}
                                  </Badge>
                                </div>
                              </button>
                            ))}
                          </div>

                          {templateDraft ? (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                              Plantilla aplicada al editor (podés modificarla antes de publicar)
                            </div>
                          ) : (
                            <div className="mt-3 text-xs text-slate-500">
                              Tip: la plantilla “Aviso importante” ya viene con <b>PIN</b> + <b>ACK</b>.
                            </div>
                          )}
                        </div>
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
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                            <Input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              className={cn('w-[min(420px,92vw)] rounded-2xl pl-9 h-11')}
                              placeholder="Buscar por título / tipo / severidad…"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Barra filtros PRO */}
                      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3">
                        <Combo
                          label="Tipo"
                          value={typeFilter}
                          display={TYPE_OPTIONS.find((x) => x.value === typeFilter)?.label ?? '—'}
                          options={TYPE_OPTIONS}
                          onChange={(v) => setTypeFilter(v as TypeFilter)}
                        />

                        <Combo
                          label="Severidad"
                          value={severityFilter}
                          display={
                            SEVERITY_OPTIONS.find((x) => x.value === severityFilter)?.label ??
                            '—'
                          }
                          options={SEVERITY_OPTIONS}
                          onChange={(v) => setSeverityFilter(v as SeverityFilter)}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <DatePick label="Desde" value={dateFrom} onChange={setDateFrom} />
                          <DatePick label="Hasta" value={dateTo} onChange={setDateTo} />
                        </div>

                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl h-11"
                            onClick={resetFilters}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Reset
                          </Button>
                        </div>
                      </div>

                      <Separator className="my-5" />

                      {/* “Todos” toggle + checkboxes */}
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="rounded-xl inline-flex items-center gap-2"
                          >
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
                              <span
                                className={cn(
                                  'text-sm font-semibold',
                                  showAllToggle ? 'text-slate-400' : 'text-slate-700'
                                )}
                              >
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
                              <span
                                className={cn(
                                  'text-sm font-semibold',
                                  showAllToggle ? 'text-slate-400' : 'text-slate-700'
                                )}
                              >
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

                                <td className="px-4 py-3 font-semibold text-slate-700">
                                  {it.type}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="text-xs text-slate-600">
                                    {it.is_published ? 'Publicado' : 'Borrador'} •{' '}
                                    {it.is_active ? 'Activo' : 'Inactivo'}
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
                                <td
                                  colSpan={6}
                                  className="px-4 py-10 text-center text-sm text-slate-600"
                                >
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

/* ---------------- TipRow ---------------- */
function TipRow({
  icon,
  title,
  desc,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 flex items-start gap-3',
        tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
      )}
    >
      <div
        className={cn(
          'grid place-items-center h-9 w-9 rounded-2xl border',
          tone === 'warn'
            ? 'border-amber-200 bg-white text-amber-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        )}
      >
        {icon}
      </div>
      <div>
        <div className={cn('text-sm font-extrabold', tone === 'warn' ? 'text-amber-900' : 'text-slate-900')}>
          {title}
        </div>
        <div className={cn('text-xs', tone === 'warn' ? 'text-amber-800' : 'text-slate-500')}>
          {desc}
        </div>
      </div>
    </div>
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

/* ---------------- Calendar PRO (Popover + Calendar) ---------------- */
function DatePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
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
            <span className="truncate">{value ? value.toLocaleDateString() : 'Seleccionar fecha'}</span>
            <CalendarIcon className="h-4 w-4 text-slate-500" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="p-0 w-[320px]" align="start">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-xs font-extrabold text-slate-700">Elegir fecha</div>
            <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => onChange(null)}>
              Limpiar
            </Button>
          </div>

          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => onChange(d ?? null)}
            initialFocus
          />

          <div className="p-3 border-t border-slate-200 flex justify-end bg-white">
            <Button type="button" className="rounded-2xl" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </PopoverContent>
      </Popover>
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

function safeDate(v: any): Date | null {
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
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
