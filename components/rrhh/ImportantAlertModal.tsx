'use client';

import { AnimatePresence, motion } from 'framer-motion';

export type ImportantAlertModalProps = {
  open: boolean;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  requireAck: boolean;
  onAcknowledge: () => void;
};

const badgeMap: Record<ImportantAlertModalProps['severity'], string> = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export default function ImportantAlertModal({
  open,
  title,
  content,
  severity,
  requireAck,
  onAcknowledge,
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
          {/* overlay */}
          <div className="absolute inset-0 bg-black/55" />

          {/* card */}
          <motion.div
            className="relative w-[min(720px,92vw)] rounded-2xl bg-white shadow-2xl overflow-hidden"
            initial={{ y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'px-2 py-1 rounded-md text-xs font-bold',
                      badgeMap[severity],
                    ].join(' ')}
                  >
                    {severity.toUpperCase()}
                  </span>

                  <div className="text-lg font-extrabold text-slate-900">
                    {title}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-sm text-slate-600">
                {requireAck
                  ? 'Esta alerta requiere confirmación para continuar.'
                  : 'Aviso informativo.'}
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-700 whitespace-pre-wrap">{content}</p>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onAcknowledge}
                  className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
                >
                  {requireAck ? 'Entendido' : 'Cerrar'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
