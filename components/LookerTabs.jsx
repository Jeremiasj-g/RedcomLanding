'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function LookerTabs({
  tabs = [],
  defaultTab,
  className = '',
  eyebrow = 'Panel comercial',
  title = 'Dashboard y mapa de calor',
  description = 'Consultá las visualizaciones principales de la sucursal y alterná entre tablero ejecutivo y lectura territorial sin salir de la pantalla.',
  children,
}) {
  const safeTabs = useMemo(() => tabs ?? [], [tabs]);

  const initialTab = useMemo(() => {
    if (!safeTabs.length) return null;

    const foundDefault = safeTabs.find((tab) => tab.key === defaultTab);
    return foundDefault ?? safeTabs[0];
  }, [safeTabs, defaultTab]);

  const [activeTabKey, setActiveTabKey] = useState(initialTab?.key ?? null);

  const activeTab = useMemo(() => {
    return safeTabs.find((tab) => tab.key === activeTabKey) ?? safeTabs[0] ?? null;
  }, [safeTabs, activeTabKey]);

  if (!safeTabs.length) return null;

  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="rounded-[2rem]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {eyebrow}
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                {description}
              </p>
            </div>

            <div className="w-full lg:w-auto">
              <div className="grid rounded-2xl border border-slate-200 bg-gray-100/80 p-1 shadow-inner sm:inline-grid sm:grid-flow-col">
                {safeTabs.map((tab) => {
                  const isActive = activeTab?.key === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTabKey(tab.key)}
                      className={`relative isolate flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-slate-900/10 sm:min-w-[170px] ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-600 hover:bg-white hover:text-slate-950'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="looker-active-tab"
                          className="absolute inset-0 -z-10 rounded-xl bg-slate-950 shadow-lg shadow-slate-900/20"
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 34,
                          }}
                        />
                      )}
                      <span className={isActive ? 'text-sky-200' : 'text-slate-500'}>
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative z-0"
      >
        {typeof children === 'function'
          ? children({
              activeTab,
              activeTabKey,
              setActiveTabKey,
              tabs: safeTabs,
            })
          : children}
      </motion.div>
    </section>
  );
}
