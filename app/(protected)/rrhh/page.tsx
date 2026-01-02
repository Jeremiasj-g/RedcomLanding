'use client';

import { useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '@/components/RouteGuards';
import { AnnouncementEditor } from '@/components/rrhh/AnnouncementEditor';
import RRHHAnnouncementsPublicaciones from '@/components/rrhh/RRHHAnnouncementsPublicaciones';

import {
  rrhhFetchAnnouncementsMetrics,
  type AnnouncementMetric,
} from '@/hooks/rrhh/announcements';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  PlusCircle,
  LayoutGrid,
  RefreshCw,
  ListChecks,
  Wand2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Heart,
  CalendarDays,
  Newspaper,
} from 'lucide-react';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type ViewTab = 'publicar' | 'publicaciones';

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
      content: 'Esta semana:\n\n• Punto 1\n• Punto 2\n• Punto 3\n\nGracias a todos 🙌',
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
      content: 'Compartimos la siguiente novedad:\n\n—\n\nGracias.',
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
      content: 'Atención:\n\n• Qué cambia\n• Desde cuándo\n• A quién afecta\n\nGracias.',
      pinned: true,
      require_ack: true,
    },
  },
] as const;

export default function RRHHPage() {
  const [items, setItems] = useState<AnnouncementMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewTab, setViewTab] = useState<ViewTab>('publicar');

  // ✅ “template draft” para inyectar al editor
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
                  subtitle="Ver y gestionar"
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
                  <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
                    {/* Editor */}
                    <div className="relative overflow-hidden rounded-3xl shadow-sm">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/10 via-sky-500/8 to-transparent" />
                      <div className="relative">
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

                    {/* Side panel */}
                    <div className="space-y-4">
                      {/* Checklist */}
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

                      {/* Plantillas */}
                      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-5 sm:p-6">
                          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-800">
                            <Wand2 className="h-4 w-4" />
                            Plantillas rápidas
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2">
                            {QUICK_TEMPLATES.map((t) => (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => {
                                  setTemplateDraft({ ...t.payload });
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
                  <RRHHAnnouncementsPublicaciones
                    items={items}
                    loading={loading}
                    countActivos={countActivos}
                    countArchivados={countArchivados}
                    onReload={load}
                  />
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
        <div
          className={cn(
            'text-sm font-extrabold',
            tone === 'warn' ? 'text-amber-900' : 'text-slate-900'
          )}
        >
          {title}
        </div>
        <div className={cn('text-xs', tone === 'warn' ? 'text-amber-800' : 'text-slate-500')}>
          {desc}
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
