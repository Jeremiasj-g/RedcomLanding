'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileText,
  MessageSquareText,
  Play,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Meeting } from '@/lib/reuniones/types';
import { formatMeetingTimestamp } from '@/lib/reuniones/types';

type TabId = 'summary' | 'transcript' | 'analysis';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function ReunionDetail({ meeting }: { meeting: Meeting }) {
  const [tab, setTab] = useState<TabId>('summary');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredPoints = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return meeting.keyPoints;
    return meeting.keyPoints.filter((point) =>
      `${point.title} ${point.description}`.toLowerCase().includes(normalized),
    );
  }, [meeting.keyPoints, query]);

  const filteredTranscript = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return meeting.transcript;
    return meeting.transcript.filter((segment) =>
      `${segment.speaker} ${segment.text}`.toLowerCase().includes(normalized),
    );
  }, [meeting.transcript, query]);

  const copySummary = async () => {
    await navigator.clipboard.writeText(meeting.summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'summary', label: 'Resumen' },
    { id: 'transcript', label: 'Transcripción' },
    { id: 'analysis', label: 'Análisis exhaustivo' },
  ];

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Link
                  href="/reuniones"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Volver a reuniones"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-slate-950 sm:text-2xl">
                  {meeting.title}
                </h1>
                <span className="hidden rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
                  IA simulada
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-12 text-sm font-normal text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {dateFormatter.format(new Date(meeting.date))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4" />
                  {meeting.durationMinutes} min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {meeting.participants.map((participant) => participant.name).join(', ')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-12 xl:pl-0">
              <button
                type="button"
                disabled
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 opacity-70"
                title="Se habilitará cuando conectemos archivos reales"
              >
                <Download className="h-4 w-4" />
                Descargar
              </button>
              <button
                type="button"
                disabled
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 opacity-70"
              >
                <FileText className="h-4 w-4" />
                Exportar resumen
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pt-5">
          <nav className="flex gap-1" aria-label="Secciones de la reunión">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setQuery('');
                  }}
                  className={[
                    'relative px-4 py-3 text-sm font-medium transition',
                    active ? 'text-violet-700' : 'text-slate-600 hover:text-slate-950',
                  ].join(' ')}
                >
                  {item.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-violet-600" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="grid min-h-[690px] gap-0 xl:grid-cols-[minmax(0,1.55fr)_minmax(380px,0.95fr)]">
          <section className="min-w-0 border-slate-200 py-5 xl:border-r xl:pr-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={tab === 'transcript' ? 'Buscar en la transcripción…' : 'Buscar en el resumen…'}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {tab === 'summary' && (
                <button
                  type="button"
                  onClick={copySummary}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>

            {tab === 'summary' && (
              <div className="space-y-7">
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3">
                  <Metric label="Puntos clave" value={String(meeting.keyPoints.length)} />
                  <Metric label="Participantes" value={String(meeting.participants.length)} />
                  <Metric label="Acciones" value={String(meeting.actions.length)} />
                </div>

                <section>
                  <h2 className="text-[21px] font-semibold text-slate-950">Resumen</h2>
                  <p className="mt-3 max-w-4xl text-[15px] font-normal leading-7 text-slate-700">
                    {meeting.summary}
                  </p>
                </section>

                <section className="border-t border-slate-200 pt-6">
                  <h2 className="text-[18px] font-semibold text-slate-950">Puntos clave de discusión</h2>
                  <div className="mt-4 space-y-4">
                    {filteredPoints.map((point) => (
                      <article key={point.id} className="grid gap-2 sm:grid-cols-[52px_1fr]">
                        <button
                          type="button"
                          className="h-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"
                          title="El salto al minuto se habilitará con la grabación real"
                        >
                          {formatMeetingTimestamp(point.timestampSeconds)}
                        </button>
                        <div>
                          <h3 className="text-[15px] font-semibold text-slate-900">{point.title}</h3>
                          <p className="mt-1 text-sm font-normal leading-6 text-slate-600">{point.description}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-6">
                  <h2 className="text-[18px] font-semibold text-slate-950">Acciones acordadas</h2>
                  <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {meeting.actions.map((action) => (
                      <div key={action.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_150px_100px] sm:items-center">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{action.action}</p>
                          <p className="mt-1 text-xs font-normal text-slate-500">{action.responsible}</p>
                        </div>
                        <span className="text-xs font-normal text-slate-500">{action.deadline || 'Sin fecha'}</span>
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {action.status === 'completed' ? 'Completa' : action.status === 'in_progress' ? 'En proceso' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {tab === 'transcript' && (
              <div>
                <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-[20px] font-semibold text-slate-950">Transcripción</h2>
                    <p className="mt-1 text-sm font-normal text-slate-500">Intervenciones con referencias temporales.</p>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{filteredTranscript.length} segmentos</span>
                </div>

                <div className="space-y-5">
                  {filteredTranscript.map((segment) => (
                    <article key={segment.id} className="grid gap-2 sm:grid-cols-[54px_150px_1fr] sm:gap-4">
                      <button type="button" className="h-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                        {formatMeetingTimestamp(segment.startSeconds)}
                      </button>
                      <p className="text-sm font-semibold text-slate-900">{segment.speaker}</p>
                      <p className="text-sm font-normal leading-6 text-slate-700">{segment.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {tab === 'analysis' && (
              <div className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Análisis simulado
                  </span>
                  <h2 className="mt-3 text-[21px] font-semibold text-slate-950">Lectura ejecutiva de la reunión</h2>
                  <p className="mt-3 text-[15px] font-normal leading-7 text-slate-700">
                    El foco principal estuvo en cobertura, clientes sin compra y reorganización de rutas. La conversación derivó en acciones concretas con responsables definidos y próximos pasos operativos.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <AnalysisCard title="Decisiones" items={meeting.keyPoints.slice(0, 3).map((point) => point.title)} />
                  <AnalysisCard title="Próximos pasos" items={meeting.actions.map((action) => `${action.responsible}: ${action.action}`)} />
                </div>

                <div className="rounded-xl border border-slate-200 p-5">
                  <h3 className="text-base font-semibold text-slate-950">Participantes</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {meeting.participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                          {participant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{participant.name}</p>
                          <p className="text-xs font-normal text-slate-500">{participant.role || 'Participante'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="min-w-0 py-5 xl:pl-8">
            <div className="sticky top-4 space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="relative aspect-video bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center text-white/90">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                        <Play className="ml-1 h-6 w-6" />
                      </div>
                      <p className="mt-3 text-sm font-medium">Vista previa de grabación</p>
                      <p className="mt-1 text-xs font-normal text-white/60">Se conectará en una etapa posterior</p>
                    </div>
                  </div>
                  <div className="absolute inset-x-4 bottom-4">
                    <div className="h-1 rounded-full bg-white/20">
                      <div className="h-1 w-[18%] rounded-full bg-violet-400" />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-medium text-white/80">
                      <span>0:00</span>
                      <span>{meeting.durationMinutes}:00</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 p-4">
                  <div className="mb-4 flex gap-2">
                    <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">Capítulos</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">Destacados</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">Oradores</span>
                  </div>

                  <div className="max-h-[355px] space-y-1 overflow-auto pr-1">
                    {meeting.keyPoints.map((point) => (
                      <button
                        key={point.id}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                          {formatMeetingTimestamp(point.timestampSeconds)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-normal leading-5 text-slate-700">{point.title}</span>
                        <div className="grid h-10 w-16 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400">
                          <Play className="h-4 w-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm opacity-75"
                title="Se habilitará cuando conectemos el motor de preguntas"
              >
                <MessageSquareText className="h-4 w-4" />
                Preguntar a la reunión
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-normal text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AnalysisCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-sm font-normal leading-6 text-slate-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
