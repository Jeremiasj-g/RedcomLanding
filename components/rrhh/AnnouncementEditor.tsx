'use client';

import { useMemo, useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

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

export function AnnouncementEditor({ initial, onSaved }: Props) {
  const [type, setType] = useState<AnnouncementType>(initial?.type ?? 'news');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [severity, setSeverity] = useState<Severity>(initial?.severity ?? 'info');
  const [requireAck, setRequireAck] = useState<boolean>(initial?.require_ack ?? false);
  const [pinned, setPinned] = useState<boolean>(initial?.pinned ?? false);

  const [startsAt, setStartsAt] = useState<string>(
    initial?.starts_at
      ? isoToDatetimeLocal(initial.starts_at)
      : isoToDatetimeLocal(new Date().toISOString())
  );
  const [endsAt, setEndsAt] = useState<string>(
    initial?.ends_at ? isoToDatetimeLocal(initial.ends_at) : ''
  );

  const [audAll, setAudAll] = useState<boolean>(initial?.audience?.all ?? true);
  const [audRoles, setAudRoles] = useState<string[]>(initial?.audience?.roles ?? []);
  const [audBranches, setAudBranches] = useState<string[]>(initial?.audience?.branches ?? []);

  const [isPublished, setIsPublished] = useState<boolean>(initial?.is_published ?? true);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { branches, loading: branchesLoading } = useBranches();

  // ✅ Cuando cambia initial (plantilla / edición), refresca form
  useEffect(() => {
    setType(initial?.type ?? 'news');
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setSeverity(initial?.severity ?? 'info');
    setRequireAck(Boolean(initial?.require_ack ?? false));
    setPinned(Boolean(initial?.pinned ?? false));

    setStartsAt(
      initial?.starts_at
        ? isoToDatetimeLocal(initial.starts_at)
        : isoToDatetimeLocal(new Date().toISOString())
    );
    setEndsAt(initial?.ends_at ? isoToDatetimeLocal(initial.ends_at) : '');

    setAudAll(Boolean(initial?.audience?.all ?? true));
    setAudRoles(initial?.audience?.roles ?? []);
    setAudBranches(initial?.audience?.branches ?? []);

    setIsPublished(Boolean(initial?.is_published ?? true));
    setIsActive(Boolean(initial?.is_active ?? true));
    setErrorMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, JSON.stringify(initial ?? {})]);

  // ✅ Si no es important_alert, no tiene sentido ACK
  useEffect(() => {
    if (type !== 'important_alert' && requireAck) setRequireAck(false);
  }, [type, requireAck]);

  // ✅ Si audAll = true, limpiamos filtros (pro)
  useEffect(() => {
    if (audAll) {
      if (audRoles.length) setAudRoles([]);
      if (audBranches.length) setAudBranches([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audAll]);

  const audience = useMemo(() => {
    if (audAll) return { all: true };
    const out: any = { all: false };
    if (audRoles.length) out.roles = audRoles;
    if (audBranches.length) out.branches = audBranches;
    return out;
  }, [audAll, audRoles, audBranches]);

  const canSave = useMemo(() => {
    if (!title.trim() || !content.trim()) return false;

    const sISO = datetimeLocalToISO(startsAt);
    if (!sISO) return false;

    const eISO = datetimeLocalToISO(endsAt);
    if (eISO && new Date(eISO).getTime() < new Date(sISO).getTime()) return false;

    return true;
  }, [title, content, startsAt, endsAt]);

  const save = async () => {
    setSaving(true);
    setErrorMsg(null);

    try {
      const startsISO = datetimeLocalToISO(startsAt) ?? new Date().toISOString();
      const endsISO = datetimeLocalToISO(endsAt);

      if (endsISO && new Date(endsISO).getTime() < new Date(startsISO).getTime()) {
        setErrorMsg('La fecha "Termina" no puede ser anterior a "Empieza".');
        return;
      }

      const payload = {
        type,
        title: title.trim(),
        content: content.trim(),
        severity,
        require_ack: type === 'important_alert' ? requireAck : false,
        pinned,
        audience,
        starts_at: startsISO,
        ends_at: endsISO,
        is_published: isPublished,
        is_active: isActive,
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
      setErrorMsg(e?.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const startDT = useMemo(() => parseDTLocal(startsAt), [startsAt]);
  const endDT = useMemo(() => parseDTLocal(endsAt), [endsAt]);

  const hours = useMemo(() => Array.from({ length: 24 }).map((_, i) => pad2(i)), []);
  const minutes = useMemo(
    () => ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
    []
  );

  return (
    <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      {/* Header (simplificado) */}
      <div className="p-5 sm:p-6 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">Crear publicación</div>
          </div>

          <Button
            type="button"
            onClick={save}
            disabled={saving || !canSave}
            className="rounded-2xl"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>

        {errorMsg ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* Tipo / Severidad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FieldCard title="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as AnnouncementType)}>
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
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
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

            {type === 'important_alert' ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-slate-900">ACK obligatorio</div>
                  <div className="text-xs text-slate-500">Requiere “Entendido” para cerrar</div>
                </div>
                <Checkbox checked={requireAck} onCheckedChange={(v) => setRequireAck(Boolean(v))} />
              </div>
            ) : null}
          </FieldCard>
        </div>

        {/* Título / Contenido */}
        <div className="grid grid-cols-1 gap-4">
          <FieldCard title="Título">
            <Input
              className="h-11 rounded-2xl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cumpleaños del mes"
            />
          </FieldCard>

          <FieldCard title="Contenido">
            <Textarea
              className="min-h-[160px] rounded-2xl"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Texto detallado…"
            />
          </FieldCard>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DateTimePro
            label="Empieza"
            date={startDT.date}
            hour={startDT.hour}
            minute={startDT.minute}
            hours={hours}
            minutes={minutes}
            onChange={(d, h, m) => setStartsAt(buildDTLocal(d, h, m))}
            helper="Se interpreta como hora local del navegador."
          />

          <DateTimePro
            label="Termina (opcional)"
            date={endDT.date}
            hour={endDT.hour}
            minute={endDT.minute}
            hours={hours}
            minutes={minutes}
            onChange={(d, h, m) => setEndsAt(d ? buildDTLocal(d, h, m) : '')}
            optional
          />
        </div>

        {/* Flags pro */}
        <FieldCard title="Opciones" subtitle="Visibilidad y estado">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <NiceCheck label="Fijar arriba (pinned)" checked={pinned} onChange={setPinned} />
            <NiceCheck label="Publicado" checked={isPublished} onChange={setIsPublished} />
            <NiceCheck label="Activo" checked={isActive} onChange={setIsActive} />
            <div className={cn(
              'rounded-2xl border border-slate-200 px-3 py-3 flex items-center justify-between',
              type !== 'important_alert' && 'opacity-60'
            )}>
              <div>
                <div className="text-sm font-extrabold text-slate-900">ACK</div>
                <div className="text-xs text-slate-500">Solo popup</div>
              </div>
              <Checkbox
                checked={requireAck}
                onCheckedChange={(v) => setRequireAck(Boolean(v))}
                disabled={type !== 'important_alert'}
              />
            </div>
          </div>
        </FieldCard>

        {/* Audience */}
        <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-extrabold text-slate-900">Audiencia</div>
                <div className="text-sm text-slate-600">A quién le aparece (RLS filtra)</div>
              </div>

              {/* ✅ Toggle “Todos” */}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <Switch checked={audAll} onCheckedChange={(v) => setAudAll(v)} />
                <span className="text-sm font-semibold text-slate-800">Todos</span>
              </div>
            </div>
          </div>

          {/* ✅ Solo si audAll = false, aparece el bloque completo */}
          {!audAll ? (
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Roles */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <div className="text-xs font-extrabold text-slate-700">Roles</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const active = audRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setAudRoles((prev) =>
                            active ? prev.filter((x) => x !== r) : [...prev, r]
                          )
                        }
                        className={cn(
                          'px-3 py-2 rounded-2xl border text-xs font-extrabold transition',
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        )}
                      >
                        {r.toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Si dejás vacío, se interpreta como “todos los roles”.
                </div>
              </div>

              {/* Branches */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <div className="text-xs font-extrabold text-slate-700">Sucursales (branches)</div>

                {/* Chips seleccionados */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {audBranches.length === 0 ? (
                    <span className="text-xs text-slate-500">Sin filtro (todas)</span>
                  ) : (
                    audBranches.map((v) => {
                      const found = branches.find((b) => b.value === v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAudBranches((prev) => prev.filter((x) => x !== v))}
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
                  <BranchesMultiSelect
                    loading={branchesLoading}
                    options={branches}
                    value={audBranches}
                    onChange={setAudBranches}
                  />
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Dejá vacío para “todas”.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={() => {
              setType('news');
              setTitle('');
              setContent('');
              setSeverity('info');
              setRequireAck(false);
              setPinned(false);
              setStartsAt(isoToDatetimeLocal(new Date().toISOString()));
              setEndsAt('');
              setAudAll(true);
              setAudRoles([]);
              setAudBranches([]);
              setIsPublished(true);
              setIsActive(true);
              setErrorMsg(null);
            }}
          >
            Limpiar
          </Button>

          <Button type="button" className="rounded-2xl" onClick={save} disabled={saving || !canSave}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function FieldCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
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

function NiceCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 px-3 py-3 flex items-center justify-between">
      <div className="text-sm font-extrabold text-slate-900">{label}</div>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}

function DateTimePro({
  label,
  date,
  hour,
  minute,
  hours,
  minutes,
  onChange,
  optional,
  helper,
}: {
  label: string;
  date: Date | null;
  hour: string;
  minute: string;
  hours: string[];
  minutes: string[];
  onChange: (d: Date | null, h: string, m: string) => void;
  optional?: boolean;
  helper?: string;
}) {
  const display = useMemo(() => {
    if (!date) return optional ? 'Sin fecha' : 'Seleccionar…';
    return `${date.toLocaleDateString()} ${hour}:${minute}`;
  }, [date, hour, minute, optional]);

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-extrabold text-slate-700">{label}</Label>
        {optional ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 rounded-xl text-xs"
            onClick={() => onChange(null, hour, minute)}
          >
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
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={(d) => onChange(d ?? null, hour, minute)}
              initialFocus
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <TimeCombo label="Hora" value={hour} options={hours} onChange={(h) => onChange(date, h, minute)} />
              <TimeCombo label="Min" value={minute} options={minutes} onChange={(m) => onChange(date, hour, m)} />
            </div>

            {helper ? <div className="mt-2 text-xs text-slate-500">{helper}</div> : null}
          </div>

          <div className="p-3 border-t border-slate-200 flex justify-end bg-white">
            <Button type="button" className="rounded-2xl">Listo</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TimeCombo({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
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
                      onChange(opt);
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

function BranchesMultiSelect({
  options,
  value,
  onChange,
  loading,
}: {
  options: Array<{ id: string; label: string; value: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0 ? 'Sin filtro (todas)' : `${value.length} seleccionadas`;

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
          <span className="truncate">{loading ? 'Cargando sucursales…' : label}</span>
          <ChevronsUpDown className="h-4 w-4 text-slate-500" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar sucursal…" />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((b) => {
                const selected = value.includes(b.value);
                return (
                  <CommandItem
                    key={b.id}
                    value={`${b.label} ${b.value}`}
                    onSelect={() => {
                      onChange(selected ? value.filter((x) => x !== b.value) : [...value, b.value]);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">{b.label}</div>
                      <div className="text-xs text-slate-500">{b.value}</div>
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
