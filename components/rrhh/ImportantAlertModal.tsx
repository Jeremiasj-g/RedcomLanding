'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, EyeOff, X } from 'lucide-react';

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

  // opcional: si querés permitir cerrar por X/overlay (lo usamos para snooze rápido)
  onRequestClose?: () => void | Promise<void>;
};

const badgeBySeverity: Record<Severity, string> = {
  info: 'bg-sky-100 text-sky-700 border-sky-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
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
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => {
              // si requireAck, no dejamos cerrar por overlay
              if (requireAck) return;
              onRequestClose?.();
            }}
          />

          <motion.div
            className="relative w-[min(720px,92vw)] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-lg font-extrabold text-slate-900">{title}</div>

                  <span
                    className={[
                      'inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-xs font-bold border',
                      badgeBySeverity[severity],
                    ].join(' ')}
                  >
                    {severity.toUpperCase()}
                  </span>

                  {requireAck ? (
                    <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200">
                      REQUIERE ACK
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                  {content}
                </div>
              </div>

              {!requireAck ? (
                <button
                  type="button"
                  onClick={() => onRequestClose?.()}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
                  title="Cerrar"
                >
                  <X className="h-4 w-4 text-slate-700" />
                </button>
              ) : null}
            </div>

            {/* acciones */}
            <div className="p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
              <TooltipButton
                label="Entendido (ACK) — No vuelve a aparecer"
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={onAcknowledge}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Entendido
              </TooltipButton>

              <TooltipButton
                label="Recordar en 3 min"
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                onClick={onSnooze}
                icon={<Clock className="h-4 w-4" />}
              >
                Recordar 3 min
              </TooltipButton>

              <TooltipButton
                label={
                  requireAck
                    ? 'No disponible: requiere ACK'
                    : 'No mostrar más esta alerta'
                }
                className={[
                  'border border-slate-200 bg-white hover:bg-slate-50 text-slate-900',
                  requireAck ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
                onClick={requireAck ? undefined : onDismissForever}
                icon={<EyeOff className="h-4 w-4" />}
                disabled={requireAck}
              >
                No mostrar más
              </TooltipButton>
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
          'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
          className,
        ].join(' ')}
      >
        {icon}
        {children}
      </button>

      {/* tooltip */}
      <div className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition">
        <div className="rounded-xl bg-slate-900 text-white text-xs font-semibold px-3 py-2 shadow-lg whitespace-nowrap">
          {label}
        </div>
      </div>
    </div>
  );
}
