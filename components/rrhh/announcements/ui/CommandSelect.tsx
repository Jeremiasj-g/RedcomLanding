'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../utils/cn';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export function CommandSelect({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: string[];
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-extrabold text-slate-700">{label}</div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-800',
              'shadow-sm hover:bg-slate-50 transition flex items-center justify-between'
            )}
          >
            <span className="truncate">{value}</span>
            <ChevronsUpDown className="h-4 w-4 text-slate-500" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="p-0 w-[190px]" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
            <CommandList className="max-h-[220px]">
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onPick(opt);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <span className="font-semibold">{opt}</span>
                    {opt === value ? <Check className="h-4 w-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
