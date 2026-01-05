'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Branch, FocoSeverity, FocoType } from './types';

export type Scope = 'today' | 'week' | 'history';
export type StatusFilter = 'all' | 'pending' | 'completed';

type Props = {
  branches: Branch[];
  branchId: string; // 'all' | number-as-string
  onBranchIdChange: (v: string) => void;

  scope: Scope;
  onScopeChange: (v: Scope) => void;

  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;

  severity: 'all' | FocoSeverity;
  onSeverityChange: (v: 'all' | FocoSeverity) => void;

  type: 'all' | FocoType;
  onTypeChange: (v: 'all' | FocoType) => void;

  query: string;
  onQueryChange: (v: string) => void;

  counters: { total: number; pending: number; completed: number };
};

export function FocosFilters(props: Props) {
  const {
    branches,
    branchId,
    onBranchIdChange,
    scope,
    onScopeChange,
    status,
    onStatusChange,
    severity,
    onSeverityChange,
    type,
    onTypeChange,
    query,
    onQueryChange,
    counters,
  } = props;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Focos</h2>
          <p className="text-sm text-muted-foreground">
            Objetivos del día/semana, críticos y material para vendedores (sin perderse en WhatsApp).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Total: {counters.total}</Badge>
          <Badge variant="outline">Pendientes: {counters.pending}</Badge>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            Cumplidos: {counters.completed}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por texto… (ej: PIPORINO, ÑOQUI, 50%…)"
          />
        </div>

        <div className="md:col-span-3">
          <Select value={branchId} onValueChange={onBranchIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas mis sucursales</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Select value={severity} onValueChange={(v) => onSeverityChange(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Severidad: todas</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Atención</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Select value={type} onValueChange={(v) => onTypeChange(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tipo: todos</SelectItem>
              <SelectItem value="foco">Foco</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="promo">Promo</SelectItem>
              <SelectItem value="capacitacion">Capacitación</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-1">
          <Select value={status} onValueChange={(v) => onStatusChange(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="completed">Cumplido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Tabs value={scope} onValueChange={(v) => onScopeChange(v as any)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="today">Hoy</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
