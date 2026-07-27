'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/auth/AuthProvider';
import { useBranches } from '@/hooks/useBranches';
import DualSpinner from '@/components/ui/DualSpinner';
import { Checkbox } from '@/components/ui/checkbox';
import { submitVendoWeb3Forms, type VendoWeb3FormsPayload } from '@/lib/vendo/web3forms';
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

function requestStatusBadge(request: VendoRequest) {
  if (request.status === 'accepted') {
    return (
      <div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Aceptada
        </span>
        {request.reviewed_at && <p className="mt-1 text-xs text-slate-500">{dateFormatter.format(new Date(request.reviewed_at))}</p>}
      </div>
    );
  }
  if (request.status === 'rejected') {
    return (
      <div>
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <XCircle className="h-3.5 w-3.5" /> Rechazada
        </span>
        {request.review_note && <p className="mt-1 max-w-[240px] text-xs text-red-700">{request.review_note}</p>}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Clock3 className="h-3.5 w-3.5" /> Pendiente de revisión
    </span>
  );
}

function emailStatusLabel(request: VendoRequest) {
  if (request.email_status === 'sent') return 'Aceptado por Web3Forms';
  if (request.email_status === 'no_recipients') return 'Registro anterior sin destinatarios';
  if (request.email_status === 'partial') return 'Notificación enviada parcialmente';
  if (request.email_status === 'failed') return request.email_error || 'Error en Web3Forms';
  return 'Notificación pendiente';
}

export default function AltaVendoPage() {
  const { me } = useAuth();
  const { branches, loading: branchesLoading, errorMsg: branchesError } = useBranches();
  const [form, setForm] = useState(initialForm);
  const [requests, setRequests] = useState<VendoRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      const next = (data ?? []) as VendoRequest[];
      setRequests(next);
      setSelectedIds((current) => {
        const existing = new Set(next.map((request) => request.id));
        return new Set([...current].filter((id) => existing.has(id)));
      });
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

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('La sesión venció. Volvé a iniciar sesión.');
    return token;
  };

  const updateNotificationStatus = async (
    token: string,
    requestId: string,
    status: 'sent' | 'failed',
    error?: string | null,
  ) => {
    const response = await fetch('/api/vendo/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'notification', requestId, status, error: error ?? null }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? 'No se pudo actualizar el estado del correo.');
    return payload.request as VendoRequest;
  };

  const setField = <K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/vendo/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo registrar la solicitud.');

      const savedRequest = payload.request as VendoRequest;
      let notificationMessage = '';

      if (payload.notificationPayload) {
        try {
          const result = await submitVendoWeb3Forms(payload.notificationPayload as VendoWeb3FormsPayload);
          await updateNotificationStatus(token, savedRequest.id, 'sent');
          notificationMessage = result.message;
          setNotice({
            type: 'success',
            message: `La solicitud se registró correctamente. Web3Forms confirmó: ${result.message}`,
          });
        } catch (notificationError) {
          const message = notificationError instanceof Error ? notificationError.message : 'Error desconocido de Web3Forms.';
          await updateNotificationStatus(token, savedRequest.id, 'failed', message).catch(() => null);
          notificationMessage = message;
          setNotice({
            type: 'warning',
            message: `La solicitud quedó guardada, pero Web3Forms no pudo enviar la notificación: ${message}`,
          });
        }
      } else {
        setNotice({ type: 'warning', message: payload.warning ?? 'La solicitud se guardó sin enviar notificación.' });
      }

      console.info('[vendo] Web3Forms', notificationMessage);
      setForm((current) => ({ ...initialForm, branchCode: current.branchCode, movementType: current.movementType }));
      await loadHistory();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRequestIds = async (ids: string[]) => {
    const token = await getAccessToken();
    const response = await fetch('/api/vendo/requests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ requestIds: ids }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? 'No se pudieron eliminar las solicitudes.');
    return (payload.deletedIds ?? ids) as string[];
  };

  const deleteRequest = async (request: VendoRequest) => {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente la solicitud de ${request.first_name} ${request.last_name}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingId(request.id);
    setNotice(null);
    try {
      const deletedIds = await deleteRequestIds([request.id]);
      const deletedSet = new Set(deletedIds);
      setRequests((current) => current.filter((row) => !deletedSet.has(row.id)));
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedSet.has(id))));
      setNotice({ type: 'success', message: 'La solicitud se eliminó definitivamente.' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo eliminar la solicitud.' });
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar definitivamente ${ids.length} solicitud${ids.length === 1 ? '' : 'es'}? Esta acción no se puede deshacer.`)) return;

    setBulkDeleting(true);
    setNotice(null);
    try {
      const deletedIds = await deleteRequestIds(ids);
      const deletedSet = new Set(deletedIds);
      setRequests((current) => current.filter((row) => !deletedSet.has(row.id)));
      setSelectedIds(new Set());
      setNotice({ type: 'success', message: `${deletedIds.length} solicitud${deletedIds.length === 1 ? '' : 'es'} eliminada${deletedIds.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'No se pudieron eliminar las solicitudes.' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const allSelected = requests.length > 0 && requests.every((request) => selectedIds.has(request.id));
  const someSelected = requests.some((request) => selectedIds.has(request.id)) && !allSelected;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      if (allSelected) return new Set();
      const next = new Set(current);
      requests.forEach((request) => next.add(request.id));
      return next;
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-red-700">Gestión de dispositivos</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Alta y baja VENDO</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Cargá los datos del vendedor y enviá la solicitud a Administración. El registro queda disponible en tu historial.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Solicitante</span>
            <span className="mt-1 block font-bold text-slate-900">{me?.full_name || me?.email}</span>
            <span className="block text-xs text-slate-500">{me?.email}</span>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="text-lg font-extrabold text-slate-950">Nueva solicitud</h2>
            <p className="mt-1 text-sm text-slate-500">Los campos marcados son obligatorios.</p>
          </div>

          <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Sucursal">
                <select id="branch" required value={form.branchCode} disabled={branchesLoading} onChange={(event) => setField('branchCode', event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                  <option value="">Seleccionar sucursal</option>
                  {orderedBranches.map((branch) => <option key={branch.id} value={branch.value}>{branch.label}</option>)}
                </select>
                {branchesError && <span className="mt-2 block text-xs font-medium text-red-600">{branchesError}</span>}
              </Field>

              <Field label="Tipo de movimiento">
                <select id="movement" required value={form.movementType} onChange={(event) => setField('movementType', event.target.value as VendoMovementType)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100">
                  <option value="alta">Alta</option>
                  <option value="baja">Baja</option>
                </select>
              </Field>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-slate-500">Datos del vendedor</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre"><input required maxLength={80} value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} placeholder="Ingrese nombre" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></Field>
                <Field label="Apellido"><input required maxLength={80} value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} placeholder="Ingrese apellido" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></Field>
                <Field label="IMEI / código de aplicación" hint="Admite el IMEI numérico o el código alfanumérico de VENDO."><input required minLength={6} maxLength={60} value={form.imei} onChange={(event) => setField('imei', event.target.value.trim())} placeholder="Ingrese IMEI o código" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></Field>
                <Field label="Número de celular"><input required minLength={7} maxLength={40} inputMode="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="Ingrese número de celular" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></Field>
                <div className="md:col-span-2"><Field label="Correo electrónico del vendedor"><input required type="email" maxLength={180} value={form.vendorEmail} onChange={(event) => setField('vendorEmail', event.target.value)} placeholder="emailvendedor@ejemplo.com" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></Field></div>
                <div className="md:col-span-2"><Field label="Motivo del movimiento"><textarea required minLength={3} maxLength={1000} rows={4} value={form.reason} onChange={(event) => setField('reason', event.target.value)} placeholder="Describa la razón del alta o baja" className="min-h-[108px] w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></Field></div>
              </div>
            </div>

            {notice && <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : notice.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{notice.message}</div>}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={() => setForm((current) => ({ ...initialForm, branchCode: current.branchCode }))} disabled={submitting} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Limpiar</button>
              <button type="submit" disabled={submitting || branchesLoading || !form.branchCode} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {submitting ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Registrando…' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><h2 className="text-lg font-extrabold text-slate-950">Mi historial</h2><p className="mt-1 text-sm text-slate-500">Consultá o eliminá las solicitudes que enviaste.</p></div>
            <button onClick={loadHistory} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Actualizar</button>
          </div>

          {selectedIds.size > 0 && (
            <div className="mx-5 mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-700"><span className="font-extrabold">{selectedIds.size}</span> solicitud{selectedIds.size === 1 ? '' : 'es'} seleccionada{selectedIds.size === 1 ? '' : 's'}</div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setSelectedIds(new Set())} disabled={bulkDeleting} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Limpiar</button>
                <button type="button" onClick={deleteSelected} disabled={bulkDeleting} className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-700 px-3 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50"><Trash2 className="h-4 w-4" /> {bulkDeleting ? 'Eliminando…' : 'Eliminar seleccionadas'}</button>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="grid min-h-56 place-items-center"><DualSpinner size={48} thickness={4} /></div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-14 text-center"><Smartphone className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-700">Todavía no enviaste solicitudes.</p></div>
          ) : (
            <>
              <div className="hidden lg:block">
                <table className="w-full table-fixed divide-y divide-slate-200 text-left text-xs">
                  <colgroup><col className="w-[5%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[23%]" /><col className="w-[16%]" /><col className="w-[20%]" /><col className="w-[9%]" /></colgroup>
                  <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3"><div className="flex justify-center"><Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Seleccionar todas mis solicitudes" /></div></th>
                      <th className="px-3 py-3 font-bold">Fecha / sucursal</th>
                      <th className="px-3 py-3 font-bold">Movimiento</th>
                      <th className="px-3 py-3 font-bold">Vendedor</th>
                      <th className="px-3 py-3 font-bold">Dispositivo</th>
                      <th className="px-3 py-3 font-bold">Estado</th>
                      <th className="px-3 py-3 text-right font-bold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {requests.map((request) => (
                      <tr key={request.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-3 py-4"><div className="flex justify-center"><Checkbox checked={selectedIds.has(request.id)} onCheckedChange={() => toggleSelected(request.id)} aria-label={`Seleccionar solicitud de ${request.first_name} ${request.last_name}`} /></div></td>
                        <td className="px-3 py-4"><div className="text-slate-600">{dateFormatter.format(new Date(request.created_at))}</div><div className="mt-1 font-semibold text-slate-900">{request.branch_name}</div></td>
                        <td className="px-3 py-4"><span className={`rounded-md px-2 py-1 text-[11px] font-extrabold uppercase ${request.movement_type === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{request.movement_type}</span></td>
                        <td className="px-3 py-4"><div className="font-semibold text-slate-900">{request.first_name} {request.last_name}</div><div className="mt-1 break-all text-[11px] text-slate-500">{request.vendor_email}</div></td>
                        <td className="break-all px-3 py-4 font-mono text-[11px] text-slate-700">{request.imei}</td>
                        <td className="px-3 py-4">{requestStatusBadge(request)}<p className={`mt-2 text-[10px] leading-4 ${request.email_status === 'failed' ? 'text-red-700' : 'text-slate-400'}`}>{emailStatusLabel(request)}</p></td>
                        <td className="px-3 py-4"><div className="flex justify-end"><div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"><HistoryActionButton label="Eliminar" onClick={() => deleteRequest(request)} disabled={deletingId === request.id} icon={deletingId === request.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-700" /> : <Trash2 className="h-4 w-4" />} /></div></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {requests.map((request) => (
                  <article key={request.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selectedIds.has(request.id)} onCheckedChange={() => toggleSelected(request.id)} aria-label={`Seleccionar solicitud de ${request.first_name} ${request.last_name}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">{requestStatusBadge(request)}<span className="text-xs text-slate-500">{dateFormatter.format(new Date(request.created_at))}</span></div>
                        <p className="mt-3 font-bold text-slate-900">{request.first_name} {request.last_name}</p>
                        <p className="break-all text-xs text-slate-500">{request.vendor_email}</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><span className="block text-[10px] font-bold uppercase text-slate-400">Sucursal</span>{request.branch_name}</div><div><span className="block text-[10px] font-bold uppercase text-slate-400">Movimiento</span>{request.movement_type.toUpperCase()}</div><div className="col-span-2"><span className="block text-[10px] font-bold uppercase text-slate-400">Dispositivo</span><span className="break-all font-mono">{request.imei}</span></div></div>
                        <div className="mt-3 flex items-center justify-between gap-3"><p className={`text-[10px] ${request.email_status === 'failed' ? 'text-red-700' : 'text-slate-400'}`}>{emailStatusLabel(request)}</p><HistoryActionButton label="Eliminar" onClick={() => deleteRequest(request)} disabled={deletingId === request.id} icon={deletingId === request.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-700" /> : <Trash2 className="h-4 w-4" />} /></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function HistoryActionButton({ label, onClick, icon, disabled }: { label: string; onClick: () => void; icon: ReactNode; disabled?: boolean }) {
  return (
    <div className="group relative">
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-red-700 transition hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-45">
        {icon}
      </button>
      <div className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 scale-95 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100">{label}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}
