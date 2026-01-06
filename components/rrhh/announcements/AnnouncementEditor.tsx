'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

import { supabase } from '@/lib/supabaseClient';
import { useBranches } from '@/hooks/useBranches';
import { datetimeLocalToISO } from '@/utils/datetime';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useAnnouncementForm } from './useAnnouncementForm';
import { FieldCard } from './ui/FieldCard';
import { NiceCheck } from './ui/NiceCheck';
import { InlineCheck } from './ui/InlineCheck';
import { DateTimePicker } from './ui/DateTimePicker';
import { AudienceCard } from './ui/AudienceCard';

import { makeHours, makeMinutes } from './utils/datetimeLocal';
import { ROLES, TYPE_OPTIONS, SEVERITY_OPTIONS, type AnnouncementType, type Severity } from './types';

// ✅ Import del CSS (ok en client component)
import 'react-quill/dist/quill.snow.css';

// ✅ ReactQuill sin SSR (esto arregla Vercel)
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[160px] rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
  ),
});

type Props = {
  initial?: any;
  onSaved?: () => void;
};

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link'],
    ['clean'],
  ],
};

const quillFormats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'align',
  'link',
];

export function AnnouncementEditor({ initial, onSaved }: Props) {
  const { branches, loading: branchesLoading } = useBranches();
  const { state, set, audience, canSave, reset, dispatch } = useAnnouncementForm(initial);

  const hours = useMemo(() => makeHours(), []);
  const minutes = useMemo(() => makeMinutes(), []);

  const save = async () => {
    dispatch({ type: 'hydrate', payload: { saving: true, errorMsg: null } });

    try {
      const startsISO = datetimeLocalToISO(state.startsAt) ?? new Date().toISOString();
      const endsISO = datetimeLocalToISO(state.endsAt);

      if (endsISO && new Date(endsISO).getTime() < new Date(startsISO).getTime()) {
        dispatch({
          type: 'set',
          key: 'errorMsg',
          value: 'La fecha "Termina" no puede ser anterior a "Empieza".',
        });
        return;
      }

      const payload = {
        type: state.type,
        title: state.title.trim(),
        content: (state.content ?? '').trim(), // ✅ HTML
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

            <div className={state.type !== 'important_alert' ? 'mt-3 opacity-60' : 'mt-3'}>
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

          <FieldCard title="Contenido" subtitle="Texto enriquecido (se guarda en HTML)">
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <ReactQuill
                theme="snow"
                value={state.content ?? ''}
                onChange={(html: string) => set('content', html)}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Texto detallado…"
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
              Tip: podés usar títulos, listas y links.
            </div>
          </FieldCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DateTimePicker
            label="Empieza"
            value={state.startsAt}
            hours={hours}
            minutes={minutes}
            onChange={(dt) => set('startsAt', dt)}
            helper="Se interpreta como hora local del navegador."
          />

          <DateTimePicker
            label="Termina (opcional)"
            value={state.endsAt}
            hours={hours}
            minutes={minutes}
            optional
            onChange={(dt) => set('endsAt', dt)}
          />
        </div>

        <FieldCard title="Opciones" subtitle="Visibilidad y estado">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <NiceCheck label="Fijar arriba (pinned)" checked={state.pinned} onChange={(v) => set('pinned', v)} />
            <NiceCheck label="Publicado" checked={state.isPublished} onChange={(v) => set('isPublished', v)} />
            <NiceCheck label="Activo" checked={state.isActive} onChange={(v) => set('isActive', v)} />
            <div className={state.type !== 'important_alert' ? 'opacity-60' : ''}>
              <NiceCheck label="ACK (solo popup)" checked={state.requireAck} onChange={(v) => set('requireAck', v)} />
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
