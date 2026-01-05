'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';

import MultiSelectBranches from '@/components/focos/MultiSelectBranches';
import FocoTemplates, { FocoTemplate } from '@/components/focos/FocoTemplates';
import BranchesMultiSelect, { Branch } from '@/components/focos/BranchesMultiSelect';


export default function PanelFocoCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}) {
  const { me } = useMe();

  const [loading, setLoading] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [severity, setSeverity] = React.useState<'info' | 'warning' | 'critical'>('info');
  const [type, setType] = React.useState<'foco' | 'critico' | 'promo' | 'capacitacion'>('foco');

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [targetBranchIds, setTargetBranchIds] = React.useState<number[]>([]);
  const [targetsOpen, setTargetsOpen] = React.useState(false);

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

      // default: todas seleccionadas (podés cambiarlo si querés)
      setTargetBranchIds(list.map((b) => b.id));
    })();
  }, [open, me?.id]);

  function reset() {
    setTitle('');
    setContent('');
    setSeverity('info');
    setType('foco');
    setTargetBranchIds(branches.map((b) => b.id));
  }

  function applyTemplate(t: FocoTemplate) {
    setTitle(t.title);
    setType(t.type);
    setSeverity(t.severity);
    setContent(t.content);
  }

  async function create() {
    if (!me?.id) return;
    if (!title.trim() || !content.trim()) return;
    if (targetBranchIds.length === 0) return;

    setLoading(true);
    try {
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

      onCreated?.();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      console.error('[FOCOS] create foco error', e);
      alert(`No se pudo crear el foco: ${e?.message ?? 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear foco</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ✅ Plantillas tipo RRHH */}
          <FocoTemplates onApply={applyTemplate} />

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
              Vigencia: por ahora “hasta nuevo aviso” (después le metemos rango)
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Contenido</label>
            <textarea
              className="mt-2 w-full rounded-md border p-3 text-sm leading-relaxed"
              rows={6}
              placeholder={`Ej:\n1 unid. YULI FREIR 50% desc\n5 unid. PIPORINO TAPA FREIR 50%...\n`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* ✅ Multi select FIXED */}
          <BranchesMultiSelect
            branches={branches}
            valueIds={targetBranchIds}
            onChangeIds={setTargetBranchIds}
            labelWhenEmpty="Sin filtro (todas)"
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={create}
              disabled={loading || !title.trim() || !content.trim() || targetBranchIds.length === 0}
            >
              {loading ? 'Publicando…' : 'Publicar foco'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
