'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Check, ChevronsUpDown, Pencil } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

import { updateFoco } from '@/components/focos/focos.panel.api';

type Branch = { id: number; name: string };

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
  const [content, setContent] = React.useState('');
  const [severity, setSeverity] = React.useState<Severity>('info');
  const [type, setType] = React.useState<FocoType>('foco');

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [targetBranchIds, setTargetBranchIds] = React.useState<number[]>([]);
  const [targetsOpen, setTargetsOpen] = React.useState(false);

  // Cargar branches + set defaults
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

      // Si edito: uso initial
      if (mode === 'edit' && initial) {
        setTitle(initial.title ?? '');
        setContent(initial.content ?? '');
        setSeverity(initial.severity ?? 'info');
        setType(initial.type ?? 'foco');
        setTargetBranchIds(initial.targetBranchIds ?? []);
      } else {
        // create defaults
        setTitle('');
        setContent('');
        setSeverity('info');
        setType('foco');
        setTargetBranchIds(list.map((b) => b.id));
      }
    })();
  }, [open, me?.id, mode, initial]);

  function reset() {
    setTitle('');
    setContent('');
    setSeverity('info');
    setType('foco');
    setTargetBranchIds(branches.map((b) => b.id));
  }

  async function save() {
    if (!me?.id) return;
    if (!title.trim() || !content.trim()) return;
    if (targetBranchIds.length === 0) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        const { data: foco, error: focoErr } = await supabase
          .from('focos')
          .insert({
            title: title.trim(),
            content: content.trim(),
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
          content,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'edit' ? <Pencil className="h-4 w-4" /> : null}
            {mode === 'edit' ? 'Editar foco' : 'Crear foco'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          <div>
            <label className="text-sm font-medium">Contenido</label>
            <textarea
              className="mt-2 w-full rounded-md border p-3 text-sm leading-relaxed"
              rows={6}
              placeholder={`Ej:\n1 unid. ...\n5 unid. ...\n`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Multi-select sucursales (NO se cierra al seleccionar) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sucursales destino</label>

            <Popover open={targetsOpen} onOpenChange={setTargetsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {targetBranchIds.length === 0
                    ? 'Seleccionar sucursales…'
                    : `${targetBranchIds.length} seleccionadas`}
                  <ChevronsUpDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandInput placeholder="Buscar sucursal…" />
                  <CommandEmpty>No se encontró.</CommandEmpty>

                  <CommandGroup>
                    {branches.map((b) => {
                      const selected = targetBranchIds.includes(b.id);
                      return (
                        <CommandItem
                          key={b.id}
                          // IMPORTANTE: evita que se cierre el popover
                          onMouseDown={(e) => e.preventDefault()}
                          onSelect={() => {
                            setTargetBranchIds((prev) =>
                              prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                            );
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
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap gap-2">
              {selectedLabels.slice(0, 8).map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
              {selectedLabels.length > 8 ? (
                <Badge variant="secondary">+{selectedLabels.length - 8} más</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={loading || !title.trim() || !content.trim() || targetBranchIds.length === 0}
            >
              {loading ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Publicar foco'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
