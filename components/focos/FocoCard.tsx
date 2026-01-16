'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Loader2, ShieldAlert, Info, AlertTriangle } from 'lucide-react';
import type { FocoRow } from './focos.types';

function sevIcon(sev: string) {
  if (sev === 'critical') return <ShieldAlert className="h-4 w-4" />;
  if (sev === 'warning') return <AlertTriangle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function sevBadgeClass(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function sanitizeHtmlBasic(html: string) {
  if (!html) return '';
  let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\son\w+="[^"]*"/gi, '');
  out = out.replace(/\son\w+='[^']*'/gi, '');
  // asegura links seguros
  out = out.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return out;
}

export default function FocoCard({
  foco,
  completed,
  onToggleCompleted,
  busy,
  showCheck,
}: {
  foco: FocoRow;
  completed: boolean;
  busy: boolean;
  showCheck: boolean;
  onToggleCompleted: () => void;
}) {
  const html = sanitizeHtmlBasic(foco.content ?? '');

  const canShowCompletedButton =
    foco.type === 'foco' || foco.type === 'critico';

  return (
    <Card
      className={[
        'rounded-2xl border p-6 transition',
        showCheck && completed ? 'border-emerald-200 bg-emerald-50' : 'bg-white',
      ].join(' ')}
    >
      <div className="flex flex-col items-start justify-between gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={sevBadgeClass(foco.severity)}>
              <span className="mr-1 inline-flex items-center gap-1">
                {sevIcon(foco.severity)}
                {foco.severity}
              </span>
            </Badge>

            <Badge variant="secondary">{foco.type}</Badge>

            {foco.is_active ? (
              <Badge className="bg-emerald-600 text-white">Activo</Badge>
            ) : (
              <Badge variant="secondary">Cerrado</Badge>
            )}
          </div>

          <h3 className="mt-4 truncate text-base font-semibold">{foco.title}</h3>

          {Array.isArray(foco.targets) && foco.targets.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {foco.targets.slice(0, 6).map((t) => (
                <Badge key={t.branch_id} variant="outline">
                  {t.branch_name}
                </Badge>
              ))}
              {foco.targets.length > 6 ? (
                <Badge variant="secondary">+{foco.targets.length - 6}</Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ✅ contenido HTML con listas bien renderizadas */}
        <div
          className={[
            'w-full text-sm leading-relaxed text-foreground/90',
            // spacing de bloques típicos de Quill
            '[&>p]:my-2',
            '[&>h1]:my-2 [&>h1]:text-base [&>h1]:font-semibold',
            '[&>h2]:my-2 [&>h2]:text-base [&>h2]:font-semibold',
            '[&>h3]:my-2 [&>h3]:text-sm [&>h3]:font-semibold',
            // ✅ listas: bullets + indent (clave para tu problema)
            '[&>ul]:my-2 [&>ul]:pl-6 [&>ul]:list-disc',
            '[&>ol]:my-2 [&>ol]:pl-6 [&>ol]:list-decimal',
            '[&>ul>li]:my-1',
            '[&>ol>li]:my-1',
            // si Quill mete listas anidadas, también se ven bien
            '[&_ul]:pl-6 [&_ul]:list-disc',
            '[&_ol]:pl-6 [&_ol]:list-decimal',
            // links
            '[& a]:text-sky-700 [& a]:underline',
            // strong
            '[& strong]:font-semibold',
          ].join(' ')}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {showCheck && canShowCompletedButton ? (
          <Button
            variant={completed ? 'secondary' : 'default'}
            onClick={onToggleCompleted}
            disabled={busy || !foco.is_active}
            className="shrink-0"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </span>
            ) : completed ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Cumplido
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Marcar cumplido
              </span>
            )}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
