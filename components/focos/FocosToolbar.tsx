'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FocoTypeFilter = 'all' | 'foco' | 'critico' | 'promo' | 'capacitacion';
type FocoStatusFilter = 'all' | 'pending' | 'done';

export default function FocosToolbar({
  branches,
  selectedBranchId,
  onChangeBranchId,
  onlyActive,
  onToggleOnlyActive,

  typeFilter,
  onChangeTypeFilter,

  // A + C
  isVendedor,
  statusFilter,
  onChangeStatusFilter,
  kpis,
}: {
  branches: { id: number; name: string }[];
  selectedBranchId: number | null;
  onChangeBranchId: (id: number) => void;
  onlyActive: boolean;
  onToggleOnlyActive: () => void;

  typeFilter: FocoTypeFilter;
  onChangeTypeFilter: (v: FocoTypeFilter) => void;

  // A + C
  isVendedor: boolean;
  statusFilter: FocoStatusFilter;
  onChangeStatusFilter: (v: FocoStatusFilter) => void;
  kpis: { total: number; pending: number; done: number };
}) {
  return (
    <div className="space-y-3">
      {/* header */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Focos</h2>
            <Badge variant="secondary">Para hoy / semana</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Objetivos diarios y semanales, críticos y material comercial, todo ordenado.
          </p>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-3">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="mt-1 text-2xl font-semibold">{kpis.pending}</p>
          </div>
          <div className="rounded-2xl border bg-white p-3">
            <p className="text-xs text-muted-foreground">Cumplidos</p>
            <p className="mt-1 text-2xl font-semibold">{kpis.done}</p>
          </div>
          <div className="rounded-2xl border bg-white p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold">{kpis.total}</p>
          </div>
        </div>
      </div>

      {/* filtros */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <Select
            value={selectedBranchId ? String(selectedBranchId) : undefined}
            onValueChange={(v) => onChangeBranchId(Number(v))}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Seleccionar sucursal…" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => onChangeTypeFilter(v as FocoTypeFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="foco">Foco</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="promo">Promo</SelectItem>
              <SelectItem value="capacitacion">Capacitación</SelectItem>
            </SelectContent>
          </Select>

          {/* A: filtro por estado SOLO vendedor */}
          {isVendedor ? (
            <Select
              value={statusFilter}
              onValueChange={(v) => onChangeStatusFilter(v as FocoStatusFilter)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Estado…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="done">Cumplidos</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <Button variant={onlyActive ? 'default' : 'outline'} onClick={onToggleOnlyActive}>
          {onlyActive ? 'Mostrando activos' : 'Ver solo activos'}
        </Button>
      </div>
    </div>
  );
}
