'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquareWarning,
  Power,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/auth/AuthProvider';
import { useBranches } from '@/hooks/useBranches';
import DualSpinner from '@/components/ui/DualSpinner';
import { notify } from '@/lib/notifications';
import { submitVendoWeb3Forms, type VendoWeb3FormsPayload } from '@/lib/vendo/web3forms';
import {
  VENDO_DELETION_REASONS,
  vendoDeletionReasonLabel,
  type VendoDeletionReasonCode,
} from '@/lib/vendo/deletionReasons';
import type { VendoMovementType, VendoRequest } from '@/lib/vendo/types';
import {
  HISTORY_PAGE_SIZE,
  INITIAL_VENDO_FORM,
  dateFormatter,
  deviceKey,
  displayImei,
  emailStatusLabel,
  errorMessage,
  Field,
  normalizeSearch,
  requestStatusBadge,
  type VendoFormValue,
} from './vendoFormUtils';

type CreateResponse = { request?: VendoRequest; notificationPayload?: VendoWeb3FormsPayload; warning?: string; error?: string };

type PatchResponse = { request?: VendoRequest; error?: string };

export default function AltaVendoPage() {
  const { me } = useAuth();
  const { branches, loading: branchesLoading, error: branchesError } = useBranches();
  const [form, setForm] = useState<VendoFormValue>(INITIAL_VENDO_FORM);
  const [requests, setRequests] = useState<VendoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestingDeletionId, setRequestingDeletionId] = useState<string | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<VendoRequest | null>(null);
  const [deletionReason, setDeletionReason] = useState<VendoDeletionReasonCode | ''>('');
  const [deletionNote, setDeletionNote] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [page, setPage] = useState(1);

  const setField = <K extends keyof VendoFormValue>(key: K, value: VendoFormValue[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const loadHistory = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('vendo_requests').select('*').eq('requested_by', me.id).order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data ?? []) as VendoRequest[]);
    } catch (error) {
      notify.error(errorMessage(error, 'No se pudo cargar el historial.'));
    } finally {
      setLoading(false);
    }
  }, [me?.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (!me?.id) return;
    const channel = supabase.channel(`vendo-history-${me.id}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'vendo_requests', filter: `requested_by=eq.${me.id}`,
    }, loadHistory).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadHistory, me?.id]);

  const activeAltas = useMemo(() => {
    const seen = new Set<string>();
    return requests.filter((request) => {
      if (request.status === 'rejected' || request.deletion_requested_at) return false;
      const key = deviceKey(request);
      if (seen.has(key)) return false;
      seen.add(key);
      return request.movement_type === 'alta';
    });
  }, [requests]);

  const filteredDevices = useMemo(() => {
    const query = normalizeSearch(deviceSearch);
    if (!query) return activeAltas;
    return activeAltas.filter((request) => normalizeSearch([
      request.first_name, request.last_name, request.vendor_email, request.phone, request.imei, request.branch_name,
    ].join(' ')).includes(query));
  }, [activeAltas, deviceSearch]);

  const applySource = useCallback((request: VendoRequest) => {
    setSourceId(request.id);
    setForm({
      branchCode: request.branch_code,
      movementType: 'baja',
      firstName: request.first_name,
      lastName: request.last_name,
      imei: request.imei ?? '',
      phone: request.phone,
      vendorEmail: request.vendor_email,
      reason: '',
    });
  }, []);

  const reset = (movementType = form.movementType) => {
    setSourceId('');
    setDeviceSearch('');
    setForm({ ...INITIAL_VENDO_FORM, branchCode: form.branchCode, movementType });
  };

  const startBaja = (request: VendoRequest) => {
    applySource(request);
    setTimeout(() => document.getElementById('vendo-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('La sesión venció. Volvé a iniciar sesión.');
      const response = await fetch('/api/vendo/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, imei: form.imei.trim(), reason: form.reason.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as CreateResponse;
      if (!response.ok || !body.request) throw new Error(body.error || 'No se pudo registrar la solicitud.');
      let created = body.request;
      if (body.notificationPayload) {
        try {
          await submitVendoWeb3Forms(body.notificationPayload);
          const patch = await fetch('/api/vendo/requests', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'notification', requestId: created.id, status: 'sent', error: null }),
          });
          const patchBody = await patch.json().catch(() => ({}));
          if (patch.ok && patchBody.request) created = patchBody.request;
        } catch (error) {
          const message = errorMessage(error, 'No se pudo enviar la notificación.');
          await fetch('/api/vendo/requests', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'notification', requestId: created.id, status: 'failed', error: message }),
          });
          notify.warning('La solicitud se guardó, pero la notificación no pudo enviarse.');
        }
      } else if (body.warning) notify.warning(body.warning);
      setRequests((current) => [created, ...current.filter((row) => row.id !== created.id)]);
      reset(form.movementType);
      setPage(1);
      notify.success('Solicitud registrada correctamente.');
    } catch (error) {
      notify.error(errorMessage(error, 'No se pudo registrar la solicitud.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openDeletionRequest = (request: VendoRequest) => {
    if (request.deletion_requested_at) return;
    setDeletionTarget(request);
    setDeletionReason('');
    setDeletionNote('');
  };

  const closeDeletionRequest = () => {
    if (requestingDeletionId) return;
    setDeletionTarget(null);
    setDeletionReason('');
    setDeletionNote('');
  };

  const requestDeletion = async () => {
    if (!deletionTarget || !deletionReason) return;
    if (deletionReason === 'other' && !deletionNote.trim()) {
      notify.warning('Contanos brevemente por qué querés eliminar la solicitud.');
      return;
    }

    setRequestingDeletionId(deletionTarget.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('La sesión venció. Volvé a iniciar sesión.');

      const response = await fetch('/api/vendo/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'request_deletion',
          requestId: deletionTarget.id,
          reason: deletionReason,
          note: deletionNote.trim() || null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as PatchResponse;
      if (!response.ok || !body.request) throw new Error(body.error || 'No se pudo enviar la petición de eliminación.');

      setRequests((current) => current.map((row) => row.id === body.request!.id ? body.request! : row));
      setDeletionTarget(null);
      setDeletionReason('');
      setDeletionNote('');
      notify.success('Petición de eliminación enviada a Administración.');
    } catch (error) {
      notify.error(errorMessage(error, 'No se pudo solicitar la eliminación.'));
    } finally {
      setRequestingDeletionId(null);
    }
  };

  const filteredHistory = useMemo(() => {
    const query = normalizeSearch(historySearch);
    if (!query) return requests;
    return requests.filter((request) => normalizeSearch([
      request.first_name, request.last_name, request.vendor_email, request.phone, request.imei,
      request.branch_name, request.movement_type, request.status,
      request.deletion_reason_code ? vendoDeletionReasonLabel(request.deletion_reason_code) : '',
      request.deletion_reason_note,
    ].join(' ')).includes(query));
  }, [historySearch, requests]);

  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  useEffect(() => { setPage(1); }, [historySearch]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);
  const visibleHistory = filteredHistory.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-red-700">Gestión de dispositivos</p><h1 className="mt-2 text-3xl font-black text-slate-950">Alta y baja VENDO</h1><p className="mt-2 text-sm text-slate-600">Enviá una solicitud a Administración y consultala luego en tu historial.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"><span className="block text-[10px] font-bold uppercase text-slate-400">Solicitante</span><b className="mt-1 block">{me?.full_name || me?.email}</b><span className="text-xs text-slate-500">{me?.email}</span></div>
        </header>

        <section id="vendo-form" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-extrabold">Nueva solicitud</h2><p className="mt-1 text-sm text-slate-500">Los campos con <b className="text-red-600">*</b> son obligatorios.</p></div>
          <form onSubmit={submit} className="space-y-6 p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Sucursal" required><select required value={form.branchCode} disabled={branchesLoading} onChange={(e) => setField('branchCode', e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"><option value="">Seleccionar sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.value}>{branch.label}</option>)}</select>{branchesError && <span className="mt-2 block text-xs text-red-600">{branchesError}</span>}</Field>
              <Field label="Tipo de movimiento" required><select required value={form.movementType} onChange={(e) => { const value = e.target.value as VendoMovementType; setField('movementType', value); if (value === 'alta') reset('alta'); }} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"><option value="alta">Alta</option><option value="baja">Baja</option></select></Field>
            </div>

            {form.movementType === 'baja' && <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-extrabold"><Power className="h-4 w-4 text-blue-700" />Seleccionar dispositivo dado de alta</h3><p className="mt-1 text-xs leading-5 text-slate-600">Buscá una solicitud anterior para completar automáticamente todos los datos.</p></div>{sourceId && <button type="button" onClick={() => reset('baja')} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold">Completar manualmente</button>}</div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} placeholder="Buscar nombre, celular, correo o IMEI" className="h-11 w-full rounded-xl border border-blue-200 bg-white pl-10 pr-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" /></div><select value={sourceId} onChange={(e) => { const selected = activeAltas.find((row) => row.id === e.target.value); if (selected) applySource(selected); }} className="h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm"><option value="">Seleccionar alta anterior…</option>{filteredDevices.map((request) => <option key={request.id} value={request.id}>{request.first_name} {request.last_name} · {request.phone} · {displayImei(request.imei)}</option>)}</select></div>
              {activeAltas.length === 0 && <p className="mt-3 text-xs text-slate-600">No hay dispositivos activos en tu historial; podés completar los datos manualmente.</p>}
            </div>}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre" required><input required maxLength={80} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-3" /></Field>
              <Field label="Apellido" required><input required maxLength={80} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-3" /></Field>
              <Field label="IMEI / código de aplicación" hint="Opcional. Admite IMEI numérico o código alfanumérico."><input maxLength={60} value={form.imei} onChange={(e) => setField('imei', e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-3 font-mono" /></Field>
              <Field label="Número de celular" required><input required minLength={7} maxLength={40} inputMode="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-3" /></Field>
              <div className="md:col-span-2"><Field label="Correo electrónico del vendedor" required><input required type="email" maxLength={180} value={form.vendorEmail} onChange={(e) => setField('vendorEmail', e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-3" /></Field></div>
              <div className="md:col-span-2"><Field label="Motivo del movimiento" hint="Opcional."><textarea maxLength={1000} rows={4} value={form.reason} onChange={(e) => setField('reason', e.target.value)} className="w-full rounded-xl border border-slate-300 p-3" /></Field></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => reset()} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold">Limpiar</button><button disabled={submitting || !form.branchCode} className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-700 px-6 text-sm font-extrabold text-white disabled:bg-slate-300">{submitting ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}{submitting ? 'Registrando…' : 'Enviar solicitud'}</button></div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-extrabold">Mi historial</h2><p className="text-sm text-slate-500">Buscá solicitudes o reutilizá un alta para darla de baja.</p></div><div className="flex gap-2"><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Buscar en el historial…" className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-9 text-sm" />{historySearch && <button onClick={() => setHistorySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-4 w-4" /></button>}</div><button onClick={loadHistory} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />Actualizar</button></div></div>
          {loading ? <div className="grid min-h-56 place-items-center"><DualSpinner size={48} thickness={4} /></div> : filteredHistory.length === 0 ? <div className="px-6 py-14 text-center"><Smartphone className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-700">No hay solicitudes para mostrar.</p></div> : <>
            <div className="divide-y divide-slate-100">
              {visibleHistory.map((request) => {
                const deletionPending = Boolean(request.deletion_requested_at);
                return (
                  <article
                    key={request.id}
                    className={`grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-center ${deletionPending ? 'bg-red-50/70 ring-1 ring-inset ring-red-200' : 'bg-white'}`}
                  >
                    <div><span className="text-xs text-slate-500">{dateFormatter.format(new Date(request.created_at))}</span><p className="font-bold">{request.branch_name}</p></div>
                    <div><span className={`rounded-md px-2 py-1 text-[11px] font-extrabold uppercase ${request.movement_type === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{request.movement_type}</span><p className="mt-2 font-semibold">{request.first_name} {request.last_name}</p></div>
                    <div className="text-xs text-slate-500">
                      <p>{request.vendor_email} · {request.phone}</p>
                      <p className="mt-1 font-mono">{displayImei(request.imei)}</p>
                      <div className="mt-2">{requestStatusBadge(request)} <span className="ml-2">{emailStatusLabel(request)}</span></div>
                      {deletionPending && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-white/80 px-3 py-2 text-red-800">
                          <div className="flex items-center gap-2 font-extrabold"><Clock3 className="h-4 w-4" /> Eliminación solicitada</div>
                          <p className="mt-1 leading-5">{vendoDeletionReasonLabel(request.deletion_reason_code)}</p>
                          {request.deletion_reason_note && <p className="mt-1 leading-5 text-red-700">{request.deletion_reason_note}</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {request.movement_type === 'alta' && activeAltas.some((row) => row.id === request.id) && <button onClick={() => startBaja(request)} title="Dar de baja" className="grid h-10 w-10 place-items-center rounded-xl border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"><Power className="h-4 w-4" /></button>}
                      {deletionPending ? (
                        <button type="button" disabled className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-100 px-3 text-xs font-extrabold text-red-700"><Clock3 className="h-4 w-4" /> Eliminación solicitada</button>
                      ) : (
                        <button type="button" onClick={() => openDeletionRequest(request)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-extrabold text-red-700 transition hover:bg-red-50"><MessageSquareWarning className="h-4 w-4" /> Solicitar eliminación</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 border-t bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Mostrando {Math.min((page - 1) * HISTORY_PAGE_SIZE + 1, filteredHistory.length)}-{Math.min(page * HISTORY_PAGE_SIZE, filteredHistory.length)} de {filteredHistory.length}</p><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="inline-flex h-9 items-center gap-1 rounded-xl border bg-white px-3 text-xs font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Anterior</button><span className="min-w-24 text-center text-xs font-bold">Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="inline-flex h-9 items-center gap-1 rounded-xl border bg-white px-3 text-xs font-bold disabled:opacity-40">Siguiente<ChevronRight className="h-4 w-4" /></button></div></div>
          </>}
        </section>
      </div>

      {deletionTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeletionRequest(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="vendo-delete-request-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-red-700"><MessageSquareWarning className="h-4 w-4" /> Petición de eliminación</div>
                <h3 id="vendo-delete-request-title" className="mt-3 text-xl font-black text-slate-950">¿Por qué querés eliminar esta solicitud?</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">Administración revisará el pedido antes de borrar la solicitud definitivamente.</p>
              </div>
              <button type="button" onClick={closeDeletionRequest} disabled={Boolean(requestingDeletionId)} className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Cerrar"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-extrabold text-slate-900">{deletionTarget.first_name} {deletionTarget.last_name}</p>
                <p className="mt-1 text-xs text-slate-500">{deletionTarget.branch_name} · {deletionTarget.movement_type.toUpperCase()} · {dateFormatter.format(new Date(deletionTarget.created_at))}</p>
              </div>

              <div className="space-y-2">
                {VENDO_DELETION_REASONS.map((reason) => (
                  <label key={reason.code} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${deletionReason === reason.code ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="vendo-deletion-reason" value={reason.code} checked={deletionReason === reason.code} onChange={() => setDeletionReason(reason.code)} className="mt-0.5 h-4 w-4 accent-red-700" />
                    <span className="text-sm font-semibold text-slate-800">{reason.label}</span>
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Comentario adicional {deletionReason === 'other' ? <b className="text-red-600">*</b> : <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>}</span>
                <textarea value={deletionNote} onChange={(event) => setDeletionNote(event.target.value)} maxLength={500} rows={3} placeholder="Podés aclarar qué dato está mal o agregar contexto para Administración." className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100" />
                <span className="mt-1 block text-right text-[10px] text-slate-400">{deletionNote.length}/500</span>
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeDeletionRequest} disabled={Boolean(requestingDeletionId)} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-40">Cancelar</button>
              <button type="button" onClick={requestDeletion} disabled={!deletionReason || Boolean(requestingDeletionId) || (deletionReason === 'other' && !deletionNote.trim())} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-extrabold text-white hover:bg-red-800 disabled:bg-slate-300">
                {requestingDeletionId ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <MessageSquareWarning className="h-4 w-4" />}
                {requestingDeletionId ? 'Enviando petición…' : 'Enviar petición'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
