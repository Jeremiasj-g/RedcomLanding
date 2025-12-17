'use client';

import React, { useMemo } from 'react';
import { CATEGORIAS, PLAN_MEJORA, type CategoriaKey, CATEGORIA_PILL } from '@/utils/categories';

type Props = {
    query: string;
    onQueryChange: (v: string) => void;

    categoria: CategoriaKey | 'ALL';
    onCategoriaChange: (v: CategoriaKey | 'ALL') => void;

    supervisor: string | 'ALL';
    onSupervisorChange: (v: string | 'ALL') => void;

    // viene desde la data ya fetcheada (API)
    supervisors: string[]; // únicos
};

export default function CategoriasFiltersBar({
    query,
    onQueryChange,
    categoria,
    onCategoriaChange,
    supervisor,
    onSupervisorChange,
    supervisors,
}: Props) {
    const categoriaPills = useMemo(() => {
        // Orden: Todas + Senior/Semi/Junior + Plan
        return [
            { key: 'ALL' as const, label: 'Todas' },
            ...CATEGORIAS.map((c) => ({ key: c.key, label: c.label })),
            { key: PLAN_MEJORA.key, label: PLAN_MEJORA.label },
        ];
    }, []);

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="flex items-center gap-6 flex-wrap">
                {/* <h2 className="text-2xl font-extrabold text-slate-900">Vendedores</h2> */}

                <div className="flex-1 min-w-[240px]">
                    <input
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder="Buscar vendedor..."
                        className="w-full max-w-[380px] rounded-xl border border-slate-400 bg-white px-4 py-2.5 text-sm
                       outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </div>
            </div>

            {/* Pills de categorías (como screenshot) */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-2">Categorías:</span>
                {categoriaPills.map((p) => {
                    const isActive = categoria === p.key;

                    // estilos por categoría si no es "ALL"
                    const style =
                        p.key === 'ALL'
                            ? {
                                active: 'bg-slate-900 text-white border-slate-900',
                                idle: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
                            }
                            : CATEGORIA_PILL[p.key as CategoriaKey];

                    return (
                        <button
                            key={p.key}
                            onClick={() => onCategoriaChange(p.key as any)}
                            className={[
                                'rounded-full border px-4 py-2 text-sm font-medium transition',
                                isActive ? style.active : style.idle,
                            ].join(' ')}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>

            {/* Pills de supervisores (dinámicas desde API) */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-2">Supervisor:</span>

                <button
                    onClick={() => onSupervisorChange('ALL')}
                    className={[
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        supervisor === 'ALL'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
                    ].join(' ')}
                >
                    Todos
                </button>

                {supervisors.map((s) => {
                    const active = supervisor === s;
                    return (
                        <button
                            key={s}
                            onClick={() => onSupervisorChange(s)}
                            className={[
                                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                active
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
                            ].join(' ')}
                            title={s}
                        >
                            {s}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
