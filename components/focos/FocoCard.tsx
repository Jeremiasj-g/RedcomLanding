'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

type Props = {
  foco: any;
  completed: boolean;
  busy: boolean;
  showCheck: boolean;
  onToggleCompleted: () => void;
};

function sevBadge(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function typeBadge(type: string) {
  // opcional: podés mejorar colores por tipo
  return 'bg-slate-100 text-slate-800 border border-slate-200';
}

function isHtmlLike(s: string) {
  // detecta si hay tags HTML (ReactQuill guarda como <p>..</p>, <ul>..</ul>, etc.)
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export default function FocoCard({ foco, completed, busy, showCheck, onToggleCompleted }: Props) {
  const title = foco?.title ?? '';
  const severity = foco?.severity ?? 'info';
  const type = foco?.type ?? 'foco';
  const isActive = !!foco?.is_active;

  const content = (foco?.content ?? '') as string;

  // targets puede venir como array (targets: [{branch_name...}]) o como strings
  const branches: string[] = Array.isArray(foco?.targets)
    ? foco.targets.map((t: any) => t.branch_name ?? t.name).filter(Boolean)
    : Array.isArray(foco?.branches)
      ? foco.branches
      : [];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={sevBadge(severity)}>{severity}</Badge>
        <Badge variant="outline" className={typeBadge(type)}>
          {type}
        </Badge>

        {isActive ? (
          <Badge className="bg-emerald-600 text-white">Activo</Badge>
        ) : (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
            Cerrado
          </Badge>
        )}
      </div>

      {/* title */}
      <div className="mt-4">
        <div className="text-lg font-extrabold tracking-tight text-slate-900">
          {title}
        </div>

        {branches.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {branches.map((b) => (
              <span
                key={b}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {b}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* content */}
      <div className="mt-4">
        {isHtmlLike(content) ? (
          <div
            className={[
              // Tipografía general
              'text-sm text-slate-800',
              // Estilos tipo "prose" sin depender de plugin: arregla viñetas/indent
              '[&_*]:leading-relaxed',
              '[&>p]:my-2',
              '[&>h1]:my-2 [&>h1]:text-base [&>h1]:font-bold',
              '[&>h2]:my-2 [&>h2]:text-base [&>h2]:font-bold',
              '[&>h3]:my-2 [&>h3]:text-sm [&>h3]:font-bold',
              // listas
              '[&>ul]:my-2 [&>ul]:pl-6 [&>ul]:list-disc',
              '[&>ol]:my-2 [&>ol]:pl-6 [&>ol]:list-decimal',
              '[&>ul>li]:my-1',
              '[&>ol>li]:my-1',
              // si ReactQuill mete <p><br></p>
              '[&>p:empty]:hidden',
              // links
              '[& a]:text-sky-700 [& a]:underline',
              // strong
              '[& strong]:font-bold',
            ].join(' ')}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
            {content}
          </div>
        )}
      </div>

      {/* action */}
      {showCheck ? (
        <div className="mt-5">
          <Button
            onClick={onToggleCompleted}
            disabled={busy}
            className="rounded-2xl"
            variant={completed ? 'outline' : 'default'}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completed ? 'Marcar pendiente' : 'Marcar cumplido'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
