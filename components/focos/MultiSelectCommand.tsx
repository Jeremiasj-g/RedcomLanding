'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

export type MultiSelectOption = {
  key: string | number;
  value: string;      // lo manejamos como string
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
}: {
  loading?: boolean;
  options: MultiSelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  labelWhenEmpty?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const selectedCount = value.length;

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          {selectedCount === 0 ? labelWhenEmpty : `${selectedCount} seleccionadas`}
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandEmpty>No se encontró.</CommandEmpty>

          <CommandGroup>
            {loading ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : (
              options.map((opt) => {
                const selected = value.includes(opt.value);

                return (
                  <CommandItem
                    key={opt.key}
                    // 🔥 clave: evita blur/focus-out que cierra popover dentro del Dialog
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={() => {
                      toggle(opt.value);
                      // mantenemos abierto
                      setOpen(true);
                    }}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.title}</span>
                      {opt.subtitle ? (
                        <span className="text-xs text-muted-foreground">{opt.subtitle}</span>
                      ) : null}
                    </div>

                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>

          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange([])}
            >
              Limpiar
            </Button>

            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
