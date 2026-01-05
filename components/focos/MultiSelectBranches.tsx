'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

export type Branch = { id: number; name: string };

export default function MultiSelectBranches({
  label = 'Sucursales destino',
  branches,
  value,
  onChange,
  open,
  onOpenChange,
  maxBadges = 8,
  placeholder = 'Seleccionar sucursales…',
}: {
  label?: string;
  branches: Branch[];
  value: number[];
  onChange: (next: number[]) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  maxBadges?: number;
  placeholder?: string;
}) {
  const selectedLabels = React.useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return value.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [branches, value]);

  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {value.length === 0 ? placeholder : `${value.length} seleccionadas`}
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar sucursal…" />
            <CommandEmpty>No se encontró.</CommandEmpty>

            <CommandGroup>
              {branches.map((b) => {
                const selected = value.includes(b.id);

                return (
                  <CommandItem
                    key={b.id}
                    // 🔥 FIX: evita que el popover se cierre por blur/pointer
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={() => {
                      toggle(b.id);
                      // mantenemos abierto
                      onOpenChange(true);
                    }}
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded border">
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span>{b.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* Acciones rápidas */}
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(branches.map((b) => b.id))}
              >
                Seleccionar todas
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChange([])}
                >
                  Limpiar
                </Button>
                <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                  Listo
                </Button>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap gap-2">
        {selectedLabels.slice(0, maxBadges).map((name) => (
          <Badge key={name} variant="outline">
            {name}
          </Badge>
        ))}
        {selectedLabels.length > maxBadges ? (
          <Badge variant="secondary">+{selectedLabels.length - maxBadges} más</Badge>
        ) : null}
      </div>
    </div>
  );
}
