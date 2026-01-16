'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarDays,
  Pencil,
  Sparkles,
  AlertTriangle,
  GraduationCap,
  Percent,
  Trash,
  Target,
  ClipboardCheck,
  Image as ImageIcon,
  X,
  UploadCloud,
} from 'lucide-react';

import BranchesMultiSelect, { type Branch } from '@/components/focos/BranchesMultiSelect';

import {
  createFoco,
  updateFoco,
  uploadFocoAssets,
  type FocoSeverity,
  type FocoType,
} from '@/components/focos/focos.panel.api';

import 'react-quill/dist/quill.snow.css';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

export type FocoUpsertInitial = {
  focoId: string;
  title: string;
  content: string;
  severity: FocoSeverity;
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
    severity: FocoSeverity;
    content: string;
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
      ].join('\n'),
    },
  },
  {
    key: 'coverage',
    title: 'Foco de cobertura',
    desc: 'Metas por clientes / categorias',
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
      content: ['FOCO DE COBERTURA __/__/____', '', 'METAS', '- __ CLIENTES DE _____________'].join('\n'),
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
      content: ['CAPACITACION', '', 'TEMA', '- ____________________________', '', 'MATERIAL', '- Link: _______'].join('\n'),
    },
  },
  {
    key: 'critical-op',
    title: 'Crítico operativo',
    desc: 'Incidente real / instrucción firme',
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
      content: ['CRITICO OPERATIVO', '', 'PROBLEMA', '- ____________________________', '', 'ACCION', '1) ________'].join('\n'),
    },
  },
  {
    key: 'cleaning',
    title: 'Limpieza / Orden',
    desc: 'Plantilla “LIMPIAR HOY”',
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
      content: ['LIMPIAR HOY __/__/____', '', '(__) COD:_____ - ____________________________ __/__'].join('\n'),
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
function plainToHtml(plain: string) {
  const safe = escapeHtml(plain ?? '');
  return safe.replaceAll('\n', '<br/>');
}
function ensureHtml(maybeHtml: string) {
  const v = (maybeHtml ?? '').trim();
  if (!v) return '';
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(v) || v.includes('<br');
  return looksHtml ? v : plainToHtml(v);
}
function isHtmlEmpty(html: string) {
  const v = (html ?? '')
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<\/?[^>]+(>|$)/g, '')
    .replaceAll('&nbsp;', ' ')
    .trim();
  return v.length === 0;
}

// ---------- assets helpers ----------
const MAX_FILES = 5;
const MAX_MB = 6;

// ✅ compresión “opción B”
const COMPRESS_IF_OVER_MB = 1; // si pesa más de 1MB -> webp
const WEBP_QUALITY = 0.82; // 0..1
const MAX_DIMENSION = 1800; // downscale suave para promos

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap es rápido y evita <img/> + onload
  return await createImageBitmap(file);
}

function scaleToFit(w: number, h: number, maxDim: number) {
  const maxSide = Math.max(w, h);
  if (maxSide <= maxDim) return { w, h };
  const ratio = maxDim / maxSide;
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

async function compressImageToWebp(file: File): Promise<File> {
  const bmp = await fileToImageBitmap(file);
  const { w, h } = scaleToFit(bmp.width, bmp.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bmp, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY);
  });

  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], newName, { type: 'image/webp' });
}

type FileItem = {
  id: string;
  original: File;
  file: File; // puede ser el comprimido
  previewUrl: string;
};

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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
  const [uploadingAssets, setUploadingAssets] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [contentHtml, setContentHtml] = React.useState('');
  const [severity, setSeverity] = React.useState<FocoSeverity>('info');
  const [type, setType] = React.useState<FocoType>('foco');

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [targetBranchIds, setTargetBranchIds] = React.useState<number[]>([]);
  const [lastTip, setLastTip] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [items, setItems] = React.useState<FileItem[]>([]);
  const [labelsById, setLabelsById] = React.useState<Record<string, string>>({});

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

      // reset assets
      setItems((prev) => {
        prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
        return [];
      });
      setLabelsById({});
      setUploadingAssets(false);
      setLastTip(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me?.id, mode, initial]);

  function reset() {
    setTitle('');
    setContentHtml('');
    setSeverity('info');
    setType('foco');
    setTargetBranchIds(branches.map((b) => b.id));
    setLastTip(null);

    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
    setLabelsById({});
    setUploadingAssets(false);
  }

  function applyTemplate(t: Template) {
    setTitle(t.payload.title);
    setType(t.payload.type);
    setSeverity(t.payload.severity);
    setContentHtml(plainToHtml(t.payload.content));
    setLastTip(t.tip ?? null);
  }

  function pickFiles() {
    fileInputRef.current?.click();
  }

  async function addFiles(next: File[]) {
    // filtro básico
    const onlyImages = next.filter((f) => f.type?.startsWith('image/'));

    // recorta por cantidad
    const remaining = Math.max(0, MAX_FILES - items.length);
    const sliced = onlyImages.slice(0, remaining);

    // valida peso “hard limit”
    const maxBytes = MAX_MB * 1024 * 1024;
    const valid = sliced.filter((f) => f.size <= maxBytes);

    // compresión opcional (webp)
    const processed: FileItem[] = [];
    for (const f of valid) {
      let outFile = f;

      const mb = f.size / (1024 * 1024);
      if (mb > COMPRESS_IF_OVER_MB) {
        try {
          outFile = await compressImageToWebp(f);
        } catch (e) {
          console.warn('[FOCOS] compress failed, using original', e);
          outFile = f;
        }
      }

      const id = makeId();
      processed.push({
        id,
        original: f,
        file: outFile,
        previewUrl: URL.createObjectURL(outFile),
      });
    }

    setItems((prev) => [...prev, ...processed]);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    await addFiles(list);
    e.target.value = '';
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    setLabelsById((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  async function save() {
    if (!me?.id) return;
    if (!title.trim()) return;
    if (isHtmlEmpty(contentHtml)) return;
    if (targetBranchIds.length === 0) return;

    setLoading(true);
    try {
      let focoId = initial?.focoId;

      if (mode === 'create') {
        focoId = await createFoco({
          title: title.trim(),
          content: contentHtml,
          severity,
          type,
          targetBranchIds,
        });
      } else {
        if (!focoId) throw new Error('Falta focoId para editar.');
        await updateFoco({
          focoId,
          title,
          content: contentHtml,
          severity,
          type,
          targetBranchIds,
        });
      }

      // assets best-effort
      if (items.length > 0 && focoId) {
        setUploadingAssets(true);
        try {
          await uploadFocoAssets({
            focoId,
            createdBy: me.id,
            items: items.map((it) => ({
              file: it.file,
              label: (labelsById[it.id] ?? '').trim() || null,
              kind: 'image',
            })),
          });

          // limpiar previews
          setItems((prev) => {
            prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
            return [];
          });
          setLabelsById({});
        } catch (e: any) {
          console.error('[FOCOS] upload assets error', e);
          alert(`El foco se guardó, pero no se pudieron subir las imágenes: ${e?.message ?? 'Error desconocido'}`);
        } finally {
          setUploadingAssets(false);
        }
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

  const disableSave =
    loading || uploadingAssets || !title.trim() || isHtmlEmpty(contentHtml) || targetBranchIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          // ✅ responsive real (ancho + alto)
          'w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2rem)]',
          'max-w-6xl',
          'max-h-[92vh]',
          // ✅ el scroll lo maneja el body interno
          'overflow-hidden',
          // ✅ padding lo ponemos adentro
          'p-0',
        ].join(' ')}
      >
        {/* ✅ Layout interno con header sticky + body scroll + footer sticky */}
        <div className="flex max-h-[92vh] flex-col">
          {/* Header sticky */}
          <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2 text-base font-semibold">
                {mode === 'edit' ? <Pencil className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {mode === 'edit' ? 'Editar foco' : 'Crear foco'}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                disabled={loading || uploadingAssets}
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body scroll */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
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

                {/* ReactQuill (tu versión anterior) */}
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

                        [&_.ql-editor]:h-[220px]
                        sm:[&_.ql-editor]:h-[240px]
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

                {/* Importar imágenes */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">Imágenes</div>
                        <div className="text-xs text-slate-600">
                          Hasta {MAX_FILES} imágenes (máx {MAX_MB}MB c/u). Si pesan más de {COMPRESS_IF_OVER_MB}MB, se
                          comprimen a WebP automáticamente.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onFileChange}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" onClick={pickFiles} disabled={uploadingAssets}>
                        <UploadCloud className="h-4 w-4 mr-2" />
                        Importar
                      </Button>
                    </div>
                  </div>

                  {items.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-slate-200">
                      {/* ✅ scroll interno si se llena */}
                      <div className="max-h-[260px] overflow-y-auto p-2 space-y-2">
                        {items.map((it, idx) => (
                          <div
                            key={it.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2"
                          >
                            <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={it.previewUrl}
                                alt={it.file.name}
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-900">{it.file.name}</div>
                              <div className="text-xs text-slate-600">
                                {formatBytes(it.file.size)}
                                {it.file.type === 'image/webp' && it.original.type !== 'image/webp' ? (
                                  <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                    comprimida
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1">
                                <Input
                                  placeholder="Etiqueta opcional (ej: afiche, promo, lista...)"
                                  value={labelsById[it.id] ?? ''}
                                  onChange={(e) =>
                                    setLabelsById((prev) => ({
                                      ...prev,
                                      [it.id]: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(it.id)}
                              title="Quitar"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="border-t bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {items.length}/{MAX_FILES} seleccionadas
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Podés subir imágenes de <span className="font-semibold">promos, listados, material</span> o
                      capturas.
                    </div>
                  )}
                </div>

                {/* targets */}
                <div className="space-y-2">
                  <BranchesMultiSelect
                    branches={branches}
                    valueIds={targetBranchIds}
                    onChangeIds={setTargetBranchIds}
                    labelWhenEmpty="Sin filtro (todas)"
                  />
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
                    <div className="mt-2 text-sm text-slate-600">Un clic y queda armado. Después ajustás detalles.</div>
                  </div>

                  <div className="p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className={[
                            'w-full rounded-2xl border border-slate-200 bg-white p-3 text-left',
                            'hover:bg-slate-50 transition shadow-sm',
                            'relative overflow-hidden',
                            'min-h-[92px]',
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
                              <div className="mt-1 text-xs text-slate-600 leading-4 line-clamp-1">{t.desc}</div>
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
          </div>

          {/* Footer sticky */}
          <div className="sticky bottom-0 z-10 border-t bg-white/95 backdrop-blur">
            <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || uploadingAssets}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={disableSave}>
                {uploadingAssets
                  ? 'Subiendo imágenes…'
                  : loading
                    ? 'Guardando…'
                    : mode === 'edit'
                      ? 'Guardar cambios'
                      : 'Publicar foco'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
