'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Pencil,
  Sparkles,
  AlertTriangle,
  GraduationCap,
  Percent,
  Trash,
  Target,
  ClipboardCheck,
} from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

import { updateFoco } from '@/components/focos/focos.panel.api';
import dynamic from 'next/dynamic';

// ✅ ESTE ES EL FIX: usamos el mismo multiselect que te funcionaba antes
import BranchesMultiSelect, { type Branch } from '@/components/focos/BranchesMultiSelect';

/**
 * ✅ IMPORTANTE:
 * Reemplazá este import por el editor que usás en "proyectos".
 *
 * OPCIÓN A (componente controlado):
 *   import MiniWord from '@/components/proyectos/MiniWord';
 *
 * OPCIÓN B (tiptap wrapper):
 *   import RichTextEditor from '@/components/proyectos/RichTextEditor';
 */
// import MiniWord from '@/components/proyectos/MiniWord';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

type Severity = 'info' | 'warning' | 'critical';
type FocoType = 'foco' | 'critico' | 'promo' | 'capacitacion';

export type FocoUpsertInitial = {
  focoId: string;
  title: string;
  content: string;
  severity: Severity;
  type: FocoType;
  targetBranchIds: number[];
};

type Template = {
  key: string;
  title: string;
  desc: string;
  tag: string;
  icon: React.ReactNode;
  payload: {
    title: string;
    type: FocoType;
    severity: Severity;
    content: string; // texto plano hoy
  };
  tip?: string;
};

const templates: Template[] = [
  {
    key: 'promo',
    title: 'Promo / Descuento',
    desc: 'Listado de productos con descuento para mover hoy',
    tag: 'PROMO',
    icon: (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
        <Percent className="h-5 w-5" />
      </span>
    ),
    payload: {
      title: 'PROMO VIGENTE',
      type: 'promo',
      severity: 'info',
      content: [
        'PRODUCTO PARA SACAR HOY',
        '',
        'DESCUENTO',
        '',
        'COD:_____ - ____________________________ __/__',
        '(____ UNID) - __% DESC $_____',
        '',
        'COD:_____ - ____________________________ __/__',
        '(____ UNID) - __% DESC $_____',
        '',
        'COD:_____ - ____________________________ __/__',
        '(____ UNID) - __% DESC $_____',
        '',
        'NOTA / ACCION',
        '- Priorizar ofrecimiento a clientes clave',
        '- Reforzar exhibicion / POP',
      ].join('\n'),
    },
  },
  {
    key: 'daily-focus',
    title: 'Foco del día',
    desc: 'Objetivo puntual + lista de productos (si aplica)',
    tag: 'DAILY',
    icon: (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
        <Target className="h-5 w-5" />
      </span>
    ),
    payload: {
      title: 'FOCO DEL DIA',
      type: 'foco',
      severity: 'info',
      content: [
        'FOCO DEL DIA __/__/____',
        '',
        'OBJETIVO',
        '- ____________________________',
        '',
        'ACCIONES',
        '1) ____________________________',
        '2) ____________________________',
        '',
        'LISTA (SI APLICA)',
        '1) COD:_____ - ____________________ __/__ - __% DESC $_____',
        '2) COD:_____ - ____________________ __/__ - __% DESC $_____',
        '',
        'RESULTADO ESPERADO',
        '- ____________________________',
      ].join('\n'),
    },
  },
  {
    key: 'coverage',
    title: 'Foco de cobertura',
    desc: 'Metas por clientes / categorias (muy usado en tus ejemplos)',
    tag: 'COVERAGE',
    icon: (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
        <ClipboardCheck className="h-5 w-5" />
      </span>
    ),
    payload: {
      title: 'FOCO DE COBERTURA',
      type: 'foco',
      severity: 'info',
      content: [
        'FOCO DE COBERTURA __/__/____',
        '',
        'METAS',
        '- __ CLIENTES DE _____________',
        '- __ CLIENTES DE _____________',
        '- __ CLIENTES DE _____________',
        '',
        'NOTA',
        '- Registrar avance y dejar seguimiento',
      ].join('\n'),
    },
  },
  {
    key: 'training',
    title: 'Capacitación',
    desc: 'Comunicar repaso / capacitación con material',
    tag: 'TRAINING',
    icon: (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700">
        <GraduationCap className="h-5 w-5" />
      </span>
    ),
    payload: {
      title: 'CAPACITACION',
      type: 'capacitacion',
      severity: 'info',
      content: [
        'CAPACITACION',
        '',
        'TEMA',
        '- ____________________________',
        '',
        'OBJETIVO',
        '- ____________________________',
        '',
        'MATERIAL',
        '- Link / PDF / Looker: ____________________________',
        '',
        'CUANDO',
        '- Dia: __/__/____',
        '- Hora: __:__',
      ].join('\n'),
    },
  },
  {
    key: 'critical-op',
    title: 'Crítico operativo',
    desc: 'Incidente real / bloqueo / instrucción firme',
    tag: 'CRITICAL',
    icon: (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
        <AlertTriangle className="h-5 w-5" />
      </span>
    ),
    payload: {
      title: 'CRITICO OPERATIVO',
      type: 'critico',
      severity: 'critical',
      content: [
        'CRITICO OPERATIVO',
        '',
        'PROBLEMA',
        '- ____________________________',
        '',
        'IMPACTO',
        '- ____________________________',
        '',
        'ACCION INMEDIATA',
        '1) ____________________________',
        '2) ____________________________',
        '',
        'RESPONSABLE',
        '- ____________________________',
        '',
        'SEGUIMIENTO',
        '- ETA: ________________________',
      ].join('\n'),
    },
  },
  {
    key: 'cleaning',
    title: 'Limpieza / Orden',
    desc: 'Plantilla tipo “LIMPIAR HOY” + lista de items',
    tag: 'ORDER',
    icon: (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
        <Trash className="h-5 w-5" />
      </span>
    ),
    payload: {
      title: 'LIMPIAR HOY',
      type: 'foco',
      severity: 'warning',
      content: [
        'LIMPIAR HOY __/__/____',
        '',
        'APARTIR __% DESCUENTO',
        '',
        '(__) COD:_____ - ____________________________ __/__',
        '(__) COD:_____ - ____________________________ __/__',
        '(__) COD:_____ - ____________________________ __/__',
        '',
        'FOCO DEL DIA __/__/____',
        '- __ CLIENTES _____________',
        '- __ CLIENTES _____________',
      ].join('\n'),
    },
  },
];

// ---------- helpers HTML ----------
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Convierte texto plano con saltos de línea a HTML simple */
function plainToHtml(plain: string) {
  const safe = escapeHtml(plain ?? '');
  return safe.replaceAll('\n', '<br/>');
}

/** Si NO parece HTML, lo convertimos a HTML (para compat con focos viejos) */
function ensureHtml(maybeHtml: string) {
  const v = (maybeHtml ?? '').trim();
  if (!v) return '';
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(v) || v.includes('<br');
  return looksHtml ? v : plainToHtml(v);
}

/** Para validación: si el HTML está vacío (solo espacios / <br>) */
function isHtmlEmpty(html: string) {
  const v = (html ?? '')
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<\/?[^>]+(>|$)/g, '')
    .replaceAll('&nbsp;', ' ')
    .trim();
  return v.length === 0;
}

export default function PanelFocoUpsertDialog({
  open,
  onOpenChange,
  onSaved,
  mode,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;

  mode: 'create' | 'edit';
  initial?: FocoUpsertInitial | null;
}) {
  const { me } = useMe();

  const [loading, setLoading] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [contentHtml, setContentHtml] = React.useState(''); // ✅ ahora HTML
  const [severity, setSeverity] = React.useState<Severity>('info');
  const [type, setType] = React.useState<FocoType>('foco');

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [targetBranchIds, setTargetBranchIds] = React.useState<number[]>([]);
  const [targetsOpen, setTargetsOpen] = React.useState(false);

  const [lastTip, setLastTip] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (!me?.id) return;

    (async () => {
      const { data, error } = await supabase
        .from('user_branches')
        .select('branch_id, branches:branches(id,name)')
        .eq('user_id', me.id);

      if (error) {
        console.error('[FOCOS] load branches error', error);
        return;
      }

      const list: Branch[] =
        (data || [])
          .map((r: any) => r.branches)
          .filter(Boolean)
          .map((b: any) => ({ id: b.id, name: b.name })) ?? [];

      setBranches(list);

      if (mode === 'edit' && initial) {
        setTitle(initial.title ?? '');
        setContentHtml(ensureHtml(initial.content ?? ''));
        setSeverity(initial.severity ?? 'info');
        setType(initial.type ?? 'foco');
        setTargetBranchIds(initial.targetBranchIds ?? []);
      } else {
        setTitle('');
        setContentHtml('');
        setSeverity('info');
        setType('foco');
        setTargetBranchIds(list.map((b) => b.id));
      }
    })();
  }, [open, me?.id, mode, initial]);

  function reset() {
    setTitle('');
    setContentHtml('');
    setSeverity('info');
    setType('foco');
    setTargetBranchIds(branches.map((b) => b.id));
    setLastTip(null);
  }

  function applyTemplate(t: Template) {
    setTitle(t.payload.title);
    setType(t.payload.type);
    setSeverity(t.payload.severity);
    setContentHtml(plainToHtml(t.payload.content)); // ✅ plantilla (texto) -> html
    setLastTip(t.tip ?? null);
  }

  async function save() {
    if (!me?.id) return;
    if (!title.trim()) return;
    if (isHtmlEmpty(contentHtml)) return;
    if (targetBranchIds.length === 0) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        const { data: foco, error: focoErr } = await supabase
          .from('focos')
          .insert({
            title: title.trim(),
            content: contentHtml, // ✅ guardamos HTML
            severity,
            type,
          })
          .select('id')
          .single();

        if (focoErr) throw focoErr;
        if (!foco?.id) throw new Error('No se devolvió el id del foco.');

        const payloadTargets = targetBranchIds.map((bid) => ({
          foco_id: foco.id,
          branch_id: bid,
        }));

        const { error: targetsErr } = await supabase.from('foco_targets').insert(payloadTargets);
        if (targetsErr) throw targetsErr;
      } else {
        if (!initial?.focoId) throw new Error('Falta focoId para editar.');

        await updateFoco({
          focoId: initial.focoId,
          title,
          content: contentHtml, // ✅ HTML
          severity,
          type,
          targetBranchIds,
        });
      }

      onSaved?.();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      console.error('[FOCOS] save foco error', e);
      alert(`No se pudo guardar el foco: ${e?.message ?? 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedLabels = React.useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return targetBranchIds.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [branches, targetBranchIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'edit' ? <Pencil className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {mode === 'edit' ? 'Editar foco' : 'Crear foco'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Título (ej: FOCO DEL DÍA)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Atención</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>

              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="foco">Foco</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="capacitacion">Capacitación</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Vigencia: por ahora “hasta nuevo aviso”
              </div>
            </div>

            {/* ✅ Contenido: Mini Word */}
            <div>
              <label className="text-sm font-medium">Contenido</label>

              <div className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={contentHtml}
                  onChange={setContentHtml}
                  className="
                            [&_.ql-toolbar]:border-0
                            [&_.ql-toolbar]:border-b
                            [&_.ql-toolbar]:border-slate-200
                            [&_.ql-toolbar]:bg-slate-50
                            [&_.ql-toolbar_.ql-formats]:mr-2

                            [&_.ql-toolbar_button]:h-6
                            [&_.ql-toolbar_button]:w-6
                            [&_.ql-toolbar_button]:rounded-lg
                            [&_.ql-toolbar_button:hover]:bg-slate-100
                            [&_.ql-toolbar_button.ql-active]:bg-slate-200

                            [&_.ql-toolbar_.ql-picker]:h-8
                            [&_.ql-toolbar_.ql-picker]:rounded-lg
                            [&_.ql-toolbar_.ql-picker:hover]:bg-slate-100
                            [&_.ql-toolbar_.ql-picker-label]:text-slate-700
                            [&_.ql-toolbar_.ql-picker-options]:rounded-xl
                            [&_.ql-toolbar_.ql-picker-options]:border
                            [&_.ql-toolbar_.ql-picker-options]:border-slate-200
                            [&_.ql-toolbar_.ql-picker-options]:bg-white
                            [&_.ql-toolbar_.ql-picker-item]:text-slate-700

                            [&_.ql-container]:border-0
                            [&_.ql-container]:shadow-none
                            [&_.ql-container]:bg-white

                            [&_.ql-editor]:h-[240px]
                            [&_.ql-editor]:p-3
                            [&_.ql-editor]:text-sm
                            [&_.ql-editor]:leading-relaxed
                            [&_.ql-editor]:text-slate-900
                            [&_.ql-editor]:outline-none

                            [&_.ql-editor_ol]:pl-6
                            [&_.ql-editor_ul]:pl-6
                            [&_.ql-editor_a]:text-sky-700
                            [&_.ql-editor_a]:underline

                            [&_.ql-editor::-webkit-scrollbar]:w-2
                            [&_.ql-editor::-webkit-scrollbar-thumb]:bg-slate-200
                            [&_.ql-editor::-webkit-scrollbar-thumb]:rounded-full
                            [&_.ql-editor::-webkit-scrollbar-track]:bg-transparent
                          "
                />
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Tip: podés usar negrita, listas y links para que sea más legible.
              </div>
            </div>

            {/* ✅ targets (FIXED como el viejo: BranchesMultiSelect) */}
            <div className="space-y-2">
              <BranchesMultiSelect
                branches={branches}
                valueIds={targetBranchIds}
                onChangeIds={setTargetBranchIds}
                labelWhenEmpty="Sin filtro (todas)"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={save}
                disabled={loading || !title.trim() || isHtmlEmpty(contentHtml) || targetBranchIds.length === 0}
              >
                {loading ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Publicar foco'}
              </Button>
            </div>
          </div>

          {/* RIGHT: templates */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  Plantillas rápidas
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Un clic y queda armado. Después ajustás detalles.
                </div>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className={[
                        'w-full rounded-2xl border border-slate-200 bg-white p-3 text-left',
                        'hover:bg-slate-50 transition shadow-sm',
                        'relative overflow-hidden',
                        'min-h-[96px]',
                      ].join(' ')}
                      title="Aplicar plantilla"
                    >
                      <span className="absolute right-2 top-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-extrabold text-slate-700">
                        {t.tag}
                      </span>

                      <div className="flex items-start gap-3 pr-14">
                        <div className="shrink-0">
                          <div className="scale-[0.85] origin-top-left">{t.icon}</div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-sm leading-5 line-clamp-2">
                            {t.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-600 leading-4 line-clamp-1">
                            {t.desc}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  {lastTip ? (
                    <>
                      <span className="font-extrabold">Tip:</span> {lastTip}
                    </>
                  ) : (
                    <>
                      Tip: usá <span className="font-semibold">Crítico + Warning</span> cuando afecte la operación.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
