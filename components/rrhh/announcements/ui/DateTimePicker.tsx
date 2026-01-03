'use client';

import { useMemo } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { parseDTLocal, buildDTLocal } from '../utils/datetimeLocal';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CommandSelect } from './CommandSelect';

export function DateTimePicker({
    label,
    value,
    hours,
    minutes,
    onChange,
    optional,
    helper,
}: {
    label: string;
    value: string;
    hours: string[];
    minutes: string[];
    onChange: (dtLocal: string) => void;
    optional?: boolean;
    helper?: string;
}) {
    const { date, hour, minute } = useMemo(() => parseDTLocal(value), [value]);

    const display = useMemo(() => {
        if (!date) return optional ? 'Sin fecha' : 'Seleccionar…';
        return `${date.toLocaleDateString()} ${hour}:${minute}`;
    }, [date, hour, minute, optional]);

    const setDate = (d: Date | null) => onChange(buildDTLocal(d, hour, minute));
    const setHour = (h: string) => onChange(buildDTLocal(date, h, minute));
    const setMinute = (m: string) => onChange(buildDTLocal(date, hour, m));

    return (
        <div className="rounded-2xl border border-slate-300 bg-white p-4">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-extrabold text-slate-700">{label}</Label>
                {optional ? (
                    <Button type="button" variant="ghost" className="h-8 px-2 rounded-xl text-xs" onClick={() => onChange('')}>
                        <X className="h-4 w-4 mr-1" />
                        Limpiar
                    </Button>
                ) : null}
            </div>

            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-800',
                            'shadow-sm hover:bg-slate-50 transition flex items-center justify-between'
                        )}
                    >
                        <span className="truncate">{display}</span>
                        <CalendarIcon className="h-4 w-4 text-slate-500" />
                    </button>
                </PopoverTrigger>

                <PopoverContent className="p-0 w-[380px]" align="start">
                    <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="text-xs font-extrabold text-slate-700">Fecha y hora</div>
                    </div>

                    <div className="p-3">
                        <Calendar mode="single" selected={date ?? undefined} onSelect={(d) => setDate(d ?? null)} initialFocus />

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <CommandSelect label="Hora" value={hour} options={hours} onPick={setHour} />
                            <CommandSelect label="Min" value={minute} options={minutes} onPick={setMinute} />
                        </div>

                        {helper ? <div className="mt-2 text-xs text-slate-500">{helper}</div> : null}
                    </div>

                    <div className="p-3 border-t border-slate-200 flex justify-end bg-white">
                        <Button type="button" className="rounded-2xl">
                            Listo
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
