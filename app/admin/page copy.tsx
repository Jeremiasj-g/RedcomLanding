'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  branches: string[];
};

type ActiveFilter = 'all' | 'active' | 'inactive';

const ALL_BRANCHES = ['corrientes', 'chaco', 'misiones', 'obera', 'refrigerados'];

/** Normaliza SIEMPRE las sucursales: lowercase + sin duplicados + ordenadas */
const normalizeBranches = (arr: string[] | null | undefined) =>
  Array.from(new Set((arr ?? []).map(b => String(b).toLowerCase()))).sort();

const normalizeRow = (r: Row): Row => ({
  ...r,
  branches: normalizeBranches(r.branches),
});

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Filtros y paginación
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active'); // por defecto: Activos
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    setCurrentUserId(auth.user?.id ?? null);

    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) setError(error.message);

    const normalized = (data ?? []).map(normalizeRow) as Row[];
    setRows(normalized);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Helpers
  const isSelf = (u: Row) => u.id === currentUserId;
  const norm = (s: string) => s?.toLowerCase?.() ?? '';

  // Toggle robusto (lowercase + dedupe + orden)
  const toggleBranch = (u: Row, b: string) => {
    const B = b.toLowerCase();
    setRows(prev =>
      prev.map(r => {
        if (r.id !== u.id) return r;
        const set = new Set(normalizeBranches(r.branches));
        if (set.has(B)) set.delete(B);
        else set.add(B);
        return { ...r, branches: Array.from(set).sort() };
      })
    );
  };

  // Guardar usando fila fresca + refetch final
  const saveRow = async (u: Row) => {
    setSaving(u.id);
    setError(null);

    // Tomamos la versión MÁS FRESCA del estado y la normalizamos
    const fresh = normalizeRow(rows.find(r => r.id === u.id) ?? u);

    const { error: e1 } = await supabase.rpc('admin_upsert_profile', {
      p_user_id: fresh.id,
      p_full_name: fresh.full_name,
      p_role: fresh.role,
      p_is_active: fresh.is_active,
    });
    if (e1) {
      setError(e1.message);
      setSaving(null);
      return;
    }

    const { error: e2 } = await supabase.rpc('admin_set_user_branches', {
      p_user_id: fresh.id,
      p_branches: fresh.branches, // ya vienen normalizadas
    });
    if (e2) {
      setError(e2.message);
      setSaving(null);
      return;
    }

    // Sincronizamos UI con BD para evitar estado viejo
    await load();
    setSaving(null);
  };

  const deleteUser = async (u: Row) => {
    if (isSelf(u)) {
      alert('No podés eliminar tu propio usuario.');
      return;
    }
    if (!confirm(`Eliminar ${u.email}?`)) return;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin_delete_user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ user_id: u.id }),
      }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Error: ${j.error ?? res.statusText}`);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== u.id));
  };

  // --- Filtros + búsqueda ---
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chips = branchFilter.map(b => b.toLowerCase());

    return rows.filter(u => {
      // texto
      const okText =
        !q || norm(u.full_name ?? '').includes(q) || norm(u.email).includes(q);

      // sucursales (alguna coincide)
      const userBranches = normalizeBranches(u.branches);
      const okBranches =
        chips.length === 0 || userBranches.some(b => chips.includes(b));

      // activo / inactivo
      const okActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && u.is_active) ||
        (activeFilter === 'inactive' && !u.is_active);

      return okText && okBranches && okActive;
    });
  }, [rows, query, branchFilter, activeFilter]);

  // --- Paginación ---
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > pages) setPage(1);
  }, [pages, page]);

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  // UI filtros
  const toggleBranchChip = (b: string) => {
    setPage(1);
    setBranchFilter(prev => (prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]));
  };
  const clearFilters = () => {
    setBranchFilter([]);
    setQuery('');
    setActiveFilter('active');
    setPage(1);
  };

  if (loading) return <div>Cargando…</div>;

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Usuarios</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Filtros: buscador + sucursales + estado */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <input
            className="w-72 rounded-xl border px-3 py-2"
            placeholder="Buscar por nombre o email…"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar usuarios"
          />
          {(query || branchFilter.length > 0 || activeFilter !== 'active') && (
            <button
              className="rounded-xl border px-3 py-2 hover:bg-gray-50"
              onClick={clearFilters}
              aria-label="Limpiar filtros"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Filtrar por sucursal:</span>
          {ALL_BRANCHES.map(b => {
            const active = branchFilter.includes(b);
            return (
              <button
                key={b}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active ? 'bg-emerald-100 border-emerald-300' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleBranchChip(b)}
                aria-pressed={active}
              >
                {b}
              </button>
            );
          })}

          <div className="ml-3 flex items-center gap-2">
            <span className="text-sm text-gray-600">Estado:</span>
            <select
              className="rounded-xl border px-3 py-2"
              value={activeFilter}
              onChange={e => {
                setActiveFilter(e.target.value as ActiveFilter);
                setPage(1);
              }}
              aria-label="Filtrar por estado"
            >
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2">Sucursales</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(u => {
              const disabled = isSelf(u);
              const uBranches = normalizeBranches(u.branches); // asegurar lowercase aquí también
              return (
                <tr
                  key={`${u.id}|${uBranches.join(',')}|${u.role}|${u.is_active ? 1 : 0}`}
                  className="border-t"
                >
                  <td className="px-3 py-2">
                    <input
                      className={`w-48 rounded-lg border px-2 py-1 ${
                        disabled ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                      value={u.full_name ?? ''}
                      onChange={e =>
                        !disabled &&
                        setRows(prev =>
                          prev.map(r => (r.id === u.id ? { ...u, full_name: e.target.value } : r))
                        )
                      }
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      className={`rounded-lg border px-2 py-1 ${
                        disabled ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                      value={u.role}
                      onChange={e =>
                        !disabled &&
                        setRows(prev =>
                          prev.map(r => (r.id === u.id ? { ...u, role: e.target.value as any } : r))
                        )
                      }
                      disabled={disabled}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className={`${disabled ? 'cursor-not-allowed' : ''}`}
                      checked={u.is_active}
                      onChange={e =>
                        !disabled &&
                        setRows(prev =>
                          prev.map(r =>
                            r.id === u.id ? { ...u, is_active: e.target.checked } : r
                          )
                        )
                      }
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {ALL_BRANCHES.map(b => (
                        <button
                          key={b}
                          className={`rounded-full border px-3 py-1 ${
                            uBranches.includes(b) ? 'bg-emerald-100 border-emerald-300' : 'hover:bg-gray-50'
                          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                          onClick={() => !disabled && toggleBranch(u, b)}
                          disabled={disabled}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className={`rounded-xl border px-3 py-1 hover:bg-gray-50 ${
                          disabled ? 'cursor-not-allowed opacity-60' : ''
                        }`}
                        onClick={() => !disabled && saveRow(u)}
                        disabled={disabled || saving === u.id}
                      >
                        {saving === u.id ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button
                        className={`rounded-xl border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50 ${
                          disabled ? 'cursor-not-allowed opacity-60' : ''
                        }`}
                        onClick={() => !disabled && deleteUser(u)}
                        disabled={disabled}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                  Sin usuarios
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="flex items-center justify-between px-3 py-3 text-sm">
          <span>
            {total} usuario{total !== 1 ? 's' : ''} · página {page}/{pages}
            {(branchFilter.length > 0 || activeFilter !== 'active' || query) && (
              <span className="ml-2 text-gray-500">
                {[
                  query && `“${query}”`,
                  branchFilter.length > 0 && `suc: ${branchFilter.join(', ')}`,
                  activeFilter !== 'active' && `estado: ${activeFilter}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-1 hover:bg-gray-50"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </button>
            <button
              className="rounded-xl border px-3 py-1 hover:bg-gray-50"
              disabled={page >= pages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
