'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Req = {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  requested_branches: string[];
  comment: string | null;
};

type Approver = { id: string; full_name: string | null; email: string };

const ALL_BRANCHES = ['corrientes', 'chaco', 'misiones', 'obera', 'refrigerados'];

export default function AdminSolicitudesPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);

  // modal aprobar
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Req | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  // 👇 ahora coincide con la BD
  const [role, setRole] =
    useState<'admin' | 'supervisor' | 'vendedor'>('vendedor');
  const [isActive, setIsActive] = useState(true);
  const [branches, setBranches] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [approvers, setApprovers] = useState<Record<string, Approver>>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const show = (t: 'ok' | 'err', msg: string) => {
    setToast({ type: t, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Modal rechazar
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const openReject = (r: Req) => {
    setRejectTarget(r);
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    const { error } = await supabase
      .from('signup_requests')
      .update({ status: 'rejected' })
      .eq('id', rejectTarget.id);

    setRejecting(false);
    setRejectOpen(false);

    if (error) {
      show('err', error.message);
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== rejectTarget.id));
    show('ok', 'Solicitud rechazada');
  };

  const load = async () => {
    setError(null);
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    setMyUserId(auth.user?.id ?? null);

    const { data, error } = await supabase
      .from('signup_requests')
      .select(
        'id,email,status,created_at,processed_at,processed_by,requested_branches,comment'
      )
      .order('created_at', { ascending: false });

    if (error) setError(error.message);

    const list = (data ?? []) as Req[];
    setRows(list);

    const ids = Array.from(
      new Set(list.map((r) => r.processed_by).filter(Boolean))
    ) as string[];

    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      const map: Record<string, Approver> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.id] = { id: p.id, full_name: p.full_name, email: p.email };
      });
      setApprovers(map);
    } else {
      setApprovers({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const okQ = !s || r.email.toLowerCase().includes(s);
      const okS = statusFilter === 'all' ? true : r.status === statusFilter;
      return okQ && okS;
    });
  }, [rows, q, statusFilter]);

  const toggleBranch = (b: string) => {
    setBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const openApprove = (r: Req) => {
    setTarget(r);
    setFullName('');
    setPassword('');
    setRole('vendedor'); // 👈 default para solicitudes nuevas
    setIsActive(true);
    setBranches((r.requested_branches ?? []).map((b) => b.toLowerCase()));
    setOpen(true);
  };

  const approve = async () => {
    if (!target) return;
    if (password.length < 8) {
      show('err', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (branches.length === 0) {
      show('err', 'Seleccioná al menos una sucursal');
      return;
    }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? '';

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin_create_user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            email: target.email,
            password,
            full_name: fullName || target.email.split('@')[0],
            branches,
            role, // 'admin' | 'supervisor' | 'vendedor'
            is_active: isActive,
          }),
        }
      );

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error ?? 'No se pudo crear el usuario');
      }

      const { error } = await supabase
        .from('signup_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: myUserId,
        })
        .eq('id', target.id);

      setSaving(false);
      setOpen(false);

      if (error) {
        show('err', error.message);
        return;
      }

      show('ok', 'Usuario creado y solicitud aprobada');
      await load();
    } catch (e: any) {
      console.error('admin_create_user desde solicitudes', e);
      setSaving(false);
      show('err', e.message ?? 'No se pudo crear el usuario');
    }
  };

  const reject = async (r: Req) => {
    if (!confirm(`Rechazar la solicitud de ${r.email}?`)) return;
    const { error } = await supabase
      .from('signup_requests')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: myUserId,
      })
      .eq('id', r.id);
    if (error) {
      show('err', error.message);
      return;
    }
    show('ok', 'Solicitud rechazada');
    await load();
  };

  const badge = (status: Req['status']) => {
    const m: Record<Req['status'], string> = {
      pending: 'bg-amber-50 text-amber-700 border border-amber-200',
      approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border border-red-200',
    };
    const label: Record<Req['status'], string> = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${m[status]}`}>
        {label[status]}
      </span>
    );
  };

  if (loading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      </div>
    );

  const reopen = async (r: Req) => {
    const { error } = await supabase.rpc('admin_reopen_signup', { p_id: r.id });
    if (error) {
      show('err', error.message);
      return;
    }
    show('ok', 'Solicitud reabierta');
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto py-6">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-2 shadow ${
            toast.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de acceso</h1>
          <p className="text-slate-600">
            Aprobá o rechazá solicitudes y revisá el historial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-2 text-sm border ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s === 'pending'
                ? 'Pendientes'
                : s === 'approved'
                ? 'Aprobadas'
                : s === 'rejected'
                ? 'Rechazadas'
                : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="mb-4 flex items-center gap-2">
        <input
          className="w-80 rounded-xl border px-3 py-2"
          placeholder="Buscar por email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((r) => {
          const approver = r.processed_by ? approvers[r.processed_by] : undefined;
          return (
            <div
              key={r.id}
              className="rounded-xl border p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-slate-900 truncate">
                    {r.email}
                  </div>
                  {badge(r.status)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Enviada: {new Date(r.created_at).toLocaleString()}
                  {r.processed_at && (
                    <>
                      {' • '}Procesada: {new Date(r.processed_at).toLocaleString()}
                      {approver && (
                        <>
                          {' • '}por{' '}
                          {approver.full_name
                            ? `${approver.full_name} (${approver.email})`
                            : approver.email}
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Sucursales solicitadas */}
                {r.requested_branches?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.requested_branches.map((b) => (
                      <span
                        key={b}
                        className="rounded-full border px-2.5 py-0.5 text-xs bg-slate-50 text-slate-700"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {/* Comentario */}
                {r.comment && (
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="text-slate-500 text-xs uppercase tracking-wide">
                      Comentario:{' '}
                    </span>
                    {r.comment}
                  </p>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {r.status === 'pending' && (
                  <>
                    <button
                      className="rounded-lg border px-3 py-2 hover:bg-slate-50"
                      onClick={() => openApprove(r)}
                    >
                      Aprobar
                    </button>
                    <button
                      className="rounded-lg border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50"
                      onClick={() => openReject(r)}
                    >
                      Rechazar
                    </button>
                  </>
                )}

                {r.status === 'rejected' && (
                  <button
                    className="rounded-lg border px-3 py-2 hover:bg-slate-50"
                    onClick={() => reopen(r)}
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border p-10 text-center text-slate-500 bg-white">
            No hay solicitudes.
          </div>
        )}
      </div>

      {/* Modal aprobar */}
      {open && target && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !saving && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Aprobar solicitud</h3>
            <p className="text-sm text-slate-600">
              Se creará el usuario para <b>{target.email}</b>.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-600">Nombre completo</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">
                  Contraseña (min 8)
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl border px-3 py-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs text-slate-600">Rol</label>
                  <select
                    className="ml-2 rounded-lg border px-2 py-1"
                    value={role}
                    onChange={(e) =>
                      setRole(
                        e.target.value as 'admin' | 'supervisor' | 'vendedor'
                      )
                    }
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Activo
                </label>
              </div>
              <div>
                <div className="mb-2 text-xs text-slate-600">Sucursales</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_BRANCHES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBranch(b)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        branches.includes(b)
                          ? 'bg-emerald-100 border-emerald-300'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border px-4 py-2 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-white ${
                  saving ? 'opacity-60' : 'bg-slate-900 hover:bg-slate-800'
                }`}
                onClick={approve}
                disabled={saving}
              >
                {saving ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rechazar */}
      {rejectOpen && rejectTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !rejecting && setRejectOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-red-700">
                {/* ícono X simple */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 1 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900">
                  Rechazar solicitud
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  ¿Estás seguro de rechazar la solicitud de{' '}
                  <b>{rejectTarget.email}</b>?<br />
                  Podrás reabrirla más adelante desde el historial.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                onClick={() => setRejectOpen(false)}
                disabled={rejecting}
              >
                Cancelar
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-white ${
                  rejecting ? 'opacity-60' : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={confirmReject}
                disabled={rejecting}
              >
                {rejecting ? 'Rechazando…' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
