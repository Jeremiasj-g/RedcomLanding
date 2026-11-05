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
              <div className="mb-7 inline-flex w-full gap-1 border-b border-slate-200 pb-2 sm:w-auto">
                {[
                  { key: 'guide' as const, label: 'Cómo funciona' },
                  { key: 'playground' as const, label: 'Playground' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPointsView(item.key)}
                    className={cn(
                      'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 sm:flex-none',
                      pointsView === item.key
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={pointsView} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.2}}>
                  {pointsView === 'guide' ? <PointsAndRewardsGuide /> : <RecognitionScoringPlayground />}
                </motion.div>
              </AnimatePresence>
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-10 pb-10">
      <header className="grid gap-6 border-b border-slate-200 pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Tu desempeño se transforma en puntos.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Cada cierre mensual suma puntos según la categoría alcanzada. Mantenerla durante varios meses agrega bonos, y el saldo permite acceder a beneficios.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600 md:max-w-[240px]">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Coins className="h-5 w-5" /></div>
          <span>Los bonos de 3 y 6 meses son acumulables.</span>
        </div>
      </header>

      <section>
        <div className="mb-5">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">Puntos por categoría</h3>
          <p className="mt-1 text-sm text-slate-500">Tu categoría al cierre de cada mes determina los puntos base.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          {categoryPoints.map((category) => {
            const color=categoryClasses(category.key);
            return <div key={category.key} className="border-b border-slate-200 pb-5">
              <span className={cn('inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium',color.bg,color.text,color.border)}>{category.name}</span>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{category.points}<span className="ml-1 text-sm font-normal text-slate-500">pts/mes</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{category.description}</p>
            </div>;
          })}
        </div>
      </section>

      <section className="grid gap-6 border-b border-slate-200 pb-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">Bonos por permanencia</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Al sostener una categoría tres meses, obtenés un bono. Al completar seis, se agrega el segundo sin perder el primero.</p>
          <div className="mt-5 border-l-2 border-emerald-500 pl-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Ejemplo: Senior durante 6 meses</span>
            <p className="mt-1">120 puntos base + 20 de bono a los 3 meses + 40 a los 6 meses = <strong className="font-semibold text-slate-900">180 puntos</strong>.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-3 font-medium">Categoría</th><th className="py-3 text-right font-medium">3 meses</th><th className="py-3 text-right font-medium">6 meses</th></tr></thead>
            <tbody>{permanenceBonuses.map(bonus=>{const color=categoryClasses(bonus.key);return <tr key={bonus.key} className="border-b border-slate-100">
              <td className="py-3"><span className={cn('inline-flex rounded-lg border px-2 py-1 text-xs font-medium',color.bg,color.text,color.border)}>{bonus.category}</span></td>
              <td className="py-3 text-right font-semibold text-slate-900">+{bonus.three}</td>
              <td className="py-3 text-right font-semibold text-slate-900">+{bonus.six}</td>
            </tr>})}</tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">Beneficios para canjear</h3>
          <p className="mt-1 text-sm text-slate-500">El saldo de puntos puede utilizarse para estos beneficios.</p>
        </div>
        <div className="grid gap-x-8 sm:grid-cols-2">
          {rewardCatalog.map(reward=><div key={reward.name} className="flex items-center justify-between gap-4 border-b border-slate-100 py-4">
            <div className="flex min-w-0 items-center gap-3"><span className="text-slate-500">{reward.icon}</span><span className="text-sm font-medium text-slate-800">{reward.name}</span></div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{reward.points} pts</span>
          </div>)}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-8">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">Seguimiento del rendimiento</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">El programa también permite identificar cuándo conviene acompañar al vendedor con un plan de acción.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            {title:'Sin plan de acción',text:'Suma puntos con regularidad y sostiene su categoría.',tone:'bg-emerald-500'},
            {title:'Seguimiento recomendado',text:'Baja de categoría o presenta resultados irregulares.',tone:'bg-amber-400'},
            {title:'Aplicar plan de acción',text:'No suma puntos o acumula meses de bajo rendimiento.',tone:'bg-rose-500'},
          ].map(item=><div key={item.title} className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full',item.tone)}/><h4 className="text-sm font-semibold text-slate-900">{item.title}</h4></div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
          </div>)}
        </div>
      </section>
    </motion.div>
  );
}
