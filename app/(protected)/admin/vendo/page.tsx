'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import DualSpinner from '@/components/ui/DualSpinner';
import { Checkbox } from '@/components/ui/checkbox';
import { buildVendoEmailSubject } from '@/lib/vendo/web3forms';
import type { VendoRequest, VendoRequestStatus } from '@/lib/vendo/types';

type MovementFilter = 'all' | 'alta' | 'baja';
type StatusFilter = 'all' | VendoRequestStatus;

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export default function AdminVendoPage() {
  const [requests, setRequests] = useState<VendoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4500);
  };

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('La sesión venció. Volvé a iniciar sesión.');
    return token;
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vendo_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) showToast('error', error.message);
    const next = (data ?? []) as VendoRequest[];
    setRequests(next);
    setSelectedIds((current) => {
      const existing = new Set(next.map((request) => request.id));
      return new Set([...current].filter((id) => existing.has(id)));
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('vendo_requests_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendo_requests' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const branches = useMemo(
    () => Array.from(new Set(requests.map((request) => request.branch_name))).sort((a, b) => a.localeCompare(b)),
    [requests],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesQuery = !normalized || [
        request.first_name,
        request.last_name,
        request.vendor_email,
        request.phone,
        request.imei,
        request.reason,
        request.requester_name,
        request.requester_email,
        request.branch_name,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalized));
      return matchesQuery
        && (movementFilter === 'all' || request.movement_type === movementFilter)
        && (statusFilter === 'all' || request.status === statusFilter)
        && (branchFilter === 'all' || request.branch_name === branchFilter);
    });
  }, [branchFilter, movementFilter, query, requests, statusFilter]);

  const filteredIds = useMemo(() => filtered.map((request) => request.id), [filtered]);
  const selectedCount = selectedIds.size;
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id)) && !allFilteredSelected;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const patchRequest = async (body: Record<string, unknown>) => {
    const token = await getAccessToken();
    const response = await fetch('/api/vendo/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? 'No se pudo actualizar la solicitud.');
    return payload.request as VendoRequest;
  };

  const reviewRequest = async (request: VendoRequest, status: 'accepted' | 'rejected') => {
    let note: string | null = null;
    if (status === 'rejected') {
      const result = window.prompt('Motivo del rechazo (opcional):', request.review_note ?? '');
      if (result === null) return;
      note = result.trim() || null;
    } else if (!window.confirm(`¿Aceptar la solicitud de ${request.first_name} ${request.last_name}?`)) {
      return;
    }

    setReviewingId(request.id);
    try {
      const updated = await patchRequest({ action: 'review', requestId: request.id, status, note });
      setRequests((current) => current.map((row) => row.id === updated.id ? updated : row));
      showToast('success', status === 'accepted' ? 'Solicitud aceptada.' : 'Solicitud rechazada.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'No se pudo resolver la solicitud.');
    } finally {
      setReviewingId(null);
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
    if (!window.confirm(`¿Eliminar definitivamente la solicitud de ${request.first_name} ${request.last_name}? Esta acción no se puede deshacer.`)) return;
    setDeletingId(request.id);
    try {
      const deletedIds = await deleteRequestIds([request.id]);
      const deletedSet = new Set(deletedIds);
      setRequests((current) => current.filter((row) => !deletedSet.has(row.id)));
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedSet.has(id))));
      showToast('success', 'Solicitud eliminada definitivamente.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'No se pudo eliminar la solicitud.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar definitivamente ${ids.length} solicitud${ids.length === 1 ? '' : 'es'}? Esta acción no se puede deshacer.`)) return;

    setBulkDeleting(true);
    try {
      const deletedIds = await deleteRequestIds(ids);
      const deletedSet = new Set(deletedIds);
      setRequests((current) => current.filter((row) => !deletedSet.has(row.id)));
      setSelectedIds(new Set());
      showToast('success', `${deletedIds.length} solicitud${deletedIds.length === 1 ? '' : 'es'} eliminada${deletedIds.length === 1 ? '' : 's'}.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'No se pudieron eliminar las solicitudes.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const replyToRequester = (request: VendoRequest) => {
    const subject = `Re: ${buildVendoEmailSubject({
      movementType: request.movement_type,
      firstName: request.first_name,
      lastName: request.last_name,
      branchName: request.branch_name,
    })}`;
    const state = request.status === 'accepted' ? 'ACEPTADA' : request.status === 'rejected' ? 'RECHAZADA' : 'PENDIENTE';
    const body = [
      `Hola ${request.requester_name},`,
      '',
      `Te escribimos por la solicitud de ${request.movement_type.toUpperCase()} del dispositivo de ${request.first_name} ${request.last_name}.`,
      `Sucursal: ${request.branch_name}`,
      `Estado actual: ${state}`,
      request.review_note ? `Observación: ${request.review_note}` : '',
      '',
      'Saludos.',
    ].filter(Boolean).join('\n');

    window.location.href = `mailto:${encodeURIComponent(request.requester_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const totals = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => request.status === 'pending').length,
    accepted: requests.filter((request) => request.status === 'accepted').length,
    rejected: requests.filter((request) => request.status === 'rejected').length,
  }), [requests]);

  if (loading) return <div className="grid min-h-[65vh] place-items-center"><DualSpinner size={60} thickness={4} /></div>;

  return (
    <div className="space-y-6">
      {toast && <div className={`fixed right-5 top-20 z-50 max-w-lg rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{toast.message}</div>}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-red-700">Solicitudes VENDO</div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Altas y bajas de dispositivos</h1>
          <p className="mt-2 text-sm text-slate-600">Revisá, aceptá o rechazá las solicitudes registradas. La gestión efectiva se realiza en VENDO.</p>
        </div>
        <button onClick={load} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Actualizar</button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Total solicitudes" value={totals.total} icon={<Smartphone className="h-5 w-5" />} className="border-slate-200 text-slate-900" />
        <Metric title="Pendientes" value={totals.pending} icon={<Clock3 className="h-5 w-5" />} className="border-amber-200 text-amber-700" />
        <Metric title="Aceptadas" value={totals.accepted} icon={<CheckCircle2 className="h-5 w-5" />} className="border-emerald-200 text-emerald-700" />
        <Metric title="Rechazadas" value={totals.rejected} icon={<XCircle className="h-5 w-5" />} className="border-red-200 text-red-700" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_160px_160px_180px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar vendedor, IMEI, teléfono, email o solicitante…" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500"><option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="accepted">Aceptadas</option><option value="rejected">Rechazadas</option></select>
            <select value={movementFilter} onChange={(event) => setMovementFilter(event.target.value as MovementFilter)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500"><option value="all">Alta y baja</option><option value="alta">Solo altas</option><option value="baja">Solo bajas</option></select>
            <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500"><option value="all">Todas las sucursales</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>
          </div>

          {selectedCount > 0 && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-700"><span className="font-extrabold">{selectedCount}</span> solicitud{selectedCount === 1 ? '' : 'es'} seleccionada{selectedCount === 1 ? '' : 's'}</div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setSelectedIds(new Set())} disabled={bulkDeleting} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Limpiar</button>
                <button type="button" onClick={deleteSelected} disabled={bulkDeleting} className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-700 bg-red-700 px-3 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50"><Trash2 className="h-4 w-4" /> {bulkDeleting ? 'Eliminando…' : 'Eliminar seleccionadas'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden xl:block">
          <table className="w-full table-fixed border-collapse text-left text-[11px]">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-white uppercase tracking-wide text-slate-500">
                <th className="px-2 py-3"><div className="flex justify-center"><Checkbox checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false} onCheckedChange={toggleAllFiltered} aria-label="Seleccionar solicitudes filtradas" /></div></th>
                <th className="px-3 py-3 font-bold">Estado / fecha</th>
                <th className="px-3 py-3 font-bold">Sucursal</th>
                <th className="px-3 py-3 font-bold">Vendedor</th>
                <th className="px-3 py-3 font-bold">Dispositivo</th>
                <th className="px-3 py-3 font-bold">Motivo</th>
                <th className="px-3 py-3 font-bold">Solicitante</th>
                <th className="px-3 py-3 text-right font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((request) => (
                <tr key={request.id} className={`${request.status === 'pending' ? 'bg-amber-50/35' : 'bg-white'} align-top hover:bg-slate-50`}>
                  <td className="px-2 py-4"><div className="flex justify-center"><Checkbox checked={selectedIds.has(request.id)} onCheckedChange={() => toggleSelected(request.id)} aria-label={`Seleccionar solicitud de ${request.first_name} ${request.last_name}`} /></div></td>
                  <td className="px-3 py-4"><StatusBadge request={request} /><p className="mt-2 leading-4 text-slate-500">{dateFormatter.format(new Date(request.created_at))}</p></td>
                  <td className="px-3 py-4"><div className="font-bold leading-4 text-slate-900">{request.branch_name}</div><span className={`mt-2 inline-flex rounded-md px-2 py-1 font-extrabold uppercase ${request.movement_type === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{request.movement_type}</span></td>
                  <td className="px-3 py-4"><div className="font-bold leading-4 text-slate-900">{request.first_name} {request.last_name}</div><div className="mt-1 break-words leading-4 text-slate-500">{request.vendor_email}</div></td>
                  <td className="px-3 py-4"><div className="break-all font-mono leading-4 text-slate-700">{request.imei}</div><div className="mt-2 leading-4 text-slate-500">{request.phone}</div></td>
                  <td className="px-3 py-4"><p className="line-clamp-4 break-words leading-4 text-slate-600" title={request.reason}>{request.reason}</p></td>
                  <td className="px-3 py-4"><div className="font-bold leading-4 text-slate-900">{request.requester_name}</div><div className="mt-1 break-words leading-4 text-slate-500">{request.requester_email}</div></td>
                  <td className="px-3 py-4"><div className="flex justify-end"><RequestActions request={request} reviewingId={reviewingId} deletingId={deletingId} onReply={replyToRequester} onReview={reviewRequest} onDelete={deleteRequest} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 xl:hidden">
          {filtered.map((request) => (
            <article key={request.id} className={`${request.status === 'pending' ? 'bg-amber-50/30' : 'bg-white'} p-4`}>
              <div className="flex items-start gap-3">
                <Checkbox checked={selectedIds.has(request.id)} onCheckedChange={() => toggleSelected(request.id)} aria-label={`Seleccionar solicitud de ${request.first_name} ${request.last_name}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge request={request} /><span className="text-xs text-slate-500">{dateFormatter.format(new Date(request.created_at))}</span></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InfoBlock label="Sucursal / movimiento"><div className="font-bold text-slate-900">{request.branch_name}</div><span className={`mt-1 inline-flex rounded-md px-2 py-1 text-[11px] font-extrabold uppercase ${request.movement_type === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{request.movement_type}</span></InfoBlock>
                    <InfoBlock label="Vendedor"><div className="font-bold text-slate-900">{request.first_name} {request.last_name}</div><div className="break-all text-xs text-slate-500">{request.vendor_email}</div></InfoBlock>
                    <InfoBlock label="Dispositivo"><div className="break-all font-mono text-xs text-slate-700">{request.imei}</div><div className="text-xs text-slate-500">{request.phone}</div></InfoBlock>
                    <InfoBlock label="Solicitante"><div className="font-bold text-slate-900">{request.requester_name}</div><div className="break-all text-xs text-slate-500">{request.requester_email}</div></InfoBlock>
                  </div>
                  <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Motivo</p><p className="mt-1 text-xs leading-5 text-slate-600">{request.reason}</p></div>
                  <div className="mt-3 flex justify-end"><RequestActions request={request} reviewingId={reviewingId} deletingId={deletingId} onReply={replyToRequester} onReview={reviewRequest} onDelete={deleteRequest} /></div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && <div className="px-6 py-14 text-center"><Smartphone className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-700">No hay solicitudes para los filtros seleccionados.</p></div>}
        <div className="border-t border-slate-200 bg-white px-5 py-3 text-xs font-medium text-slate-500">Mostrando <span className="font-bold text-slate-900">{filtered.length}</span> de <span className="font-bold text-slate-900">{requests.length}</span> solicitudes.</div>
      </section>
    </div>
  );
}

function RequestActions({
  request,
  reviewingId,
  deletingId,
  onReply,
  onReview,
  onDelete,
}: {
  request: VendoRequest;
  reviewingId: string | null;
  deletingId: string | null;
  onReply: (request: VendoRequest) => void;
  onReview: (request: VendoRequest, status: 'accepted' | 'rejected') => void;
  onDelete: (request: VendoRequest) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
      <ActionIconButton label="Responder al solicitante" onClick={() => onReply(request)} icon={<ReplyMailIcon className="h-4 w-4" />} />
      <ActionIconButton label="Aceptar solicitud" onClick={() => onReview(request, 'accepted')} disabled={reviewingId === request.id || request.status === 'accepted'} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      <ActionIconButton label="Rechazar solicitud" onClick={() => onReview(request, 'rejected')} disabled={reviewingId === request.id || request.status === 'rejected'} tone="danger" icon={<XCircle className="h-4 w-4" />} />
      <ActionIconButton label="Eliminar" onClick={() => onDelete(request)} disabled={deletingId === request.id} tone="danger" icon={deletingId === request.id ? <Spinner /> : <Trash2 className="h-4 w-4" />} />
    </div>
  );
}

function ReplyMailIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 17l-5-5 5-5" />
      <path d="M4 12h9a7 7 0 0 1 7 7v1" />
    </svg>
  );
}

function StatusBadge({ request }: { request: VendoRequest }) {
  if (request.status === 'accepted') return <div><span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Aceptada</span>{request.reviewed_at && <p className="mt-1 text-[10px] leading-4 text-slate-500">{dateFormatter.format(new Date(request.reviewed_at))}</p>}</div>;
  if (request.status === 'rejected') return <div><span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-bold text-red-700"><XCircle className="h-3.5 w-3.5" /> Rechazada</span>{request.review_note && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-red-700">{request.review_note}</p>}</div>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-700"><Clock3 className="h-3.5 w-3.5" /> Pendiente</span>;
}

function Metric({ title, value, icon, className }: { title: string; value: number; icon: ReactNode; className: string }) {
  return <div className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-2 text-3xl font-black">{value}</p></div><div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100">{icon}</div></div></div>;
}

function InfoBlock({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>{children}</div>;
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />;
}

function ActionIconButton({
  label,
  onClick,
  icon,
  disabled,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  disabled?: boolean;
  tone?: 'default' | 'success' | 'danger';
}) {
  const toneClass = tone === 'success'
    ? 'text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50'
    : tone === 'danger'
      ? 'text-red-700 hover:border-red-200 hover:bg-red-50'
      : 'text-slate-800 hover:border-slate-300 hover:bg-slate-50';

  return (
    <div className="group relative">
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={`grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white transition focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-35 ${toneClass}`}>
        {icon}
      </button>
      <div className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 scale-95 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100">{label}</div>
    </div>
  );
}
