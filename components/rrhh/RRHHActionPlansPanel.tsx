'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Target,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

import {
  fetchRRHHActionPlans,
  type RRHHActionPlanRow,
} from '@/lib/rrhhActionPlans';
import { RedcomSelect } from '@/components/ui/redcom-select';
import {
  formatMoney,
  formatPercent,
  parseNullableNumber,
  type CategoriaHistoryPoint,
  type CategoriaHistorySummary,
} from '@/utils/categoriaHistory';

type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'done' | 'cancelled';

const BRANCH_LABELS: Record<string, string> = {
  corrientes_masivos: 'Corrientes · Masivos',
  corrientes_refrigerados: 'Corrientes · Refrigerados',
  chaco_masivos: 'Chaco',
  misiones_masivos: 'Misiones',
  obera_masivos: 'Oberá',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
  done: 'Finalizado',
  cancelled: 'Cancelado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function dateLabel(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace('.', '');
}

function branchLabel(key: string) {
  return BRANCH_LABELS[key] ?? key;
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function completionPercent(row: RRHHActionPlanRow) {
  if (!row.checklist_total) return 0;
  return Math.round((row.checklist_done / row.checklist_total) * 100);
}

function isOverdue(row: RRHHActionPlanRow) {
  if (!row.task_due_date || row.task_status === 'done' || row.task_status === 'cancelled') {
    return false;
  }

  const due = new Date(`${row.task_due_date.slice(0, 10)}T23:59:59`);
  return due.getTime() < Date.now();
}

function decodeTodoLabel(text?: string) {
  const raw = String(text ?? '').trim();
  if (!raw.startsWith('§§')) return { group: null as string | null, label: raw };

  const second = raw.indexOf('§§', 2);
  if (second < 0) return { group: null as string | null, label: raw };

  return {
    group: raw.slice(2, second).trim() || null,
    label: raw.slice(second + 2).trim(),
  };
}

export default function RRHHActionPlansPanel() {
  const [items, setItems] = useState<RRHHActionPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selected, setSelected] = useState<RRHHActionPlanRow | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setItems(await fetchRRHHActionPlans());
    } catch (err: any) {
      setError(err?.message ?? 'No se pudieron cargar los planes de acción.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of items) {
      for (const assignee of item.assignees) {
        map.set(
          assignee.id,
          assignee.full_name || assignee.email || 'Sin nombre',
        );
      }
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [items]);

  const branchOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.branch_key)))
      .map((value) => ({ value, label: branchLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== 'all' && item.task_status !== statusFilter) return false;
      if (branchFilter !== 'all' && item.branch_key !== branchFilter) return false;
      if (
        assigneeFilter !== 'all' &&
        !item.assignees.some((assignee) => assignee.id === assigneeFilter)
      ) {
        return false;
      }

      if (!q) return true;

      return [
        item.project_name,
        item.task_title,
        item.seller_id,
        item.seller_name,
        branchLabel(item.branch_key),
        ...item.assignees.map((assignee) => assignee.full_name ?? assignee.email ?? ''),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [assigneeFilter, branchFilter, items, query, statusFilter]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.task_status === 'in_progress').length;
    const done = items.filter((item) => item.task_status === 'done').length;
    const overdue = items.filter(isOverdue).length;
    const withChecklist = items.filter((item) => item.checklist_total > 0);
    const averageProgress = withChecklist.length
      ? Math.round(
          withChecklist.reduce((sum, item) => sum + completionPercent(item), 0) /
            withChecklist.length,
        )
      : 0;

    return {
      total: items.length,
      active,
      done,
      overdue,
      averageProgress,
    };
  }, [items]);

  return (
    <>
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#f7f8fa] shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
                <Target className="h-4 w-4" />
                Seguimiento RRHH
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
                Planes de acción
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Supervisión ejecutiva de los casos activos, responsables y evolución
                del vendedor. Todo el panel es de solo lectura.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="mt-6 grid gap-0 border-y border-slate-200 sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-slate-200">
            <Stat label="Planes registrados" value={stats.total} />
            <Stat label="En progreso" value={stats.active} />
            <Stat label="Finalizados" value={stats.done} />
            <Stat label="Vencidos" value={stats.overdue} tone={stats.overdue ? 'danger' : 'default'} />
            <Stat label="Avance promedio" value={`${stats.averageProgress}%`} />
          </div>
        </div>

        <div className="px-5 py-4 sm:px-6">
          <div className="grid gap-2 lg:grid-cols-[minmax(240px,1.4fr)_minmax(180px,.7fr)_minmax(180px,.7fr)_minmax(200px,.8fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar proyecto, vendedor, ID o responsable..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
              />
            </div>

            <RedcomSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: 'all', label: 'Todos los estados' },
                { value: 'not_started', label: 'Sin empezar' },
                { value: 'in_progress', label: 'En progreso' },
                { value: 'done', label: 'Finalizados' },
                { value: 'cancelled', label: 'Cancelados' },
              ]}
              placeholder="Estado"
              className="h-11"
            />

            <RedcomSelect
              value={branchFilter}
              onValueChange={setBranchFilter}
              options={[
                { value: 'all', label: 'Todas las sucursales' },
                ...branchOptions,
              ]}
              placeholder="Sucursal"
              className="h-11"
            />

            <RedcomSelect
              value={assigneeFilter}
              onValueChange={setAssigneeFilter}
              options={[
                { value: 'all', label: 'Todos los responsables' },
                ...assigneeOptions,
              ]}
              placeholder="Responsable"
              className="h-11"
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <div className="inline-flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              {filtered.length} caso{filtered.length === 1 ? '' : 's'} visible
              {filtered.length === 1 ? '' : 's'}
            </div>
            <span>Solo planes de acción iniciados</span>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white">
          {loading ? (
            <div className="grid min-h-[360px] place-items-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                Cargando seguimiento...
              </div>
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid min-h-[300px] place-items-center px-6 text-center">
              <div>
                <Target className="mx-auto h-8 w-8 text-slate-300" />
                <div className="mt-3 text-sm font-semibold text-slate-700">
                  No hay planes para mostrar
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Probá cambiando los filtros o la búsqueda.
                </div>
              </div>
            </div>
          ) : (
            <div>
              {filtered.map((item, index) => (
                <CaseRow
                  key={item.action_plan_id}
                  item={item}
                  index={index + 1}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <ActionPlanDossier
          item={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="px-1 py-4 sm:px-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-semibold tracking-[-0.04em] ${
          tone === 'danger' ? 'text-rose-600' : 'text-slate-950'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CaseRow({
  item,
  index,
  onOpen,
}: {
  item: RRHHActionPlanRow;
  index: number;
  onOpen: () => void;
}) {
  const progress = completionPercent(item);
  const overdue = isOverdue(item);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid w-full gap-4 border-b border-slate-100 px-5 py-5 text-left transition hover:bg-slate-50/80 last:border-b-0 sm:px-6 xl:grid-cols-[50px_minmax(260px,1.35fr)_minmax(220px,.9fr)_minmax(210px,.9fr)_minmax(150px,.65fr)_36px] xl:items-center"
    >
      <div className="hidden text-xs font-semibold text-slate-300 xl:block">
        {String(index).padStart(2, '0')}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-slate-950">
            {item.task_title}
          </span>
          <StatusDot status={item.task_status} />
          {overdue ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600">
              <AlertTriangle className="h-3 w-3" />
              Vencido
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="font-medium text-slate-500">{item.project_name}</span>
          <span>•</span>
          <span>{dateLabel(item.task_due_date)}</span>
          <span>•</span>
          <span>Prioridad {PRIORITY_LABELS[item.task_priority] ?? item.task_priority}</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Vendedor
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <UserRound className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">
              ID {item.seller_id} · {item.seller_name}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {branchLabel(item.branch_key)} · {item.seller_category || 'Sin categoría'}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Responsables directos
        </div>
        <div className="mt-1.5 flex min-h-7 flex-wrap items-center gap-1.5">
          {item.assignees.length ? (
            item.assignees.slice(0, 3).map((assignee) => (
              <span
                key={assignee.id}
                className="max-w-[150px] truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                {assignee.full_name || assignee.email || 'Sin nombre'}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">Sin responsables</span>
          )}
          {item.assignees.length > 3 ? (
            <span className="text-[11px] font-medium text-slate-400">
              +{item.assignees.length - 3}
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Avance
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
              {progress}%
            </div>
          </div>
          <div className="text-[10px] text-slate-400">
            {item.checklist_done}/{item.checklist_total}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="hidden xl:block">
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
      </div>
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'done'
      ? 'bg-emerald-500'
      : status === 'in_progress'
        ? 'bg-indigo-500'
        : status === 'cancelled'
          ? 'bg-rose-400'
          : 'bg-slate-300';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      {statusLabel(status)}
    </span>
  );
}

function ActionPlanDossier({
  item,
  onClose,
}: {
  item: RRHHActionPlanRow;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<CategoriaHistoryPoint[]>([]);
  const [summary, setSummary] = useState<CategoriaHistorySummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoadingHistory(true);
        const params = new URLSearchParams({
          branch_key: item.branch_key,
          seller_id: item.seller_id,
        });
        const response = await fetch(
          `/api/categorias/history?${params.toString()}`,
          { cache: 'no-store' },
        );
        const json = await response.json();

        if (!cancelled && response.ok) {
          setHistory(json.history ?? []);
          setSummary(json.summary ?? null);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.branch_key, item.seller_id]);

  const progress = completionPercent(item);
  const efficiency = parseNullableNumber(item.seller_efficiency);
  const effectiveness = parseNullableNumber(item.seller_effectiveness);
  const billing = parseNullableNumber(item.seller_billing);

  const groupedTodos = useMemo(() => {
    const groups = new Map<string, Array<{ label: string; done: boolean }>>();

    for (const todo of item.checklist_items) {
      const decoded = decodeTodoLabel(todo.text);
      const key = decoded.group || 'Sin grupo';
      const list = groups.get(key) ?? [];
      list.push({ label: decoded.label, done: Boolean(todo.done) });
      groups.set(key, list);
    }

    return Array.from(groups.entries());
  }, [item.checklist_items]);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex h-full max-w-[1380px] flex-col overflow-hidden rounded-[28px] bg-[#f7f8fa] shadow-[0_30px_100px_rgba(15,23,42,.22)]">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                Expediente de seguimiento
              </span>
              <StatusDot status={item.task_status} />
            </div>
            <h3 className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {item.task_title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{item.project_name}</span>
              <span>•</span>
              <span>{branchLabel(item.branch_key)}</span>
              <span>•</span>
              <span>ID {item.seller_id}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
            <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-7 xl:border-b-0 xl:border-r">
              <div className="grid gap-0 border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
                <DossierMetric label="Avance del plan" value={`${progress}%`} />
                <DossierMetric
                  label="Fecha límite"
                  value={dateLabel(item.task_due_date)}
                  compact
                />
                <DossierMetric
                  label="Responsables"
                  value={item.assignees.length}
                />
                <DossierMetric
                  label="Checklist"
                  value={`${item.checklist_done}/${item.checklist_total}`}
                />
              </div>

              <section className="mt-7">
                <SectionTitle
                  eyebrow="Proyecto"
                  title="Contexto del seguimiento"
                />
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <InfoBlock
                    label="Resumen"
                    value={item.task_summary || 'Sin resumen registrado.'}
                  />
                  <InfoBlock
                    label="Descripción"
                    value={item.task_description || 'Sin descripción registrada.'}
                  />
                </div>
              </section>

              <section className="mt-8">
                <SectionTitle
                  eyebrow="Ejecución"
                  title="Responsables directos"
                />
                <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
                  {item.assignees.length ? (
                    item.assignees.map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                            <UsersRound className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {assignee.full_name || assignee.email || 'Sin nombre'}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {assignee.email || 'Sin email'}
                            </div>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                          {assignee.role || 'usuario'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-5 text-sm text-slate-400">
                      No hay responsables asignados.
                    </div>
                  )}
                </div>
              </section>

              <section className="mt-8">
                <SectionTitle
                  eyebrow="Trabajo operativo"
                  title="Checklist del plan"
                />
                {groupedTodos.length ? (
                  <div className="mt-4 space-y-5">
                    {groupedTodos.map(([group, todos]) => (
                      <div key={group}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          {group}
                        </div>
                        <div className="mt-2 divide-y divide-slate-100 border-y border-slate-200">
                          {todos.map((todo, index) => (
                            <div
                              key={`${group}-${index}`}
                              className="flex items-center gap-3 py-3"
                            >
                              {todo.done ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : (
                                <Clock3 className="h-4 w-4 shrink-0 text-slate-300" />
                              )}
                              <span
                                className={`text-sm ${
                                  todo.done
                                    ? 'text-slate-400 line-through'
                                    : 'text-slate-700'
                                }`}
                              >
                                {todo.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-400">
                    Este plan todavía no tiene pasos internos cargados.
                  </div>
                )}
              </section>
            </div>

            <aside className="bg-[#f7f8fa] px-5 py-6 sm:px-7">
              <SectionTitle
                eyebrow="Vendedor"
                title={`ID ${item.seller_id} · ${item.seller_name}`}
              />

              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
                <SellerMetric
                  icon={<BadgeCheck className="h-4 w-4" />}
                  label="Categoría actual"
                  value={item.seller_category || 'Sin categoría'}
                />
                <SellerMetric
                  icon={<Gauge className="h-4 w-4" />}
                  label="Eficiencia"
                  value={formatPercent(efficiency)}
                />
                <SellerMetric
                  icon={<Activity className="h-4 w-4" />}
                  label="Efectividad"
                  value={formatPercent(effectiveness)}
                />
                <SellerMetric
                  icon={<Building2 className="h-4 w-4" />}
                  label="Facturación"
                  value={formatMoney(billing)}
                />
              </div>

              <div className="mt-7 border-t border-slate-200 pt-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Efectividad mensual
                </div>

                {loadingHistory ? (
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando histórico...
                  </div>
                ) : history.length ? (
                  <div className="mt-4 space-y-3">
                    {history.slice(-6).map((point) => (
                      <div
                        key={point.period}
                        className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-3"
                      >
                        <span className="text-[11px] text-slate-400">
                          {point.periodLabel}
                        </span>
                        <div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, point.efectividad ?? 0),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-right text-[11px] font-semibold text-slate-600">
                          {formatPercent(point.efectividad)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-slate-400">
                    Sin histórico disponible.
                  </div>
                )}
              </div>

              <div className="mt-7 border-t border-slate-200 pt-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Lectura del período
                </div>
                <div className="mt-3 space-y-3">
                  <ReadRow
                    label="Eficiencia promedio"
                    value={formatPercent(summary?.avgEficiencia ?? null)}
                  />
                  <ReadRow
                    label="Efectividad promedio"
                    value={formatPercent(summary?.avgEfectividad ?? null)}
                  />
                  <ReadRow
                    label="Mejor categoría"
                    value={summary?.bestCategoriaLabel ?? '—'}
                  />
                  <ReadRow
                    label="Mejor facturación"
                    value={formatMoney(summary?.bestFacturacion ?? null)}
                  />
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="flex gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  <p className="text-xs leading-5 text-indigo-700">
                    RRHH accede a este expediente únicamente para supervisión. Los
                    cambios del proyecto deben realizarse desde el equipo responsable.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function DossierMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div className="px-1 py-4 lg:px-5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 font-semibold tracking-[-0.03em] text-slate-950 ${
          compact ? 'text-lg' : 'text-3xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SellerMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 truncate text-xl font-semibold tracking-[-0.025em] text-slate-900">
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-indigo-500">
        {eyebrow}
      </div>
      <h4 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-slate-950">
        {title}
      </h4>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {value}
      </p>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2.5 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800">{value}</span>
    </div>
  );
}
