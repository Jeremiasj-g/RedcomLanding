'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../utils/cn';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export function MultiSelectCommand({
    options,
    value,
    onChange,
    loading,
    placeholder,
    labelWhenEmpty,
}: {
    options: Array<{ key: string; value: string; title: string; subtitle?: string }>;
    value: string[];
    onChange: (v: string[]) => void;
    loading?: boolean;
    placeholder?: string;
    labelWhenEmpty?: string;
}) {
    const [open, setOpen] = useState(false);

    const label = value.length === 0 ? (labelWhenEmpty ?? 'Sin filtro') : `${value.length} seleccionadas`;

    const toggle = (val: string) => {
        const selected = value.includes(val);
        onChange(selected ? value.filter((x) => x !== val) : [...value, val]);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-800',
                        'shadow-sm hover:bg-slate-50 transition flex items-center justify-between'
                    )}
                >
                    <span className="truncate">{loading ? 'Cargando…' : label}</span>
                    <ChevronsUpDown className="h-4 w-4 text-slate-500" />
                </button>
            </PopoverTrigger>

            <PopoverContent className="p-0 w-[360px]" align="start">
                <Command>
                    <CommandInput placeholder={placeholder ?? 'Buscar…'} />
                    <CommandList className="max-h-[260px]">
                        <CommandEmpty>Sin resultados.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => {
                                const selected = value.includes(opt.value);
                                return (
                                    <CommandItem
                                        key={opt.key}
                                        value={`${opt.title} ${opt.value}`}
                                        onSelect={() => toggle(opt.value)}
                                        className="flex items-center justify-between"
                                    >
                                        <div>
                                            <div className="font-semibold">{opt.title}</div>
                                            {opt.subtitle ? <div className="text-xs text-slate-500">{opt.subtitle}</div> : null}
                                        </div>

                                        {selected ? (
                                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl bg-slate-900 text-white">
                                                <Check className="h-4 w-4" />
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl border border-slate-200 text-slate-400" />
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>

                <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-white">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onChange([])}>
                        Limpiar
                    </Button>
                    <Button type="button" className="rounded-2xl" onClick={() => setOpen(false)}>
                        Listo
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
