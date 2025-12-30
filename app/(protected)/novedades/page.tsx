'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

type TypeFilter = 'all' | 'news' | 'weekly' | 'birthday';

const tabs: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'news', label: 'Noticias' },
  { key: 'weekly', label: 'Semanales' },
  { key: 'birthday', label: 'Cumpleaños' },
];

export default function NovedadesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<TypeFilter>('all');

  const load = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id,type,title,content,severity,pinned,created_at')
      .neq('type', 'important_alert') // la alerta va por popup en home
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    setItems(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((x) => {
      const okTab = tab === 'all' ? true : x.type === tab;
      const okQ =
        !query ||
        String(x.title).toLowerCase().includes(query) ||
        String(x.content).toLowerCase().includes(query);
      return okTab && okQ;
    });
  }, [items, q, tab]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Novedades</h1>
          <p className="text-sm text-slate-500">Comunicaciones internas y avisos.</p>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-[min(320px,60vw)] rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Buscar…"
        />
      </div>

      <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2 text-sm font-semibold rounded-xl transition',
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map((it) => (
            <motion.div
              key={it.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {it.pinned ? (
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-slate-900 text-white">
                      PINNED
                    </span>
                  ) : null}

                  <span className="text-xs font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                    {String(it.type).toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-slate-500">
                  {new Date(it.created_at).toLocaleString()}
                </div>
              </div>

              <div className="mt-2 text-lg font-extrabold text-slate-900">{it.title}</div>
              <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{it.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No hay resultados.
          </div>
        ) : null}
      </div>
    </div>
  );
}
