'use client';

import * as React from 'react';
import { useMe } from '@/hooks/useMe';
import { RequireAuth } from '@/components/RouteGuards';

import FocosToolbar from '@/components/focos/FocosToolbar';
import FocoCard from '@/components/focos/FocoCard';

import {
  getFocosForMe,
  getMyBranches,
  getMyFocoCompletions,
  markFocoCompleted,
  unmarkFocoCompleted,
} from '@/components/focos/focos.api';

type FocoTypeFilter = 'all' | 'foco' | 'critico' | 'promo' | 'capacitacion';
type FocoStatusFilter = 'all' | 'pending' | 'done';

export default function FocosFeed() {
  const { me } = useMe();

  const [branches, setBranches] = React.useState<{ id: number; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<number | null>(null);

  const [onlyActive, setOnlyActive] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState<FocoTypeFilter>('all');
  const [statusFilter, setStatusFilter] = React.useState<FocoStatusFilter>('all');

  const [focos, setFocos] = React.useState<any[]>([]);
  const [completedSet, setCompletedSet] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [busyId, setBusyId] = React.useState<string | null>(null);

  const isVendedor = me?.role === 'vendedor';

  const load = React.useCallback(async () => {
    if (!me?.id) return;

    setLoading(true);
    setErr(null);

    try {
      const [brs, fs] = await Promise.all([getMyBranches(me.id), getFocosForMe({ onlyActive })]);

      setBranches(brs);
      setSelectedBranchId((prev) => prev ?? brs?.[0]?.id ?? null);

      setFocos(fs);

      // completions (solo si hay focos)
      const focoIds = (fs ?? []).map((f: any) => f.id);
      if (focoIds.length > 0) {
        const mySet = await getMyFocoCompletions(me.id, focoIds);
        setCompletedSet(mySet);
      } else {
        setCompletedSet(new Set());
      }
    } catch (e: any) {
      console.error('[FOCOS] load error', e);
      setErr(e?.message ?? 'No se pudieron cargar los focos.');
    } finally {
      setLoading(false);
    }
  }, [me?.id, onlyActive]);

  React.useEffect(() => {
    load();
  }, [load]);

  // KPIs (si no es vendedor, pending/done = 0 por diseño)
  const kpis = React.useMemo(() => {
    const total = focos.length;

    if (!isVendedor) return { total, pending: 0, done: 0 };

    let done = 0;
    for (const f of focos) {
      if (completedSet.has(f.id)) done++;
    }
    const pending = Math.max(0, total - done);

    return { total, pending, done };
  }, [focos, completedSet, isVendedor]);

  const filteredFocos = React.useMemo(() => {
    let arr = focos;

    if (typeFilter !== 'all') {
      arr = arr.filter((f: any) => f.type === typeFilter);
    }

    if (isVendedor && statusFilter !== 'all') {
      arr =
        statusFilter === 'done'
          ? arr.filter((f: any) => completedSet.has(f.id))
          : arr.filter((f: any) => !completedSet.has(f.id));
    }

    return arr;
  }, [focos, typeFilter, isVendedor, statusFilter, completedSet]);

  async function toggleCompleted(focoId: string) {
    if (!me?.id) return;

    setBusyId(focoId);
    try {
      const isCompleted = completedSet.has(focoId);

      if (!isCompleted) {
        await markFocoCompleted({
          focoId,
          userId: me.id,
          branchId: selectedBranchId ?? null,
        });

        setCompletedSet((prev) => {
          const n = new Set(prev);
          n.add(focoId);
          return n;
        });
      } else {
        await unmarkFocoCompleted({ focoId });

        setCompletedSet((prev) => {
          const n = new Set(prev);
          n.delete(focoId);
          return n;
        });
      }
    } catch (e) {
      console.error('[FOCOS] toggleCompleted error', e);
      alert('No se pudo actualizar el estado. Revisá consola.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequireAuth>
      <div className="space-y-4">
        <FocosToolbar
          branches={branches}
          selectedBranchId={selectedBranchId}
          onChangeBranchId={setSelectedBranchId}
          onlyActive={onlyActive}
          onToggleOnlyActive={() => setOnlyActive((v) => !v)}
          typeFilter={typeFilter}
          onChangeTypeFilter={setTypeFilter}
          isVendedor={!!isVendedor}
          statusFilter={statusFilter}
          onChangeStatusFilter={setStatusFilter}
          kpis={kpis}
        />

        {err ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-extrabold text-slate-900">No se pudieron cargar los focos.</p>
            <p className="text-sm text-slate-600">
              Revisá consola y confirmá que las views/permisos estén bien.
            </p>
            <p className="mt-2 text-xs text-slate-500">{err}</p>
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Cargando focos…
          </div>
        ) : filteredFocos.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No hay focos para mostrar con el filtro actual.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredFocos.map((f: any) => (
              <FocoCard
                key={f.id}
                foco={f}
                completed={isVendedor ? completedSet.has(f.id) : false}
                busy={busyId === f.id}
                showCheck={!!isVendedor}
                onToggleCompleted={() => toggleCompleted(f.id)}
              />
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
