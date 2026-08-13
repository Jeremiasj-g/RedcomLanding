'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, Clock3, Search, Sparkles, Users } from 'lucide-react';
import { mockMeetings } from '@/lib/reuniones/mock';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function ReunionesHome() {
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');

  const branches = useMemo(
    () => Array.from(new Set(mockMeetings.flatMap((meeting) => meeting.branches))).sort(),
    [],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mockMeetings.filter((meeting) => {
      const matchesBranch = branch === 'all' || meeting.branches.includes(branch);
      const matchesQuery =
        !normalized ||
        meeting.title.toLowerCase().includes(normalized) ||
        meeting.summary.toLowerCase().includes(normalized) ||
        meeting.branches.some((item) => item.toLowerCase().includes(normalized));
      return matchesBranch && matchesQuery;
    });
  }, [branch, query]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between md:p-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                <Sparkles className="h-3.5 w-3.5" />
                MODO DE PRUEBA · IA SIMULADA
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Reuniones</h1>
              <p className="mt-2 max-w-2xl text-sm font-normal leading-6 text-slate-600 md:text-base">
                Resúmenes, puntos clave, acciones y transcripciones organizadas por sucursal.
              </p>
            </div>

            <button
              type="button"
              disabled
              className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-4 text-sm font-medium text-slate-500"
              title="Se habilitará en la etapa de importación"
            >
              + Importar reunión
            </button>
          </div>

          <div className="grid gap-3 border-t border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[1fr_220px] md:p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar reunión, sucursal o tema…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-normal outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </div>
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500"
            >
              <option value="all">Todas las sucursales</option>
              {branches.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((meeting) => (
            <article key={meeting.id} className="group flex min-h-[290px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {meeting.branches.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      <Building2 className="h-3 w-3" /> {item}
                    </span>
                  ))}
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Procesada</span>
              </div>

              <h2 className="mt-5 text-xl font-semibold leading-tight text-slate-950">{meeting.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm font-normal leading-6 text-slate-600">{meeting.summary}</p>

              <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-normal text-slate-500">
                <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {dateFormatter.format(new Date(meeting.date)).split(',')[0]}</div>
                <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {meeting.durationMinutes} min</div>
                <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {meeting.participants.length}</div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-xs font-medium text-slate-500">{meeting.keyPoints.length} puntos · {meeting.actions.length} acciones</div>
                <Link href={`/reuniones/${meeting.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition group-hover:text-red-600">
                  Ver reunión <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </section>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm font-normal text-slate-500">
            No encontramos reuniones con esos filtros.
          </div>
        )}
      </div>
    </main>
  );
}
