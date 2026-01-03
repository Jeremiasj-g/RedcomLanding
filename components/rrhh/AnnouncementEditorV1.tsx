'use client';

import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Check, ChevronsUpDown, Calendar as CalendarIcon, X } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';
import { datetimeLocalToISO, isoToDatetimeLocal } from '@/utils/datetime';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

type AnnouncementType = 'news' | 'weekly' | 'birthday' | 'important_alert';
type Severity = 'info' | 'warning' | 'critical';

type Props = {
  initial?: any; // editar / plantilla
  onSaved?: () => void;
};

const ROLES = ['admin', 'supervisor', 'vendedor', 'rrhh'] as const;

const TYPE_OPTIONS: { value: AnnouncementType; label: string; hint: string }[] = [
  { value: 'news', label: 'Noticia', hint: 'Comunicado general / novedades' },
  { value: 'weekly', label: 'Semanal', hint: 'Resumen o recordatorios de la semana' },
  { value: 'birthday', label: 'Cumpleaños', hint: 'Festejos / saludo del día' },
  { value: 'important_alert', label: 'Alerta importante (popup)', hint: 'Se muestra como popup en home' },
];

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function parseDTLocal(dt: string): { date: Date | null; hour: string; minute: string } {
  if (!dt) return { date: null, hour: '09', minute: '00' };
  const [dPart, tPart] = dt.split('T');
  if (!dPart || !tPart) return { date: null, hour: '09', minute: '00' };
  const [y, m, d] = dPart.split('-').map(Number);
  const [hh, mm] = tPart.split(':').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return { date, hour: pad2(hh ?? 0), minute: pad2(mm ?? 0) };
}

function buildDTLocal(date: Date | null, hour: string, minute: string) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(Number(hour || '0'));
  const mm = pad2(Number(minute || '0'));
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/* ---------------- Form state (reducer) ---------------- */

type FormState = {
  type: AnnouncementType;
  title: string;
  content: string;
  severity: Severity;
  requireAck: boolean;
  pinned: boolean;

  startsAt: string; // datetime-local
  endsAt: string; // datetime-local | ''

  audAll: boolean;
  audRoles: string[];
  audBranches: string[];

  isPublished: boolean;
  isActive: boolean;

  saving: boolean;
  errorMsg: string | null;
};

type FormAction =
  | { type: 'hydrate'; payload: Partial<FormState> }
  | { type: 'set'; key: keyof FormState; value: any }
  | { type: 'reset'; payload: FormState };

function makeInitialState(initial?: any): FormState {
  const now = isoToDatetimeLocal(new Date().toISOString());

  return {
    type: (initial?.type ?? 'news') as AnnouncementType,
    title: initial?.title ?? '',
    content: initial?.content ?? '',
    severity: (initial?.severity ?? 'info') as Severity,
    requireAck: Boolean(initial?.require_ack ?? false),
    pinned: Boolean(initial?.pinned ?? false),

    startsAt: initial?.starts_at ? isoToDatetimeLocal(initial.starts_at) : now,
    endsAt: initial?.ends_at ? isoToDatetimeLocal(initial.ends_at) : '',

    audAll: Boolean(initial?.audience?.all ?? true),
    audRoles: initial?.audience?.roles ?? [],
    audBranches: initial?.audience?.branches ?? [],

    isPublished: Boolean(initial?.is_published ?? true),
    isActive: Boolean(initial?.is_active ?? true),

    saving: false,
    errorMsg: null,
  };
}

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.payload };
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'reset':
      return action.payload;
    default:
      return state;
  }
}

function useAnnouncementForm(initial?: any) {
  const [state, dispatch] = useReducer(reducer, initial, makeInitialState);

  // ✅ refrescar form cuando cambia initial
  useEffect(() => {
    dispatch({ type: 'reset', payload: makeInitialState(initial) });
  }, [initial?.id]); // suficiente para edición/plantilla

  // ✅ Si no es popup, ACK no aplica
  useEffect(() => {
    if (state.type !== 'important_alert' && state.requireAck) {
      dispatch({ type: 'set', key: 'requireAck', value: false });
    }
  }, [state.type, state.requireAck]);

  // ✅ audAll limpia filtros
  useEffect(() => {
    if (state.audAll && (state.audRoles.length || state.audBranches.length)) {
      dispatch({ type: 'hydrate', payload: { audRoles: [], audBranches: [] } });
    }
  }, [state.audAll]);

  const audience = useMemo(() => {
    if (state.audAll) return { all: true };
    const out: any = { all: false };
    if (state.audRoles.length) out.roles = state.audRoles;
    if (state.audBranches.length) out.branches = state.audBranches;
    return out;
  }, [state.audAll, state.audRoles, state.audBranches]);

  const canSave = useMemo(() => {
    if (!state.title.trim() || !state.content.trim()) return false;

    const sISO = datetimeLocalToISO(state.startsAt);
    if (!sISO) return false;

    const eISO = datetimeLocalToISO(state.endsAt);
    if (eISO && new Date(eISO).getTime() < new Date(sISO).getTime()) return false;

    return true;
  }, [state.title, state.content, state.startsAt, state.endsAt]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    dispatch({ type: 'set', key, value });

  const reset = () => dispatch({ type: 'reset', payload: makeInitialState(undefined) });

  return { state, set, audience, canSave, reset, dispatch };
}

/* ---------------- Main component ---------------- */

export function AnnouncementEditor({ initial, onSaved }: Props) {
  const { branches, loading: branchesLoading } = useBranches();
  const { state, set, audience, canSave, reset, dispatch } = useAnnouncementForm(initial);

  const hours = useMemo(() => Array.from({ length: 24 }).map((_, i) => pad2(i)), []);
  const minutes = useMemo(() => ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'], []);

  const save = async () => {
    dispatch({ type: 'hydrate', payload: { saving: true, errorMsg: null } });

    try {
      const startsISO = datetimeLocalToISO(state.startsAt) ?? new Date().toISOString();
      const endsISO = datetimeLocalToISO(state.endsAt);

      if (endsISO && new Date(endsISO).getTime() < new Date(startsISO).getTime()) {
        dispatch({ type: 'set', key: 'errorMsg', value: 'La fecha "Termina" no puede ser anterior a "Empieza".' });
        return;
      }

      const payload = {
        type: state.type,
        title: state.title.trim(),
        content: state.content.trim(),
        severity: state.severity,
        require_ack: state.type === 'important_alert' ? state.requireAck : false,
        pinned: state.pinned,
        audience,
        starts_at: startsISO,
        ends_at: endsISO,
        is_published: state.isPublished,
        is_active: state.isActive,
      };

      if (initial?.id) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert(payload);
        if (error) throw error;
      }

      onSaved?.();
    } catch (e: any) {
      console.error('[AnnouncementEditor] save error', e);
      dispatch({ type: 'set', key: 'errorMsg', value: e?.message ?? 'Error al guardar.' });
    } finally {
      dispatch({ type: 'set', key: 'saving', value: false });
    }
  };

  return (
    <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="text-2xl font-extrabold text-slate-900">
            {initial?.id ? 'Editar publicación' : 'Crear publicación'}
          </div>

          <Button type="button" onClick={save} disabled={state.saving || !canSave} className="rounded-2xl">
            {state.saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>

        {state.errorMsg ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.errorMsg}
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FieldCard title="Tipo">
            <Select value={state.type} onValueChange={(v) => set('type', v as AnnouncementType)}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder="Seleccionar tipo…" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-xs text-slate-500">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCard>

          <FieldCard title="Severidad">
            <Select value={state.severity} onValueChange={(v) => set('severity', v as Severity)}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder="Seleccionar severidad…" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className={cn('mt-3', state.type !== 'important_alert' && 'opacity-60')}>
              <InlineCheck
                title="ACK obligatorio"
                desc="Requiere “Entendido” para cerrar"
                checked={state.requireAck}
                disabled={state.type !== 'important_alert'}
                onChange={(v) => set('requireAck', v)}
              />
            </div>
          </FieldCard>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FieldCard title="Título">
            <Input
              className="h-11 rounded-2xl"
              value={state.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ej: Cumpleaños del mes"
            />
          </FieldCard>

          <FieldCard title="Contenido">
            <Textarea
              className="min-h-[160px] rounded-2xl"
              value={state.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Texto detallado…"
            />
          </FieldCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DateTimePicker
            label="Empieza"
            value={state.startsAt}
            hours={hours}
            minutes={minutes}
            onChange={(dtLocal) => set('startsAt', dtLocal)}
            helper="Se interpreta como hora local del navegador."
          />
          <DateTimePicker
            label="Termina (opcional)"
            value={state.endsAt}
            hours={hours}
            minutes={minutes}
            optional
            onChange={(dtLocal) => set('endsAt', dtLocal)}
          />
        </div>

        <FieldCard title="Opciones" subtitle="Visibilidad y estado">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <NiceCheck label="Fijar arriba (pinned)" checked={state.pinned} onChange={(v) => set('pinned', v)} />
            <NiceCheck label="Publicado" checked={state.isPublished} onChange={(v) => set('isPublished', v)} />
            <NiceCheck label="Activo" checked={state.isActive} onChange={(v) => set('isActive', v)} />

            <div className={cn('rounded-2xl border border-slate-200 px-3 py-3 flex items-center justify-between', state.type !== 'important_alert' && 'opacity-60')}>
              <div>
                <div className="text-sm font-extrabold text-slate-900">ACK</div>
                <div className="text-xs text-slate-500">Solo popup</div>
              </div>
              <Checkbox
                checked={state.requireAck}
                onCheckedChange={(v) => set('requireAck', Boolean(v))}
                disabled={state.type !== 'important_alert'}
              />
            </div>
          </div>
        </FieldCard>

        <AudienceCard
          audAll={state.audAll}
          onAudAll={(v) => set('audAll', v)}
          roles={ROLES as unknown as string[]}
          selectedRoles={state.audRoles}
          onRoles={(v) => set('audRoles', v)}
          branches={branches}
          branchesLoading={branchesLoading}
          selectedBranches={state.audBranches}
          onBranches={(v) => set('audBranches', v)}
        />

        <Separator />

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-2xl" onClick={reset}>
            Limpiar
          </Button>

          <Button type="button" className="rounded-2xl" onClick={save} disabled={state.saving || !canSave}>
            {state.saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Reusables ---------------- */

function FieldCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4">
      <div>
        <div className="text-xs font-extrabold text-slate-700">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function NiceCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 px-3 py-3 flex items-center justify-between">
      <div className="text-sm font-extrabold text-slate-900">{label}</div>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}

function InlineCheck({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 flex items-center justify-between', disabled && 'opacity-60')}>
      <div>
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        {desc ? <div className="text-xs text-slate-500">{desc}</div> : null}
      </div>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}

/* ---------------- DateTime (1 componente) ---------------- */

function DateTimePicker({
  label,
  value,
  hours,
  minutes,
  onChange,
  optional,
  helper,
}: {
  label: string;
  value: string; // dt-local
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

/* ---------------- Generic Command Select ---------------- */

function CommandSelect({
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

/* ---------------- Audience (reutilizable) ---------------- */

function AudienceCard({
  audAll,
  onAudAll,
  roles,
  selectedRoles,
  onRoles,
  branches,
  branchesLoading,
  selectedBranches,
  onBranches,
}: {
  audAll: boolean;
  onAudAll: (v: boolean) => void;

  roles: string[];
  selectedRoles: string[];
  onRoles: (v: string[]) => void;

  branches: Array<{ id: string; label: string; value: string }>;
  branchesLoading?: boolean;
  selectedBranches: string[];
  onBranches: (v: string[]) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold text-slate-900">Audiencia</div>
            <div className="text-sm text-slate-600">A quién le aparece (RLS filtra)</div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Switch checked={audAll} onCheckedChange={onAudAll} />
            <span className="text-sm font-semibold text-slate-800">Todos</span>
          </div>
        </div>
      </div>

      {!audAll ? (
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 bg-white">
            <div className="text-xs font-extrabold text-slate-700">Roles</div>

            <ChipGroup
              className="mt-3"
              options={roles.map((r) => ({ value: r, label: r.toUpperCase() }))}
              value={selectedRoles}
              onChange={onRoles}
            />

            <div className="mt-3 text-xs text-slate-500">Si dejás vacío, se interpreta como “todos los roles”.</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 bg-white">
            <div className="text-xs font-extrabold text-slate-700">Sucursales (branches)</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedBranches.length === 0 ? (
                <span className="text-xs text-slate-500">Sin filtro (todas)</span>
              ) : (
                selectedBranches.map((v) => {
                  const found = branches.find((b) => b.value === v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onBranches(selectedBranches.filter((x) => x !== v))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      title="Quitar"
                    >
                      {found?.label ?? v}
                      <span className="text-slate-400">×</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-3">
              <MultiSelectCommand
                loading={branchesLoading}
                labelWhenEmpty="Sin filtro (todas)"
                options={branches.map((b) => ({
                  key: b.id,
                  value: b.value,
                  title: b.label,
                  subtitle: b.value,
                }))}
                value={selectedBranches}
                onChange={onBranches}
                placeholder="Buscar sucursal…"
              />
            </div>

            <div className="mt-3 text-xs text-slate-500">Dejá vacío para “todas”.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const toggle = (val: string) => {
    const active = value.includes(val);
    onChange(active ? value.filter((x) => x !== val) : [...value, val]);
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'px-3 py-2 rounded-2xl border text-xs font-extrabold transition',
              active
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Generic MultiSelect (Command) ---------------- */

function MultiSelectCommand({
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

  const label =
    value.length === 0 ? (labelWhenEmpty ?? 'Sin filtro') : `${value.length} seleccionadas`;

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
