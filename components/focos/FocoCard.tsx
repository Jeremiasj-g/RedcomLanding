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
  showCheck: boolean,
  onToggleCompleted: () => void;
}) {
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

        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {foco.content}
        </div>

        {showCheck ? (
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
