'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, EyeOff, X, Sparkles } from 'lucide-react';

type Severity = 'info' | 'warning' | 'critical';

export type ImportantAlertModalProps = {
  open: boolean;
  title: string;
  content: string;
  severity: Severity;
  requireAck: boolean;

  onAcknowledge: () => void | Promise<void>;
  onSnooze: () => void | Promise<void>;
  onDismissForever: () => void | Promise<void>;

  onRequestClose?: () => void | Promise<void>;
};

const uiBySeverity: Record<
  Severity,
  {
    badge: string;
    ring: string;
    glow: string;
    iconWrap: string;
    accentText: string;
  }
> = {
  info: {
    badge: 'bg-sky-500/10 text-sky-200 border-sky-500/25',
    ring: 'ring-1 ring-sky-500/25',
    glow: 'from-sky-500/40 via-sky-500/10 to-transparent',
    iconWrap: 'bg-sky-500/15 text-sky-200 border-sky-500/25',
    accentText: 'text-sky-200',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-200 border-amber-500/25',
    ring: 'ring-1 ring-amber-500/25',
    glow: 'from-amber-500/40 via-amber-500/10 to-transparent',
    iconWrap: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
    accentText: 'text-amber-200',
  },
  critical: {
    badge: 'bg-rose-500/10 text-rose-200 border-rose-500/25',
    ring: 'ring-1 ring-rose-500/25',
    glow: 'from-rose-500/40 via-rose-500/10 to-transparent',
    iconWrap: 'bg-rose-500/15 text-rose-200 border-rose-500/25',
    accentText: 'text-rose-200',
  },
};

export function ImportantAlertModal({
  open,
  title,
  content,
  severity,
  requireAck,
  onAcknowledge,
  onSnooze,
  onDismissForever,
  onRequestClose,
}: ImportantAlertModalProps) {
  const ui = uiBySeverity[severity];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center px-4 sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay + blur */}
          <motion.button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (requireAck) return;
              onRequestClose?.();
            }}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Alerta importante"
            className={[
              'relative w-full max-w-2xl overflow-hidden rounded-3xl',
              'border border-white/10 bg-gray-800 text-slate-100 shadow-2xl',
              'backdrop-blur-xl',
              ui.ring,
            ].join(' ')}
            initial={{ y: 22, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            {/* decorative glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[680px] -translate-x-1/2 rounded-full blur-3xl opacity-70">
              <div className={['h-full w-full bg-gradient-to-r', ui.glow].join(' ')} />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />

            {/* Header */}
            <div className="relative px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'mt-0.5 grid h-11 w-11 place-items-center rounded-2xl',
                      'border',
                      ui.iconWrap,
                    ].join(' ')}
                  >
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                        {title}
                      </h2>

                      <span
                        className={[
                          'inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide',
                          ui.badge,
                        ].join(' ')}
                      >
                        {severity}
                      </span>

                      {requireAck ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-200">
                          REQUIERE ACK
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-slate-200/90 whitespace-pre-wrap">
                      {content}
                    </p>
                  </div>
                </div>

                {!requireAck ? (
                  <button
                    type="button"
                    onClick={() => onRequestClose?.()}
                    className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/10"
                    title="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Footer actions */}
            <div className="relative mt-5 border-t border-white/10 bg-white/[0.03] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <TooltipButton
                  label="Entendido (ACK) — No vuelve a aparecer"
                  className="bg-white text-slate-950 hover:bg-white/90 focus:ring-white/20"
                  onClick={onAcknowledge}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                >
                  Entendido
                </TooltipButton>

                <TooltipButton
                  label="Recordar en 3 min"
                  className={[
                    'border border-white/10 bg-white/5 text-white hover:bg-white/10',
                    'focus:ring-white/10',
                  ].join(' ')}
                  onClick={onSnooze}
                  icon={<Clock className="h-4 w-4" />}
                >
                  Recordar 3 min
                </TooltipButton>

                <TooltipButton
                  label={requireAck ? 'No disponible: requiere ACK' : 'No mostrar más esta alerta'}
                  className={[
                    'border border-white/10 bg-white/5 text-white hover:bg-white/10',
                    requireAck ? 'opacity-50 cursor-not-allowed' : '',
                    'focus:ring-white/10',
                  ].join(' ')}
                  onClick={requireAck ? undefined : onDismissForever}
                  icon={<EyeOff className="h-4 w-4" />}
                  disabled={requireAck}
                >
                  No mostrar más
                </TooltipButton>
              </div>

              {!requireAck ? (
                <div className="mt-3 text-[11px] text-slate-400">
                  Tip: si cerrás con la <span className={ui.accentText}>X</span> o el fondo, se comporta como
                  “Recordar”.
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-slate-400">
                  Esta alerta requiere confirmación. Presioná <span className="text-white font-semibold">Entendido</span>.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function TooltipButton({
  children,
  label,
  icon,
  className,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  icon: React.ReactNode;
  className: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold transition',
          'shadow-sm shadow-black/30',
          'focus:outline-none focus:ring-4',
          className,
        ].join(' ')}
      >
        {icon}
        {children}
      </button>

      {/* tooltip */}
      <div className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition">
        <div className="rounded-2xl border border-white/10 bg-black/80 text-white text-xs font-semibold px-3 py-2 shadow-lg whitespace-nowrap backdrop-blur">
          {label}
        </div>
      </div>
    </div>
  );
}
