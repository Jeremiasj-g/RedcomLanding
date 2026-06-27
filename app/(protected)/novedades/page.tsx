'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesText } from '@/components/ui/sparkles-text';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORIA_COLORS, type CategoriaKey } from '@/utils/categories';
import { RecognitionScoringPlayground } from '@/components/categoria/RecognitionScoringPlayground';
/* import DOMPurify from 'isomorphic-dompurify'; */

import {
  PartyPopper,
  Newspaper,
  CalendarDays,
  Sparkles,
  Pin,
  Info,
  AlertTriangle,
  ShieldAlert,
  Gift,
  Trophy,
  Target,
  TrendingUp,
  CheckCircle2,
  Coins,
  Fuel,
  Wrench,
  Shirt,
  ShieldCheck,
  Package,
} from 'lucide-react';

type TypeFilter = 'all' | 'news' | 'weekly' | 'birthday' | 'points';
type Severity = 'info' | 'warning' | 'critical';

const tabs: { key: TypeFilter; label: string; icon: React.ReactNode; special?: boolean }[] = [
  { key: 'all', label: 'Todas', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'news', label: 'Noticias', icon: <Newspaper className="h-4 w-4" /> },
  { key: 'weekly', label: 'Semanales', icon: <CalendarDays className="h-4 w-4" /> },
  { key: 'birthday', label: 'Cumpleaños', icon: <PartyPopper className="h-4 w-4" /> },
  { key: 'points', label: 'Puntos y canjes', icon: <Gift className="h-4 w-4" />, special: true },
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

function normalizeSeverity(v?: string | null): Severity {
  const s = String(v || 'info').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'warning') return 'warning';
  return 'info';
}

/** ✅ Severidad -> SOLO barra superior + chip (sin afectar fondo) */
function severityMeta(v?: string | null) {
  const s = normalizeSeverity(v);

  if (s === 'critical') {
    return {
      key: 'critical' as const,
      label: 'Crítico',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      topBar: 'bg-red-500/70',
      chip: 'bg-white/80 text-red-700 border-red-200/70',
      dot: 'bg-red-500',
    };
  }

  if (s === 'warning') {
    return {
      key: 'warning' as const,
      label: 'Atención',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      topBar: 'bg-amber-400/70',
      chip: 'bg-white/80 text-amber-800 border-amber-200/70',
      dot: 'bg-amber-400',
    };
  }

  return {
    key: 'info' as const,
    label: 'Info',
    icon: <Info className="h-3.5 w-3.5" />,
    topBar: 'bg-sky-500/70',
    chip: 'bg-white/80 text-sky-700 border-sky-200/70',
    dot: 'bg-sky-500',
  };
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

  starts_at?: string | null;
  ends_at?: string | null;

  is_active?: boolean | null;
  is_published?: boolean | null;
};

/* ---------------- HTML helpers ---------------- */
function looksLikeHtml(value?: string | null) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

/* function sanitizeHtml(html: string) {
  // Permitimos tags típicos de Quill. Bloqueamos scripts/inline events.
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'span',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
} */

function HtmlContent({
  content,
  clamp,
  className,
}: {
  content: string;
  clamp?: boolean;
  className?: string;
}) {
  const isHtml = looksLikeHtml(content);

  if (!isHtml) {
    // ✅ fallback: texto plano viejo
    return (
      <div className={cn('whitespace-pre-wrap', className)}>
        {content}
      </div>
    );
  }

  function sanitizeHtmlLight(html: string) {
    // remove scripts
    let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    // remove inline handlers on*
    out = out.replace(/\son\w+="[^"]*"/gi, '');
    out = out.replace(/\son\w+='[^']*'/gi, '');
    // remove javascript: urls
    out = out.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
    return out;
  }

  const safe = sanitizeHtmlLight(content);

  return (
    <div className={cn(clamp ? 'line-clamp-6' : '', className)}>
      <div
        className={cn(
          '[&_p]:my-1',

          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-10',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-10',

          '[&_li]:my-1',

          '[&_a]:underline [&_a]:font-semibold'
        )}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  );
}


/* ---------------- Page ---------------- */
export default function NovedadesPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [pointsView, setPointsView] = useState<'guide' | 'playground'>('guide');

  const birthdayCardRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('announcements')
      .select('id,type,title,content,severity,pinned,created_at,starts_at,ends_at,is_active,is_published')
      .neq('type', 'important_alert')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) setItems((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ✅ Tick para que expire solo sin refetch
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { birthdays, rest, counts } = useMemo(() => {
    const query = q.trim().toLowerCase();

    // ✅ 1) Filtrar por vigencia
    const timeVisible = items.filter((a) => {
      const isActive = a.is_active ?? true;
      const isPublished = a.is_published ?? true;

      const starts = a.starts_at ? new Date(a.starts_at).getTime() : 0;
      const ends = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;

      return isActive && isPublished && starts <= now && now < ends;
    });

    // ✅ 2) Buscar sobre lo vigente
    const byQuery = timeVisible.filter((x) => {
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
          ? []
          : nonBirthday.filter((x) => String(x.type).toLowerCase() === tab);

    const c = {
      all: timeVisible.length,
      news: timeVisible.filter((x) => String(x.type).toLowerCase() === 'news').length,
      weekly: timeVisible.filter((x) => String(x.type).toLowerCase() === 'weekly').length,
      birthday: timeVisible.filter((x) => String(x.type).toLowerCase() === 'birthday').length,
      points: 0,
    };

    return { birthdays: b, rest: filteredRest, counts: c };
  }, [items, q, tab, now]);

  // Confetti (cumple)
  useEffect(() => {
    if (birthdays.length === 0) return;

    let cancelled = false;

    (async () => {
      const mod = await import('canvas-confetti');
      if (cancelled) return;

      const confetti = mod.default;

      const fire = (originX: number) => {
        confetti({
          particleCount: 80,
          startVelocity: 55,
          spread: 75,
          ticks: 230,
          gravity: 1.15,
          scalar: 1,
          origin: { x: originX, y: 1 },
          colors: ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#32ADE6', '#007AFF', '#AF52DE', '#FF2D55'],
        });

        confetti({
          particleCount: 40,
          startVelocity: 38,
          spread: 95,
          ticks: 190,
          gravity: 1.05,
          scalar: 0.9,
          origin: { x: originX, y: 1 },
        });
      };

      const rect = birthdayCardRef.current?.getBoundingClientRect();
      if (!rect) {
        fire(0.08);
        fire(0.92);
        return;
      }

      const leftX = (rect.left + 24) / window.innerWidth;
      const rightX = (rect.right - 24) / window.innerWidth;
      const clamp = (n: number) => Math.max(0, Math.min(1, n));

      fire(clamp(leftX));
      fire(clamp(rightX));
    })();

    return () => {
      cancelled = true;
    };
  }, [birthdays.length]);

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
                  'relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition',
                  active ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100',
                  t.special && !active ? 'bg-white text-slate-900 ring-1 ring-red-100 shadow-sm hover:bg-red-50/60' : '',
                  t.special && active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : ''
                )}
              >
                {t.icon}
                {t.special ? (
                  <SparklesText
                    as="span"
                    sparklesCount={5}
                    colors={{ first: '#E30613', second: '#FDBA74' }}
                    className="text-sm font-extrabold leading-none"
                  >
                    {t.label}
                  </SparklesText>
                ) : (
                  <span>{t.label}</span>
                )}
                {!t.special ? (
                  <span
                    className={cn(
                      'ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs',
                      active ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {count}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'ml-1 inline-flex h-5 items-center justify-center rounded-full px-2 text-[11px] font-extrabold',
                      active ? 'bg-white/15 text-white' : 'bg-red-50 text-red-700'
                    )}
                  >
                    Guía
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cumpleaños */}
        <AnimatePresence initial={false}>
          {tab !== 'points' && birthdays.length > 0 && (
            <motion.section
              key="birthdays"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8"
            >
              <div
                ref={birthdayCardRef}
                className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-xl"
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-white/30" />
                  <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-pink-400 blur-[80px]" />
                  <div className="absolute top-10 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400 blur-[110px]" />
                  <div className="absolute -top-20 right-10 h-72 w-72 rounded-full bg-indigo-400 blur-[110px]" />
                  <div className="absolute bottom-15 left-10 h-72 w-72 rounded-full bg-sky-400 blur-[110px]" />
                  <div className="absolute -bottom-28 right-1/3 h-80 w-80 rounded-full bg-emerald-100 blur-[110px]" />
                  <div className="absolute bottom-2 -right-24 h-72 w-72 rounded-full bg-amber-300 blur-[110px]" />
                  <div className="absolute inset-0 ring-1 ring-white/60" />
                </div>

                <div className="relative p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="relative h-16 w-16 sm:h-28 sm:w-28 overflow-hidden rounded-2xl ring-1 ring-white/60 bg-white/70 shadow-2xl backdrop-blur">
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
                        <div className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/60 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur">
                          <PartyPopper className="h-4 w-4 text-pink-600" />
                          RRHH · CUMPLEAÑOS
                        </div>

                        <h2 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                          ¡Celebremos los cumpleañitos!
                        </h2>
                        <p className="mt-1 text-sm text-slate-700">
                          {birthdays.length === 1
                            ? 'Hay 1 publicación de cumpleaños.'
                            : `Hay ${birthdays.length} publicaciones de cumpleaños.`}
                        </p>
                      </div>
                    </div>

                    <div className="lg:text-right">
                      <div className="text-xs font-semibold text-slate-600">Actualizado</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {formatDate(birthdays[0].created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <AnimatePresence initial={false}>
                      {birthdays.slice(0, 4).map((it) => (
                        <motion.div
                          key={it.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className={cn(
                            'group relative overflow-hidden rounded-2xl border border-white/60',
                            'bg-white/70 p-4 shadow-2xl backdrop-blur-xl',
                            'transition hover:bg-white/80'
                          )}
                        >
                          <div className="relative">
                            <div className="flex items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-pink-500" />
                                <span className="text-xs font-extrabold tracking-wide text-slate-900">
                                  CUMPLEAÑOS
                                </span>
                                {it.pinned ? (
                                  <span className="ml-1 inline-flex items-center gap-1 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] font-extrabold text-white">
                                    <Pin className="h-3.5 w-3.5" />
                                    FIJADO
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-xs text-slate-600">{formatDate(it.created_at)}</div>
                            </div>

                            <div className="mt-2 text-base font-extrabold text-slate-900">{it.title}</div>

                            {/* ✅ contenido: HTML o texto */}
                            <HtmlContent content={it.content} className="mt-1 text-sm text-slate-800" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {birthdays.length > 4 ? (
                    <div className="mt-3 text-xs text-slate-700">
                      Mostrando 4 de {birthdays.length}. Usá el buscador para encontrar el resto.
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {tab === 'points' && (
            <motion.section
              key="points-program"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="mt-8"
            >
              <div className="mb-5 flex w-full flex-wrap rounded-[1.35rem] border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
                {[
                  { key: 'guide' as const, label: 'Cómo funciona' },
                  { key: 'playground' as const, label: 'Playground' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPointsView(item.key)}
                    className={cn(
                      'rounded-2xl px-5 py-3 text-sm font-black transition',
                      pointsView === item.key
                        ? 'bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {pointsView === 'guide' ? (
                <PointsAndRewardsGuide />
              ) : (
                <RecognitionScoringPlayground />
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Otras novedades */}
        {tab !== 'points' && <div className="mt-8">
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
                <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="h-4 w-28 rounded bg-slate-100" />
                  <div className="mt-3 h-5 w-3/4 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <motion.div layout className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence initial={false}>
                  {rest.map((it) => {
                    const meta = typeMeta(it.type);
                    const sev = severityMeta(it.severity);

                    return (
                      <motion.article
                        key={it.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={cn(
                          'group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl',
                          'transition hover:shadow-md'
                        )}
                      >
                        <div className={cn('pointer-events-none absolute inset-0 z-0 bg-gradient-to-br', meta.glow)} />
                        <div className={cn('pointer-events-none absolute inset-0 z-0 ring-1', meta.ring)} />
                        <div className={cn('pointer-events-none absolute left-0 right-0 top-0 z-20 h-1.5', sev.topBar)} />

                        <div className="relative p-5">
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

                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold backdrop-blur',
                                  sev.chip
                                )}
                                title={`Severidad: ${sev.label}`}
                              >
                                <span className={cn('h-2 w-2 rounded-full', sev.dot)} />
                                {sev.icon}
                                {sev.label}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500">{formatDate(it.created_at)}</div>
                          </div>

                          <div className="mt-3 text-lg font-extrabold text-slate-900 leading-snug">
                            {it.title}
                          </div>

                          {/* ✅ contenido: HTML o texto + clamp */}
                          <HtmlContent
                            content={it.content}
                            clamp
                            className="mt-2 text-sm text-slate-700"
                          />
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
        </div>}
      </div>
    </div>
  );
}


type CategoryPoint = {
  key: CategoriaKey;
  name: string;
  points: number;
  description: string;
};

const categoryPoints: CategoryPoint[] = [
  {
    key: 'SENIOR',
    name: 'Senior',
    points: 20,
    description: 'Mayor reconocimiento mensual por sostener el nivel superior.',
  },
  {
    key: 'SEMI_SENIOR',
    name: 'Semi Senior',
    points: 12,
    description: 'Reconoce desempeño consolidado y continuidad comercial.',
  },
  {
    key: 'JUNIOR',
    name: 'Junior',
    points: 5,
    description: 'Primer nivel con puntos para acompañar el crecimiento.',
  },
  {
    key: 'PLAN_MEJORA',
    name: 'Plan de Mejora',
    points: 0,
    description: 'No suma puntos y activa seguimiento para recuperar desempeño.',
  },
];

const permanenceBonuses: Array<{
  key: CategoriaKey;
  category: string;
  three: number;
  six: number;
}> = [
  { key: 'SENIOR', category: 'Senior', three: 20, six: 40 },
  { key: 'SEMI_SENIOR', category: 'Semi Senior', three: 10, six: 20 },
  { key: 'JUNIOR', category: 'Junior', three: 5, six: 10 },
  { key: 'PLAN_MEJORA', category: 'Plan de Mejora', three: 0, six: 0 },
];

const rewardCatalog = [
  { name: 'Vale de combustible $10.000', points: 20, icon: <Fuel className="h-4 w-4" /> },
  { name: 'Vale de combustible $20.000', points: 30, icon: <Fuel className="h-4 w-4" /> },
  { name: 'Uniforme de trabajo', points: 80, icon: <Shirt className="h-4 w-4" /> },
  { name: 'Service de moto', points: 150, icon: <Wrench className="h-4 w-4" /> },
  { name: 'Mochila de trabajo', points: 180, icon: <Package className="h-4 w-4" /> },
  { name: 'Casco homologado', points: 250, icon: <ShieldCheck className="h-4 w-4" /> },
  { name: 'Cubierta de moto', points: 350, icon: <Package className="h-4 w-4" /> },
];

const recognitionSteps = [
  {
    label: '01',
    title: 'Categoría del mes',
    text: 'Cada cierre mensual asigna puntos según la categoría alcanzada.',
  },
  {
    label: '02',
    title: 'Permanencia',
    text: 'Si la categoría se mantiene 3 o 6 meses consecutivos, suma bonos adicionales.',
  },
  {
    label: '03',
    title: 'Canje',
    text: 'El saldo acumulado puede utilizarse en beneficios disponibles.',
  },
];

function categoryClasses(key: CategoriaKey) {
  return CATEGORIA_COLORS[key] ?? CATEGORIA_COLORS.PLAN_MEJORA;
}

function PointsAndRewardsGuide() {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-8 border-b border-slate-200 px-5 py-7 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-red-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-red-600">
              Suma puntos
            </Badge>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Reconocimiento comercial
            </Badge>
          </div>

          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Un programa simple: desempeño sostenido, puntos acumulados y beneficios concretos.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Esta guía resume cómo se suman puntos, cuándo se activan los bonos por permanencia y qué puede canjear cada vendedor con su saldo disponible.
          </p>
        </div>

        <Card className="rounded-3xl border-slate-200 bg-slate-50/70 shadow-none">
          <CardContent className="p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Criterio definido
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-black tracking-tight text-slate-950">Bonos acumulables</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Al llegar a 6 meses, se conserva el bono de 3 meses y se agrega el de 6 meses.
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-red-600 shadow-sm">
                <Coins className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid border-b border-slate-200 lg:grid-cols-3">
        {recognitionSteps.map((step, index) => (
          <div
            key={step.label}
            className={cn(
              'p-5 sm:p-6',
              index !== recognitionSteps.length - 1 && 'border-b border-slate-200 lg:border-b-0 lg:border-r'
            )}
          >
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-red-600">{step.label}</div>
            <div className="mt-2 text-base font-black text-slate-950">{step.title}</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section>
          <SectionTitle
            icon={<Trophy className="h-5 w-5" />}
            eyebrow="Categoría mensual"
            title="Puntos base por cierre"
            description="Cada vendedor suma según la categoría alcanzada en el mes. Los colores respetan la identificación oficial de categorías."
          />

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            {categoryPoints.map((category, index) => {
              const color = categoryClasses(category.key);
              return (
                <div
                  key={category.key}
                  className={cn(
                    'grid gap-4 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center',
                    index !== categoryPoints.length - 1 && 'border-b border-slate-200'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-1 h-3 w-3 rounded-full border', color.bg, color.border)} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-950">{category.name}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-black', color.bg, color.text, color.border)}>
                          {category.points} pts/mes
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{category.description}</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-3xl font-black tracking-tight text-slate-950">{category.points}</div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">puntos</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle
            icon={<TrendingUp className="h-5 w-5" />}
            eyebrow="Permanencia"
            title="Bonos por sostener categoría"
            description="Los bonos reconocen constancia. Para 6 meses consecutivos, se suma el bono de 3 meses y también el de 6 meses."
          />

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[1fr_92px_92px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              <span>Categoría</span>
              <span className="text-right">3 meses</span>
              <span className="text-right">6 meses</span>
            </div>
            {permanenceBonuses.map((bonus) => {
              const color = categoryClasses(bonus.key);
              return (
                <div key={bonus.key} className="grid grid-cols-[1fr_92px_92px] items-center border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <span className={cn('w-fit rounded-full border px-2.5 py-1 text-xs font-black', color.bg, color.text, color.border)}>
                    {bonus.category}
                  </span>
                  <span className="text-right text-sm font-black text-slate-900">+{bonus.three}</span>
                  <span className="text-right text-sm font-black text-slate-900">+{bonus.six}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ejemplo de cálculo</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Si un vendedor sostiene <strong>Senior durante 6 meses</strong>, acumula 120 pts base, más 20 pts por el hito de 3 meses y 40 pts por el hito de 6 meses: <strong>180 pts totales</strong>.
            </p>
          </div>
        </section>

        <section className="xl:col-span-2">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionTitle
                icon={<Gift className="h-5 w-5" />}
                eyebrow="Canjes"
                title="Beneficios disponibles"
                description="El saldo acumulado se transforma en beneficios vinculados con la actividad diaria del vendedor."
              />

              <Card className="mt-5 rounded-3xl border-slate-200 bg-white shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-red-600">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">Regla de lectura</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Los puntos no reemplazan el análisis comercial: funcionan como reconocimiento visible y canjeable por constancia y categoría alcanzada.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {rewardCatalog.map((reward, index) => (
                <div
                  key={reward.name}
                  className={cn(
                    'grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center',
                    index !== rewardCatalog.length - 1 && 'border-b border-slate-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                      {reward.icon}
                    </div>
                    <div className="text-sm font-bold text-slate-800">{reward.name}</div>
                  </div>
                  <div className="w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white sm:ml-auto">
                    {reward.points} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="xl:col-span-2">
          <SectionTitle
            icon={<CheckCircle2 className="h-5 w-5" />}
            eyebrow="Seguimiento"
            title="Plan de acción según rendimiento"
            description="La lectura del sistema también ayuda a detectar cuándo conviene acompañar al vendedor con acciones concretas."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Sin plan de acción',
                text: 'Suma puntos con regularidad y sostiene su categoría sin señales relevantes de caída.',
                line: 'bg-emerald-600',
              },
              {
                title: 'Seguimiento recomendado',
                text: 'Tiene pocos puntos, baja de categoría o presenta resultados irregulares en el período.',
                line: 'bg-amber-500',
              },
              {
                title: 'Aplicar plan de acción',
                text: 'No suma puntos, cae a Plan de Mejora o acumula varios meses con bajo rendimiento.',
                line: 'bg-red-600',
              },
            ].map((item) => (
              <Card key={item.title} className="overflow-hidden rounded-2xl border-slate-200 shadow-none">
                <div className={cn('h-1.5', item.line)} />
                <CardContent className="p-4">
                  <div className="text-sm font-black text-slate-950">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-red-600">
        {icon}
        {eyebrow}
      </div>
      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
