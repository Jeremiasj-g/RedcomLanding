'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Clock3,
  Mail,
  MailCheck,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/auth/AuthProvider';
import DualSpinner from '@/components/ui/DualSpinner';
import type { VendoRequest } from '@/lib/vendo/types';

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

type MovementFilter = 'all' | 'alta' | 'baja';
type StatusFilter = 'all' | 'pending' | 'seen';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export default function AdminVendoPage() {
  const { me } = useAuth();
  const [requests, setRequests] = useState<VendoRequest[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [savedRecipientIds, setSavedRecipientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [markingSeen, setMarkingSeen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [recipientsOpen, setRecipientsOpen] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [requestResult, usersResult, recipientsResult] = await Promise.all([
      supabase.from('vendo_requests').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_users'),
      supabase.from('vendo_notification_recipients').select('user_id').eq('is_active', true),
    ]);

    if (requestResult.error) showToast('error', requestResult.error.message);
    if (usersResult.error) showToast('error', `No se pudieron cargar los usuarios: ${usersResult.error.message}`);
    if (recipientsResult.error) showToast('error', `No se pudieron cargar los destinatarios: ${recipientsResult.error.message}`);

    setRequests((requestResult.data ?? []) as VendoRequest[]);
    setUsers(((usersResult.data ?? []) as AdminUser[]).filter((user) => user.is_active && Boolean(user.email)));
    const ids = (recipientsResult.data ?? []).map((row: any) => String(row.user_id));
    setRecipientIds(ids);
    setSavedRecipientIds(ids);
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
      const matchesMovement = movementFilter === 'all' || request.movement_type === movementFilter;
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesBranch = branchFilter === 'all' || request.branch_name === branchFilter;
      return matchesQuery && matchesMovement && matchesStatus && matchesBranch;
    });
  }, [branchFilter, movementFilter, query, requests, statusFilter]);

  const visibleUsers = useMemo(() => {
    const normalized = userQuery.trim().toLowerCase();
    return users.filter((user) => !normalized || `${user.full_name ?? ''} ${user.email} ${user.role}`.toLowerCase().includes(normalized));
  }, [userQuery, users]);

  const recipientsChanged = useMemo(() => {
    const current = [...recipientIds].sort().join('|');
    const saved = [...savedRecipientIds].sort().join('|');
    return current !== saved;
  }, [recipientIds, savedRecipientIds]);

  const toggleRecipient = (id: string) => {
    setRecipientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const saveRecipients = async () => {
    if (!me?.id) return;
    setSavingRecipients(true);
    const added = recipientIds.filter((id) => !savedRecipientIds.includes(id));
    const removed = savedRecipientIds.filter((id) => !recipientIds.includes(id));

    if (removed.length > 0) {
      const { error } = await supabase.from('vendo_notification_recipients').delete().in('user_id', removed);
      if (error) {
        showToast('error', error.message);
        setSavingRecipients(false);
        return;
      }
    }

    if (added.length > 0) {
      const { error } = await supabase.from('vendo_notification_recipients').upsert(
        added.map((userId) => ({ user_id: userId, is_active: true, configured_by: me.id })),
        { onConflict: 'user_id' },
      );
      if (error) {
        showToast('error', error.message);
        setSavingRecipients(false);
        return;
      }
    }

    setSavedRecipientIds(recipientIds);
    setSavingRecipients(false);
    showToast('success', 'Destinatarios de VENDO actualizados.');
  };

  const markSeen = async (request: VendoRequest) => {
    if (!me?.id || request.status === 'seen') return;
    setMarkingSeen(request.id);
    const seenAt = new Date().toISOString();
    const { error } = await supabase
      .from('vendo_requests')
      .update({ status: 'seen', seen_at: seenAt, seen_by: me.id })
      .eq('id', request.id);

    if (error) {
      showToast('error', error.message);
    } else {
      setRequests((current) => current.map((row) => row.id === request.id ? { ...row, status: 'seen', seen_at: seenAt, seen_by: me.id } : row));
      showToast('success', 'Solicitud marcada como vista.');
    }
    setMarkingSeen(null);
  };

  const totals = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => request.status === 'pending').length,
    seen: requests.filter((request) => request.status === 'seen').length,
    emailErrors: requests.filter((request) => request.email_status === 'failed' || request.email_status === 'no_recipients').length,
  }), [requests]);

  if (loading) {
    return <div className="grid min-h-[65vh] place-items-center"><DualSpinner size={60} thickness={4} /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed right-5 top-20 z-50 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {toast.message}
        </div>
      )}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-red-700">
            <Smartphone className="h-3.5 w-3.5" /> Solicitudes VENDO
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Altas y bajas de dispositivos</h1>
          <p className="mt-2 text-sm text-slate-600">Visualizá las solicitudes registradas. La gestión efectiva se realiza en el sistema VENDO.</p>
        </div>
        <button onClick={load} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Total solicitudes" value={totals.total} icon={<Smartphone className="h-5 w-5" />} className="border-slate-200 text-slate-900" />
        <Metric title="Pendientes" value={totals.pending} icon={<Clock3 className="h-5 w-5" />} className="border-amber-200 text-amber-700" />
        <Metric title="Vistas" value={totals.seen} icon={<BadgeCheck className="h-5 w-5" />} className="border-emerald-200 text-emerald-700" />
        <Metric title="Alertas de correo" value={totals.emailErrors} icon={<XCircle className="h-5 w-5" />} className="border-red-200 text-red-700" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setRecipientsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white"><Settings2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-extrabold text-slate-950">Destinatarios de correo</h2>
              <p className="text-sm text-slate-500">{recipientIds.length} usuario{recipientIds.length === 1 ? '' : 's'} recibirá{recipientIds.length === 1 ? '' : 'n'} cada nueva solicitud.</p>
            </div>
          </div>
          <span className="text-sm font-bold text-slate-500">{recipientsOpen ? 'Ocultar' : 'Configurar'}</span>
        </button>

        {recipientsOpen && (
          <div className="border-t border-slate-200 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative max-w-lg flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Buscar usuario por nombre, email o rol…" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" />
              </div>
              <button
                type="button"
                onClick={saveRecipients}
                disabled={!recipientsChanged || savingRecipients}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {savingRecipients ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Save className="h-4 w-4" />}
                Guardar destinatarios
              </button>
            </div>

            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {visibleUsers.map((user) => {
                const selected = recipientIds.includes(user.id);
                return (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => toggleRecipient(user.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${selected ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{user.full_name || user.email}</span>
                      <span className="block truncate text-xs text-slate-500">{user.email} · {user.role}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_180px_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar vendedor, IMEI, teléfono, email o solicitante…" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500">
              <option value="pending">Pendientes</option>
              <option value="seen">Vistas</option>
              <option value="all">Todos los estados</option>
            </select>
            <select value={movementFilter} onChange={(event) => setMovementFilter(event.target.value as MovementFilter)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500">
              <option value="all">Alta y baja</option>
              <option value="alta">Solo altas</option>
              <option value="baja">Solo bajas</option>
            </select>
            <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-red-500">
              <option value="all">Todas las sucursales</option>
              {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Sucursal</th>
                <th className="px-4 py-3 font-bold">Movimiento</th>
                <th className="px-4 py-3 font-bold">Vendedor</th>
                <th className="px-4 py-3 font-bold">IMEI / código</th>
                <th className="px-4 py-3 font-bold">Teléfono</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Motivo</th>
                <th className="px-4 py-3 font-bold">Solicitante</th>
                <th className="px-4 py-3 font-bold">Notificación</th>
                <th className="px-4 py-3 font-bold">Revisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((request) => (
                <tr key={request.id} className={`${request.status === 'pending' ? 'bg-amber-50/35' : 'bg-white'} align-top hover:bg-slate-50`}>
                  <td className="px-4 py-4">
                    {request.status === 'seen' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Vista</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-700"><Clock3 className="h-3.5 w-3.5" /> Pendiente</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-600">{dateFormatter.format(new Date(request.created_at))}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{request.branch_name}</td>
                  <td className="px-4 py-4"><span className={`rounded-md px-2 py-1 font-extrabold uppercase ${request.movement_type === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{request.movement_type}</span></td>
                  <td className="px-4 py-4"><div className="font-bold text-slate-900">{request.first_name} {request.last_name}</div></td>
                  <td className="max-w-[180px] break-all px-4 py-4 font-mono text-slate-700">{request.imei}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-700">{request.phone}</td>
                  <td className="max-w-[220px] break-all px-4 py-4 text-slate-700">{request.vendor_email}</td>
                  <td className="max-w-[280px] px-4 py-4 leading-5 text-slate-600" title={request.reason}>{request.reason}</td>
                  <td className="max-w-[230px] px-4 py-4"><div className="font-bold text-slate-900">{request.requester_name}</div><div className="mt-1 break-all text-slate-500">{request.requester_email}</div></td>
                  <td className="px-4 py-4">
                    {request.email_status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><MailCheck className="h-4 w-4" /> Enviado</span>
                    ) : request.email_status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-amber-700"><Mail className="h-4 w-4" /> Pendiente</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700" title={request.email_error ?? undefined}><XCircle className="h-4 w-4" /> {request.email_status === 'no_recipients' ? 'Sin destinatarios' : 'Error'}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {request.status === 'pending' ? (
                      <button
                        onClick={() => markSeen(request)}
                        disabled={markingSeen === request.id}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {markingSeen === request.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : <BadgeCheck className="h-4 w-4" />}
                        Marcar como vista
                      </button>
                    ) : (
                      <span className="whitespace-nowrap text-slate-500">{request.seen_at ? dateFormatter.format(new Date(request.seen_at)) : 'Vista'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-6 py-14 text-center">
            <Smartphone className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-bold text-slate-700">No hay solicitudes para los filtros seleccionados.</p>
          </div>
        )}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500">Mostrando {filtered.length} de {requests.length} solicitudes.</div>
      </section>
    </div>
  );
}

function Metric({ title, value, icon, className }: { title: string; value: number; icon: React.ReactNode; className: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-2 text-3xl font-black">{value}</p></div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100">{icon}</div>
      </div>
    </div>
  );
}
