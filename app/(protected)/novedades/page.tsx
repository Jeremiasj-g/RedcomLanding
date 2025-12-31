'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { PartyPopper, Newspaper, CalendarDays, Sparkles, Pin } from 'lucide-react';

type TypeFilter = 'all' | 'news' | 'weekly' | 'birthday';

const tabs: { key: TypeFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Todas', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'news', label: 'Noticias', icon: <Newspaper className="h-4 w-4" /> },
  { key: 'weekly', label: 'Semanales', icon: <CalendarDays className="h-4 w-4" /> },
  { key: 'birthday', label: 'Cumpleaños', icon: <PartyPopper className="h-4 w-4" /> },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function typeMeta(type: string) {
  const t = String(type || '').toLowerCase();

  if (t === 'birthday') {
    return {
      label: 'CUMPLEAÑOS',
      ring: 'ring-pink-200/60',
      badge: 'bg-pink-50 text-pink-700 border-pink-200/60',
      dot: 'bg-pink-500',
      glow: 'from-pink-500/15 via-fuchsia-500/10 to-transparent',
      icon: <PartyPopper className="h-4 w-4" />,
    };
  }
  if (t === 'weekly') {
    return {
      label: 'SEMANAL',
      ring: 'ring-indigo-200/60',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
      dot: 'bg-indigo-500',
      glow: 'from-indigo-500/12 via-sky-500/8 to-transparent',
      icon: <CalendarDays className="h-4 w-4" />,
    };
  }
  if (t === 'news') {
    return {
      label: 'NOTICIA',
      ring: 'ring-emerald-200/60',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      dot: 'bg-emerald-500',
      glow: 'from-emerald-500/12 via-teal-500/8 to-transparent',
      icon: <Newspaper className="h-4 w-4" />,
    };
  }
  return {
    label: String(type || 'OTRO').toUpperCase(),
    ring: 'ring-slate-200/60',
    badge: 'bg-slate-50 text-slate-700 border-slate-200/60',
    dot: 'bg-slate-400',
    glow: 'from-slate-500/10 via-slate-500/5 to-transparent',
    icon: <Sparkles className="h-4 w-4" />,
  };
}

type Announcement = {
  id: string;
  type: string;
  title: string;
  content: string;
  severity?: string | null;
  pinned?: boolean | null;
  created_at: string;
};

export default function NovedadesPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('announcements')
      .select('id,type,title,content,severity,pinned,created_at')
      .neq('type', 'important_alert') // la alerta va por popup en home
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) setItems((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const { birthdays, rest, counts } = useMemo(() => {
    const query = q.trim().toLowerCase();

    const byQuery = items.filter((x) => {
      if (!query) return true;
      return (
        String(x.title ?? '').toLowerCase().includes(query) ||
        String(x.content ?? '').toLowerCase().includes(query)
      );
    });

    const b = byQuery.filter((x) => String(x.type).toLowerCase() === 'birthday');

    const nonBirthday = byQuery.filter((x) => String(x.type).toLowerCase() !== 'birthday');

    const filteredRest =
      tab === 'all'
        ? nonBirthday
        : tab === 'birthday'
          ? [] // los cumpleaños se muestran arriba, no abajo
          : nonBirthday.filter((x) => String(x.type).toLowerCase() === tab);

    const c = {
      all: items.length,
      news: items.filter((x) => String(x.type).toLowerCase() === 'news').length,
      weekly: items.filter((x) => String(x.type).toLowerCase() === 'weekly').length,
      birthday: items.filter((x) => String(x.type).toLowerCase() === 'birthday').length,
    };

    return { birthdays: b, rest: filteredRest, counts: c };
  }, [items, q, tab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Novedades
            </h1>
            <p className="text-sm text-slate-500">
              Comunicaciones internas, avisos semanales y publicaciones de RRHH.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-[min(360px,90vw)]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={cn(
                  'w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm',
                  'shadow-sm outline-none backdrop-blur',
                  'focus:border-slate-300 focus:ring-4 focus:ring-slate-200/50'
                )}
                placeholder="Buscar por título o contenido…"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white/70 p-2 shadow-sm backdrop-blur">
          {tabs.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition',
                  active
                    ? 'bg-slate-900 text-white shadow'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                {t.icon}
                <span>{t.label}</span>
                <span
                  className={cn(
                    'ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs',
                    active ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cumpleaños (sección superior destacada) */}
        <AnimatePresence initial={false}>
          {birthdays.length > 0 && (
            <motion.section
              key="birthdays"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8"
            >
              <div className="relative overflow-hidden rounded-3xl border border-pink-200/60 bg-white shadow-sm">
                {/* Glow */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent" />
                <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-pink-400/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />

                <div className="relative p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
                    {/* Avatar + Title */}
                    <div className="flex items-start gap-4">
                      <div className="relative h-16 w-16 sm:h-28 sm:w-28 overflow-hidden rounded-2xl ring-1 ring-pink-200/70 bg-white shadow-sm">
                        <Image
                          src="/redcom_avatar_fest.png"
                          alt="Redcom avatar fest"
                          fill
                          sizes="80px"
                          className="object-cover"
                          priority
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-pink-200/60 bg-pink-50 px-3 py-1 text-xs font-extrabold text-pink-700">
                          <PartyPopper className="h-4 w-4" />
                          RRHH · CUMPLEAÑOS
                        </div>

                        <h2 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                          ¡Celebremos los cumpleañitos!
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {birthdays.length === 1
                            ? 'Hay 1 publicación de cumpleaños.'
                            : `Hay ${birthdays.length} publicaciones de cumpleaños.`}
                        </p>
                      </div>
                    </div>

                    {/* Mini hint */}
                    <div className="lg:text-right">
                      <div className="text-xs font-semibold text-slate-500">Actualizado</div>
                      <div className="mt-1 text-sm font-bold text-slate-800">
                        {formatDate(birthdays[0].created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Birthday cards (al lado del avatar en desktop) */}
                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <AnimatePresence initial={false}>
                      {birthdays.slice(0, 4).map((it) => (
                        <motion.div
                          key={it.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="group relative overflow-hidden rounded-2xl border border-pink-200/60 bg-white p-4 shadow-sm"
                        >
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-500/8 via-fuchsia-500/6 to-transparent opacity-70" />
                          <div className="relative">
                            <div className="flex items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-pink-500" />
                                <span className="text-xs font-extrabold tracking-wide text-pink-700">
                                  CUMPLEAÑOS
                                </span>
                                {it.pinned ? (
                                  <span className="ml-1 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-extrabold text-white">
                                    <Pin className="h-3.5 w-3.5" />
                                    PINNED
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-xs text-slate-500">{formatDate(it.created_at)}</div>
                            </div>

                            <div className="mt-2 text-base font-extrabold text-slate-900">
                              {it.title}
                            </div>
                            <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                              {it.content}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {birthdays.length > 4 ? (
                    <div className="mt-3 text-xs text-slate-500">
                      Mostrando 4 de {birthdays.length}. Usá el buscador para encontrar el resto.
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Otras novedades (sección inferior) */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Otras novedades</h3>
              <p className="text-sm text-slate-500">
                {tab === 'birthday'
                  ? 'Los cumpleaños se muestran arriba.'
                  : tab === 'all'
                    ? 'Noticias y publicaciones semanales.'
                    : `Filtrando: ${tabs.find((x) => x.key === tab)?.label ?? ''}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="h-4 w-28 rounded bg-slate-100" />
                  <div className="mt-3 h-5 w-3/4 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <motion.div
                layout
                className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <AnimatePresence initial={false}>
                  {rest.map((it) => {
                    const meta = typeMeta(it.type);
                    return (
                      <motion.article
                        key={it.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={cn(
                          'group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm',
                          'transition hover:shadow-md'
                        )}
                      >
                        {/* Glow */}
                        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', meta.glow)} />
                        <div className={cn('pointer-events-none absolute inset-0 ring-1', meta.ring)} />

                        <div className="relative">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {it.pinned ? (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white">
                                  <Pin className="h-3.5 w-3.5" />
                                  PINNED
                                </span>
                              ) : null}

                              <span
                                className={cn(
                                  'inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold',
                                  meta.badge
                                )}
                              >
                                <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                                {meta.icon}
                                {meta.label}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500">{formatDate(it.created_at)}</div>
                          </div>

                          <div className="mt-3 text-lg font-extrabold text-slate-900 leading-snug">
                            {it.title}
                          </div>

                          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">
                            {it.content}
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </motion.div>

              {!loading && rest.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                  No hay resultados para tu búsqueda/filtro.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
