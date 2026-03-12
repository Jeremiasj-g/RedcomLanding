'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function LookerTabs({
  tabs = [],
  defaultTab,
  className = '',
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
    <div className={className}>
      <div className="relative z-30 mt-6 flex justify-center">
        <div className="relative inline-flex rounded-full border border-white/10 bg-slate-800 p-1 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          {safeTabs.map((tab) => {
            const isActive = activeTab?.key === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTabKey(tab.key)}
                className="relative z-10"
              >
                <div className="relative px-4 py-2.5 sm:px-5">
                  {isActive && (
                    <motion.div
                      layoutId="looker-active-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-blue-500/20 ring-1 ring-cyan-400/20"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}

                  <div
                    className={`relative flex items-center gap-2 text-lg font-medium transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </div>
                </div>
              </button>
            );
          })}
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
    </div>
  );
}