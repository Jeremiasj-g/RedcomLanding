'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { FocoSeverity, FocoType } from '@/components/focos/focos.panel.api';

export default function PanelFocosToolbar({
  q,
  onQ,
  onlyActive,
  onOnlyActive,
  severity,
  onSeverity,
  type,
  onType,
}: {
  q: string;
  onQ: (v: string) => void;

  onlyActive: boolean;
  onOnlyActive: (v: boolean) => void;

  severity: FocoSeverity | 'all';
  onSeverity: (v: FocoSeverity | 'all') => void;

  type: FocoType | 'all';
  onType: (v: FocoType | 'all') => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          Panel de focos
          <span className="text-xs font-semibold text-slate-500">• Supervisores / JDV / Admin</span>
        </div>

        <Button
          type="button"
          variant={onlyActive ? 'default' : 'outline'}
          onClick={() => onOnlyActive(!onlyActive)}
        >
          {onlyActive ? 'Mostrando activos' : 'Mostrando todos'}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => onQ(e.target.value)}
              placeholder="Buscar por título o contenido…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <Select value={type} onValueChange={(v) => onType(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="foco">Foco</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="promo">Promo</SelectItem>
              <SelectItem value="capacitacion">Capacitación</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="lg:col-span-3">
          <Select value={severity} onValueChange={(v) => onSeverity(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Atención</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
