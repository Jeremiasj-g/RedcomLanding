'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Users, UserCheck, UserX, Search, Filter,
  ChevronLeft, ChevronRight, Save, Building2, KeyRound
} from 'lucide-react';
import AdminChangePasswordModal from '@/components/AdminChangePasswordModal';
import { RequireAuth } from '@/components/RouteGuards';
import DualSpinner from '@/components/ui/DualSpinner';

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'supervisor' | 'vendedor';  // 👈 antes 'admin' | 'user'
  is_active: boolean;
  branches: string[];
  created_at?: string;            // opcional si extendiste la view
  last_sign_in_at?: string | null;// opcional si extendiste la view
  last_active?: string | null;
};

type ActiveFilter = 'all' | 'active' | 'inactive';

const ALL_BRANCHES = ['corrientes', 'chaco', 'misiones', 'obera', 'refrigerados'];

const BRANCH_COLORS: Record<string, string> = {
  corrientes: 'bg-blue-100 text-blue-700 border-blue-200',
  chaco: 'bg-purple-100 text-purple-700 border-purple-200',
  misiones: 'bg-green-100 text-green-700 border-green-200',
  obera: 'bg-orange-100 text-orange-700 border-orange-200',
  refrigerados: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

// helpers fechas (exacto + relativo)
const dtf = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function fromNow(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const sec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(sec);
  const unit =
    abs < 60 ? 'second' :
      abs < 3600 ? 'minute' :
        abs < 86400 ? 'hour' :
          abs < 2592000 ? 'day' :
            abs < 31536000 ? 'month' : 'year';
  const val =
    unit === 'second' ? sec :
      unit === 'minute' ? sec / 60 :
        unit === 'hour' ? sec / 3600 :
          unit === 'day' ? sec / 86400 :
            unit === 'month' ? sec / 2592000 : sec / 31536000;
  return rtf.format(Math.round(val), unit as Intl.RelativeTimeFormatUnit);
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Modal activar/desactivar
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<Row | null>(null);
  const [nextActive, setNextActive] = useState<boolean>(false);
  const [acting, setActing] = useState(false);

  // Modal cambiar contraseña
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState<string | null>(null);
  const [pwdUserEmail, setPwdUserEmail] = useState<string | undefined>(undefined);

  // Toast simple
  const [toast, setToast] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const showToast = (t: 'success' | 'error', msg: string) => {
    setToast({ type: t, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    setCurrentUserId(auth.user?.id ?? null);

    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) setError(error.message);

    // 👇 LOGS útiles
    console.log('admin_list_users count:', data?.length);
    console.log('admin_list_users emails:', data?.map((r: any) => r.email));
    console.log('admin_list_users full payload:', data);

    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isSelf = (u: Row) => u.id === currentUserId;
  const norm = (s: string) => s?.toLowerCase?.() ?? '';

  const toggleBranch = (u: Row, b: string) => {
    const has = u.branches.includes(b);
    const branches = has ? u.branches.filter(x => x !== b) : [...u.branches, b];
    setRows(prev => prev.map(r => r.id === u.id ? { ...r, branches } : r));
  };

  const saveRow = async (u: Row) => {
    setSaving(u.id);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? '';

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin_update_user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            user_id: u.id,
            full_name: u.full_name,
            role: u.role,          // 'admin' | 'supervisor' | 'vendedor'
            is_active: u.is_active,
            branches: u.branches,  // ['corrientes', 'refrigerados', ...]
          }),
        }
      );

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error ?? 'Error al guardar cambios');
      }

      await load();
      showToast('success', 'Cambios guardados');
    } catch (e: any) {
      console.error('admin_update_user error', e);
      showToast('error', e.message ?? 'Error al guardar cambios');
    } finally {
      setSaving(null);
    }
  };

  const openToggleModal = (u: Row) => {
    if (isSelf(u)) { showToast('error', 'No podés cambiar tu propio estado.'); return; }
    setTargetUser(u);
    setNextActive(!u.is_active);
    setConfirmOpen(true);
  };

  const confirmToggleActive = async () => {
    if (!targetUser) return;
    setActing(true);

    try {
      const desired = nextActive;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? '';

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin_update_user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            user_id: targetUser.id,
            full_name: targetUser.full_name,
            role: targetUser.role,
            is_active: desired,
            branches: targetUser.branches,
          }),
        }
      );

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error ?? 'Error al actualizar usuario');
      }

      setConfirmOpen(false);
      await load();
      showToast('success', desired ? 'Usuario activado' : 'Usuario desactivado');
    } catch (e: any) {
      console.error('admin_update_user toggle error', e);
      showToast('error', e.message ?? 'Error al actualizar usuario');
    } finally {
      setActing(false);
    }
  };

  // filtros
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chips = branchFilter.map(b => b.toLowerCase());
    return rows.filter(u => {
      const okText = !q || norm(u.full_name ?? '').includes(q) || norm(u.email).includes(q);
      const okBranches = chips.length === 0 || u.branches.some(b => chips.includes(b.toLowerCase()));
      const okActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && u.is_active) ||
        (activeFilter === 'inactive' && !u.is_active);
      return okText && okBranches && okActive;
    });
  }, [rows, query, branchFilter, activeFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(u => u.is_active).length;
    const inactive = total - active;
    const admins = rows.filter(u => u.role === 'admin').length;
    return { total, active, inactive, admins };
  }, [rows]);

  // paginación
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  const toggleBranchChip = (b: string) => {
    setPage(1);
    setBranchFilter(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };
  const clearFilters = () => { setBranchFilter([]); setQuery(''); setActiveFilter('active'); setPage(1); };

  if (loading) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  return (
    <RequireAuth roles={['admin']}>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Toast */}
        {toast && (
          <div className={`fixed right-4 top-4 z-[60] rounded-lg px-4 py-3 shadow-lg border ${toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
            }`}>
            {toast.msg}
          </div>
        )}

        {/* Modal activar/desactivar */}
        {confirmOpen && targetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => !acting && setConfirmOpen(false)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {nextActive ? 'Activar usuario' : 'Desactivar usuario'}
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                {nextActive
                  ? `¿Seguro que deseas activar a ${targetUser.email}?`
                  : `¿Seguro que deseas desactivar a ${targetUser.email}? El usuario no podrá iniciar sesión.`}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
                  onClick={() => setConfirmOpen(false)}
                  disabled={acting}
                >
                  Cancelar
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-white ${nextActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} ${acting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  onClick={confirmToggleActive}
                  disabled={acting}
                >
                  {acting ? 'Aplicando…' : (nextActive ? 'Activar' : 'Desactivar')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestión de Usuarios</h1>
            <p className="text-slate-600">Administra los usuarios y permisos del sistema</p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Usuarios</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-slate-100 rounded-full p-3"><Users className="w-6 h-6 text-slate-600" /></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Activos</p>
                  <p className="text-3xl font-bold text-green-700">{stats.active}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3"><UserCheck className="w-6 h-6 text-green-600" /></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 mb-1">Inactivos</p>
                  <p className="text-3xl font-bold text-red-700">{stats.inactive}</p>
                </div>
                <div className="bg-red-100 rounded-full p-3"><UserX className="w-6 h-6 text-red-600" /></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Administradores</p>
                  <p className="text-3xl font-bold text-blue-700">{stats.admins}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3"><Building2 className="w-6 h-6 text-blue-600" /></div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                      placeholder="Buscar por nombre o email..."
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      className="appearance-none pl-4 pr-10 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white cursor-pointer transition-all font-medium text-sm"
                      value={activeFilter}
                      onChange={(e) => { setActiveFilter(e.target.value as ActiveFilter); setPage(1); }}
                    >
                      <option value="active">Activos</option>
                      <option value="inactive">Inactivos</option>
                      <option value="all">Todos</option>
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  </div>

                  {(query || branchFilter.length > 0 || activeFilter !== 'active') && (
                    <button
                      className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors font-medium text-sm text-slate-700"
                      onClick={clearFilters}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Sucursales:</span>
                {ALL_BRANCHES.map(b => {
                  const active = branchFilter.includes(b);
                  const colorClass = BRANCH_COLORS[b] || 'bg-slate-100 text-slate-700 border-slate-200';
                  return (
                    <button
                      key={b}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all capitalize ${active ? colorClass + ' shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      onClick={() => toggleBranchChip(b)}
                      aria-pressed={active}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRID de tarjetas */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pageRows.map(u => {
                const disabled = isSelf(u);
                const toggleIcon = u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />;
                const toggleBg = u.is_active ? 'hover:bg-red-50 text-red-600' : 'hover:bg-emerald-50 text-emerald-600';
                return (
                  <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
                    {/* Header tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <input
                          className={`w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
                          value={u.full_name ?? ''}
                          onChange={(e) => !disabled && setRows(prev => prev.map(r => r.id === u.id ? { ...u, full_name: e.target.value } : r))}
                          placeholder="Nombre completo"
                          disabled={disabled}
                        />
                        <p className="mt-1 text-sm text-slate-600">{u.email}</p>
                      </div>

                      {/* Botonera icon-only */}
                      <div className="flex items-center gap-1">
                        <button
                          title="Guardar"
                          className={`p-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 ${disabled || saving === u.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => !disabled && saveRow(u)}
                          disabled={disabled || saving === u.id}
                        >
                          <Save className="w-4 h-4" />
                        </button>

                        <button
                          title="Cambiar contraseña"
                          className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                          onClick={() => { setPwdUserId(u.id); setPwdUserEmail(u.email); setPwdOpen(true); }}
                          disabled={false}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          title={u.is_active ? 'Desactivar' : 'Activar'}
                          className={`p-2 rounded-lg border border-slate-300 ${toggleBg}`}
                          onClick={() => !disabled && openToggleModal(u)}
                          disabled={disabled}
                        >
                          {toggleIcon}
                        </button>
                      </div>
                    </div>

                    {/* Role + Estado (solo visual) */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Rol</label>
                        <select
                          className={`mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : 'bg-white'}`}
                          value={u.role}
                          onChange={(e) => !disabled && setRows(prev => prev.map(r => r.id === u.id ? { ...u, role: e.target.value as Row['role'] } : r))}
                          disabled={disabled}
                        >
                          <option value="supervisor">Supervisor</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Estado</label>
                        <div className="mt-1 h-[42px] flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700">
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                    </div>

                    {/* Sucursales */}
                    <div className="mt-3">
                      <label className="text-xs text-slate-500">Sucursales</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ALL_BRANCHES.map(b => {
                          const on = u.branches.includes(b);
                          const colorClass = BRANCH_COLORS[b] || 'bg-slate-100 text-slate-700 border-slate-200';
                          return (
                            <button
                              key={b}
                              className={`px-3 py-1 rounded-lg border text-xs font-medium capitalize transition-all ${on ? colorClass : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                              onClick={() => !disabled && toggleBranch(u, b)}
                              disabled={disabled}
                              title={on ? `Quitar ${b}` : `Agregar ${b}`}
                            >
                              {b}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Fechas meta */}
                    {(u.created_at || u.last_sign_in_at) && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div title={u.created_at ? dtf.format(new Date(u.created_at)) : ''}>
                          <span className="font-semibold text-slate-600">Alta: </span>
                          {u.created_at ? fromNow(u.created_at) : '—'}
                        </div>
                        <div title={u.last_sign_in_at ? dtf.format(new Date(u.last_sign_in_at)) : ''}>
                          <span className="font-semibold text-slate-600">Último acceso: </span>
                          {u.last_sign_in_at ? fromNow(u.last_sign_in_at) : '—'}
                        </div>
                        <div title={(u.last_active ?? u.last_sign_in_at) ? dtf.format(new Date(u.last_active ?? u.last_sign_in_at!)) : ''}>
                          <span className="font-semibold text-slate-600">Última actividad: </span>
                          {(u.last_active ?? u.last_sign_in_at) ? fromNow(u.last_active ?? u.last_sign_in_at!) : '—'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {pageRows.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <Users className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-lg font-medium">No se encontraron usuarios</p>
                    <p className="text-sm text-slate-400 mt-1">Ajustá los filtros de búsqueda</p>
                  </div>
                </div>
              )}
            </div>

            {/* Paginación */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-700">
                  Mostrando <span className="font-semibold">{pageRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> a <span className="font-semibold">{Math.min(page * pageSize, total)}</span> de <span className="font-semibold">{total}</span> usuarios
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${page <= 1
                      ? 'bg-white text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-sm'
                      }`}
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-slate-700">
                    Página {page} de {pages}
                  </span>
                  <button
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${page >= pages
                      ? 'bg-white text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-sm'
                      }`}
                    disabled={page >= pages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal cambiar contraseña */}
            <AdminChangePasswordModal
              open={pwdOpen}
              onClose={() => setPwdOpen(false)}
              userId={pwdUserId}
              userEmail={pwdUserEmail}
              onChanged={() => { /* opcional: await load(); */ }}
            />
          </div>
        </div>
      </div>

    </RequireAuth>
  );
}
