'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

type Option = {
  key: string | number;
  value: string;      // OJO: string (como en RRHH)
  title: string;
  subtitle?: string;
};

export function MultiSelectCommand({
  loading,
  options,
  value,
  onChange,
  placeholder = 'Buscar…',
  labelWhenEmpty = 'Seleccionar…',
  className,
}: {
  loading?: boolean;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;

  placeholder?: string;
  labelWhenEmpty?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const selectedCount = value.length;

  function toggle(val: string) {
    onChange(value.includes(val) ? value.filter((x) => x !== val) : [...value, val]);
  }

  function clear() {
    onChange([]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={[
            'w-full justify-between rounded-2xl border-slate-200 bg-white',
            className ?? '',
          ].join(' ')}
        >
          {selectedCount === 0 ? labelWhenEmpty : `${selectedCount} seleccionadas`}
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-2xl border-slate-200"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="bg-white">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandEmpty>{loading ? 'Cargando…' : 'No se encontró.'}</CommandEmpty>

            <CommandGroup className="max-h-[260px] overflow-auto">
              {options.map((opt) => {
                const selected = value.includes(opt.value);

                return (
                  <CommandItem
                    key={opt.key}
                    value={opt.title}
                    // ✅ CLAVE: NO cerrar el popover al seleccionar
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => toggle(opt.value)}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{opt.title}</div>
                      {opt.subtitle ? (
                        <div className="text-xs text-slate-500 truncate">{opt.subtitle}</div>
                      ) : null}
                    </div>

                    <div
                      className={[
                        'h-6 w-6 rounded-full border flex items-center justify-center',
                        selected ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200',
                      ].join(' ')}
                    >
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>

          {/* Footer tipo RRHH */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3 bg-white">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={clear}>
              Limpiar
            </Button>

            <Button type="button" className="rounded-2xl" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
