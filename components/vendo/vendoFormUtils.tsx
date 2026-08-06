import type { ReactNode } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type { VendoMovementType, VendoRequest } from '@/lib/vendo/types';

export const HISTORY_PAGE_SIZE = 8;

export const INITIAL_VENDO_FORM = {
  branchCode: '',
  firstName: '',
  lastName: '',
  movementType: 'alta' as VendoMovementType,
  imei: '',
  phone: '',
  vendorEmail: '',
  reason: '',
};

export type VendoFormValue = typeof INITIAL_VENDO_FORM;

export const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export function displayImei(value: unknown) {
  return String(value ?? '').trim() || 'No informado';
}

export function deviceKey(request: VendoRequest) {
  const imei = normalizeSearch(request.imei);
  if (imei) return `imei:${imei}`;

  const email = normalizeSearch(request.vendor_email);
  const phone = normalizeSearch(request.phone).replace(/\D/g, '');
  const branch = normalizeSearch(request.branch_code);
  const name = normalizeSearch(`${request.first_name} ${request.last_name}`);
  return `vendor:${email}|${phone}|${branch}|${name}`;
}

export function requestStatusBadge(request: VendoRequest) {
  if (request.status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Aceptada
      </span>
    );
  }

  if (request.status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-extrabold text-red-700">
        <XCircle className="h-3.5 w-3.5" /> Rechazada
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700">
      <Clock3 className="h-3.5 w-3.5" /> Pendiente
    </span>
  );
}

export function emailStatusLabel(request: VendoRequest) {
  if (request.email_status === 'sent') return 'Notificación enviada';
  if (request.email_status === 'failed') return 'Falló la notificación';
  if (request.email_status === 'no_recipients') return 'Sin destinatarios';
  return 'Notificación pendiente';
}

export function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
      </span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}
