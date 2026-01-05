'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Severity = 'info' | 'warning' | 'critical';
type FocoType = 'foco' | 'critico' | 'promo' | 'capacitacion';

export type FocoTemplate = {
  id: string;
  title: string;
  type: FocoType;
  severity: Severity;
  content: string;
  hint?: string;
};

const TEMPLATES: FocoTemplate[] = [
  {
    id: 'foco-dia',
    title: 'FOCO DEL DÍA',
    type: 'foco',
    severity: 'info',
    content: `Ej:
1 unid. [PRODUCTO] [ACCION]
5 unid. [PRODUCTO] [ACCION]
Objetivo: [DETALLE]`,
    hint: 'Objetivo diario',
  },
  {
    id: 'critico-descuento',
    title: 'CRÍTICO / DESCUENTOS',
    type: 'critico',
    severity: 'critical',
    content: `Ej:
FOCO DEL DÍA [FECHA]
- [PRODUCTO] [X]% desc hasta [FECHA]
- Stock / acción clave: [DETALLE]
⚠️ Prioridad: alta`,
    hint: 'Placa crítica',
  },
  {
    id: 'promo-flyer',
    title: 'PROMO / FLYER',
    type: 'promo',
    severity: 'warning',
    content: `Ej:
Promo vigente: [NOMBRE]
- Beneficio: [DETALLE]
- Condición: [DETALLE]
- Duración: [FECHA]`,
    hint: 'Material comercial',
  },
  {
    id: 'capacitacion',
    title: 'CAPACITACIÓN',
    type: 'capacitacion',
    severity: 'info',
    content: `Ej:
Tema: [TEMA]
Objetivo: [QUÉ APRENDER]
Link: [URL VIDEO]
Puntos clave:
- ...
- ...`,
    hint: 'Video / aprendizaje',
  },
];

export default function FocoTemplates({
  onApply,
}: {
  onApply: (t: FocoTemplate) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Plantillas</p>
          <p className="text-xs text-muted-foreground">Cargá rápido un formato y editá los campos.</p>
        </div>
        <Badge variant="secondary">{TEMPLATES.length} disponibles</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => onApply(t)}
          >
            {t.title}
            {t.hint ? <span className="ml-2 text-xs text-muted-foreground">• {t.hint}</span> : null}
          </Button>
        ))}
      </div>
    </div>
  );
}
