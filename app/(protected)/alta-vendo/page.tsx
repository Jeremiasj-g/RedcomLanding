'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Clock3,
  Mail,
  RefreshCw,
  Send,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/auth/AuthProvider';
import { useBranches } from '@/hooks/useBranches';
import DualSpinner from '@/components/ui/DualSpinner';
import type { VendoMovementType, VendoRequest } from '@/lib/vendo/types';

const initialForm = {
  branchCode: '',
  firstName: '',
  lastName: '',
  movementType: 'alta' as VendoMovementType,
  imei: '',
  phone: '',
  vendorEmail: '',
  reason: '',
};

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function requestStatusBadge(status: VendoRequest['status']) {
  return status === 'seen' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <BadgeCheck className="h-3.5 w-3.5" /> Vista por administración
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Clock3 className="h-3.5 w-3.5" /> Pendiente de revisión
    </span>
  );
}

function emailStatusLabel(status: VendoRequest['email_status']) {
  if (status === 'sent') return 'Correo enviado';
  if (status === 'no_recipients') return 'Sin destinatarios configurados';
  if (status === 'failed') return 'Error al enviar correo';
  return 'Correo pendiente';
}

export default function AltaVendoPage() {
  const { me } = useAuth();
  const { branches, loading: branchesLoading, errorMsg: branchesError } = useBranches();
  const [form, setForm] = useState(initialForm);
  const [requests, setRequests] = useState<VendoRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const orderedBranches = useMemo(() => {
    const own = new Set((me?.branches ?? []).map((branch) => branch.toLowerCase()));
    return [...branches].sort((a, b) => {
      const aOwn = own.has(a.value.toLowerCase()) ? 0 : 1;
      const bOwn = own.has(b.value.toLowerCase()) ? 0 : 1;
      return aOwn - bOwn || a.label.localeCompare(b.label);
    });
  }, [branches, me?.branches]);

  useEffect(() => {
    if (!form.branchCode && orderedBranches.length > 0) {
      setForm((current) => ({ ...current, branchCode: orderedBranches[0].value }));
    }
  }, [form.branchCode, orderedBranches]);

  const loadHistory = useCallback(async () => {
    if (!me?.id) return;
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('vendo_requests')
      .select('*')
      .eq('requested_by', me.id)
      .order('created_at', { ascending: false });

    if (error) {
      setNotice({ type: 'error', message: `No se pudo cargar el historial: ${error.message}` });
      setRequests([]);
    } else {
      setRequests((data ?? []) as VendoRequest[]);
    }
    setHistoryLoading(false);
  }, [me?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!me?.id) return;
    const channel = supabase
      .channel(`vendo_requests_user_${me.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendo_requests', filter: `requested_by=eq.${me.id}` },
        () => loadHistory(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadHistory, me?.id]);

  const setField = <K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('La sesión venció. Volvé a iniciar sesión.');

      const response = await fetch('/api/vendo/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo registrar la solicitud.');

      setNotice({
        type: payload.warning ? 'warning' : 'success',
        message: payload.warning ?? 'La solicitud se registró y el correo fue enviado correctamente.',
      });
      setForm((current) => ({
        ...initialForm,
        branchCode: current.branchCode,
        movementType: current.movementType,
      }));
      await loadHistory();
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-red-800 via-red-600 to-orange-400" />
          <div className="flex flex-col gap-4 px-6 py-7 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-red-700">
                <Smartphone className="h-3.5 w-3.5" /> Gestión de dispositivos
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">Alta de Vendo</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Registrá altas o bajas de dispositivos. La solicitud queda guardada, aparece en tu historial y se notifica por correo a los responsables configurados por administración.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Solicitante</span>
              <span className="mt-1 block font-semibold text-slate-900">{me?.full_name || me?.email}</span>
              <span className="block text-xs">{me?.email}</span>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Nueva solicitud</h2>
              <p className="text-sm text-slate-500">Completá todos los datos del vendedor y del dispositivo.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <label htmlFor="branch" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Building2 className="h-4 w-4 text-red-700" /> Sucursal
                </label>
                <select
                  id="branch"
                  required
                  value={form.branchCode}
                  disabled={branchesLoading}
                  onChange={(event) => setField('branchCode', event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Seleccionar sucursal</option>
                  {orderedBranches.map((branch) => (
                    <option key={branch.id} value={branch.value}>{branch.label}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">Las opciones se consultan directamente desde la tabla de sucursales.</p>
                {branchesError && <p className="mt-2 text-xs font-medium text-red-600">{branchesError}</p>}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <label htmlFor="movement" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <RefreshCw className="h-4 w-4 text-red-700" /> Tipo de movimiento
                </label>
                <select
                  id="movement"
                  required
                  value={form.movementType}
                  onChange={(event) => setField('movementType', event.target.value as VendoMovementType)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  <option value="alta">Alta</option>
                  <option value="baja">Baja</option>
                </select>
                <p className="mt-2 text-xs text-slate-500">La gestión se registra para que administración la ejecute en el sistema VENDO.</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Nombre del vendedor" icon={<UserRound className="h-4 w-4" />}>
                <input required maxLength={80} value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} placeholder="Ingrese nombre" className="vendo-input" />
              </Field>
              <Field label="Apellido del vendedor" icon={<UserRound className="h-4 w-4" />}>
                <input required maxLength={80} value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} placeholder="Ingrese apellido" className="vendo-input" />
              </Field>
              <Field label="IMEI / código de aplicación" icon={<Smartphone className="h-4 w-4" />} hint="Admite IMEI numérico o el código alfanumérico utilizado por VENDO.">
                <input required minLength={6} maxLength={60} value={form.imei} onChange={(event) => setField('imei', event.target.value.trim())} placeholder="Ingrese IMEI o código" className="vendo-input font-mono" />
              </Field>
              <Field label="Número de celular" icon={<Smartphone className="h-4 w-4" />}>
                <input required minLength={7} maxLength={40} inputMode="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="Ingrese número de celular" className="vendo-input" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Correo electrónico del vendedor" icon={<Mail className="h-4 w-4" />}>
                  <input required type="email" maxLength={180} value={form.vendorEmail} onChange={(event) => setField('vendorEmail', event.target.value)} placeholder="emailvendedor@ejemplo.com" className="vendo-input" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Razón del alta o baja" icon={<BadgeCheck className="h-4 w-4" />}>
                  <textarea required minLength={3} maxLength={1000} rows={4} value={form.reason} onChange={(event) => setField('reason', event.target.value)} placeholder="Describa el motivo del movimiento" className="vendo-input min-h-[110px] resize-y py-3" />
                </Field>
              </div>
            </div>

            {notice && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : notice.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-red-200 bg-red-50 text-red-800'
              }`}>
                {notice.message}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...initialForm, branchCode: current.branchCode }))}
                disabled={submitting}
                className="h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Limpiar formulario
              </button>
              <button
                type="submit"
                disabled={submitting || branchesLoading || !form.branchCode}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-700 px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Registrando…' : 'Registrar solicitud'}
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Mi historial de solicitudes</h2>
              <p className="mt-1 text-sm text-slate-500">Podés consultar todas las altas y bajas que enviaste.</p>
            </div>
            <button onClick={loadHistory} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>

          {historyLoading ? (
            <div className="grid min-h-56 place-items-center"><DualSpinner size={48} thickness={4} /></div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Smartphone className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-bold text-slate-700">Todavía no enviaste solicitudes.</p>
              <p className="mt-1 text-sm text-slate-500">Cuando registres una, aparecerá en este historial.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-bold">Fecha</th>
                    <th className="px-5 py-3 font-bold">Sucursal</th>
                    <th className="px-5 py-3 font-bold">Movimiento</th>
                    <th className="px-5 py-3 font-bold">Vendedor</th>
                    <th className="px-5 py-3 font-bold">Dispositivo</th>
                    <th className="px-5 py-3 font-bold">Estado</th>
                    <th className="px-5 py-3 font-bold">Correo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {requests.map((request) => (
                    <tr key={request.id} className="align-top hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{dateFormatter.format(new Date(request.created_at))}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{request.branch_name}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${request.movement_type === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {request.movement_type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{request.first_name} {request.last_name}</div>
                        <div className="mt-1 text-xs text-slate-500">{request.vendor_email}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">{request.imei}</td>
                      <td className="px-5 py-4">{requestStatusBadge(request.status)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{emailStatusLabel(request.email_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <style jsx global>{`
        .vendo-input {
          width: 100%;
          height: 3rem;
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding-left: 0.875rem;
          padding-right: 0.875rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }
        .vendo-input:focus {
          border-color: rgb(239 68 68);
          box-shadow: 0 0 0 4px rgb(254 226 226);
        }
      `}</style>
    </div>
  );
}

function Field({ label, icon, hint, children }: { label: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
        <span className="text-red-700">{icon}</span>{label}
      </span>
      {children}
      {hint && <span className="mt-2 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
