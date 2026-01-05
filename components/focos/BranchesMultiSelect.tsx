'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { MultiSelectCommand } from '@/components/focos/MultiSelectCommand';

export type Branch = { id: number; name: string };

export default function BranchesMultiSelect({
  branches,
  valueIds,
  onChangeIds,
  loading,
  labelWhenEmpty = 'Seleccionar sucursales…',
}: {
  branches: Branch[];
  valueIds: number[];
  onChangeIds: (ids: number[]) => void;
  loading?: boolean;
  labelWhenEmpty?: string;
}) {
  const options = React.useMemo(
    () =>
      branches.map((b) => ({
        key: b.id,
        value: String(b.id),
        title: b.name,
        subtitle: b.name.toLowerCase(),
      })),
    [branches]
  );

  const value = React.useMemo(() => valueIds.map(String), [valueIds]);

  function handleChange(next: string[]) {
    onChangeIds(next.map((x) => Number(x)));
  }

  const selectedLabels = React.useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return valueIds.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [branches, valueIds]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Sucursales destino</label>

      <MultiSelectCommand
        loading={loading}
        labelWhenEmpty={labelWhenEmpty}
        options={options}
        value={value}
        onChange={handleChange}
        placeholder="Buscar sucursal…"
      />

      <div className="flex flex-wrap gap-2">
        {selectedLabels.length === 0 ? (
          <span className="text-xs text-muted-foreground">Dejá vacío para “todas”.</span>
        ) : (
          selectedLabels.slice(0, 8).map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))
        )}
        {selectedLabels.length > 8 ? (
          <Badge variant="secondary">+{selectedLabels.length - 8} más</Badge>
        ) : null}
      </div>
    </div>
  );
}
