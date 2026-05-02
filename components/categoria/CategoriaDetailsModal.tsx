'use client';

import React, { useEffect, useMemo, useState } from 'react';

import {
  CATEGORIAS,
  getCategoriaByKey,
  PUNTOS,
  CATEGORIA_RANK,
  type CategoriaKey,
  normalizeCategoriaKey,
} from '@/utils/categories';

import type { VendedorCategoriaRow } from '@/hooks/useCategoriasVendedores';
import { parseBoolTF, parseFloatSafe, parseIntSafe } from '@/utils/vendors/parsers';
import { hmsToSeconds } from '@/utils/vendors/time';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: VendedorCategoriaRow | null;
};

type TabKey = 'comparacion' | 'datos';

type Computed = {
  eficiencia: number;
  efectividad: number;
  pop: number;
  exhib: number;
  cobertura: number;
  volumen: number;
  cumpleHorario: boolean;
  cumpleEfectividad: boolean;

  categoriaAlcanzadaKey: CategoriaKey;
  proyeccionKey: CategoriaKey;

  horasRutaStr: string;
  horasRutaSec: number;
  mix: number;
};

type Categoria = (typeof CATEGORIAS)[number];

type PdfMetric = {
  label: string;
  requerido: string;
  alcanzado: string;
  puntos: number;
};

type PdfKpi = {
  title: string;
  value: string;
  lines: string[];
  formula: string;
};

const PDF_COLORS = {
  text: '#0f172a',
  muted: '#64748b',
  border: '#dbe3ef',
  borderSoft: '#e8eef6',
  surface: '#ffffff',
  soft: '#f8fafc',
  soft2: '#f1f5f9',
  red: '#ef4444',
  redDark: '#dc2626',
  green: '#059669',
  blue: '#0284c7',
  blueSoft: '#e0f2fe',
};

const PDF_CATEGORY_COLORS: Record<string, string> = {
  PLAN_MEJORA: '#ef4444',
  JUNIOR: '#eab308',
  SEMI_SENIOR: '#34d399',
  SENIOR: '#047857',
};

export default function CategoriaDetailsModal({ open, onOpenChange, row }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('comparacion');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (open) setActiveTab('comparacion');
  }, [open, row?.id]);

  const computed = useMemo<Computed | null>(() => {
    if (!row) return null;

    const categoriaAlcanzadaKey = normalizeCategoriaKey(
      (row as any).categoriaKey ?? (row as any).Categoria_alcanzada
    );

    const proyeccionKey = normalizeCategoriaKey((row as any).Categoria_segun_proyeccion);

    return {
      eficiencia: parseFloatSafe((row as any).eficiencia),
      efectividad: parseFloatSafe((row as any).efectividad),
      pop: parseFloatSafe((row as any)['%_POP']),
      exhib: parseFloatSafe((row as any)['%_Exhibición']),
      mix: parseFloatSafe(
        (row as any).mix ??
          (row as any).Mix ??
          (row as any)['%_Mix'] ??
          (row as any)['% Mix']
      ),
      cobertura: parseIntSafe((row as any).cobertura),
      volumen: parseIntSafe((row as any).volumen),
      cumpleHorario: parseBoolTF((row as any).cumple_horario_ruta),
      cumpleEfectividad: parseBoolTF((row as any).cumple_efectividad),

      categoriaAlcanzadaKey,
      proyeccionKey,

      horasRutaStr: String((row as any).horas_promedio_ruta ?? ''),
      horasRutaSec: hmsToSeconds(String((row as any).horas_promedio_ruta ?? '0:00:00')),
    };
  }, [row]);

  const handleDownloadPdf = async () => {
    if (!row || !computed || isDownloadingPdf) return;

    setIsDownloadingPdf(true);

    try {
      await downloadCategoriaPdf({ row, computed, activeTab });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      window.alert('No se pudo generar el PDF. Intentá nuevamente.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!open || !row || !computed) return null;

  const alcanzada = getCategoriaByKey(computed.categoriaAlcanzadaKey);

  const baseReq = getCategoriaByKey('JUNIOR');
  const okHorario = computed.horasRutaSec >= hmsToSeconds(baseReq.horas_ruta_min);
  const okEfect = computed.efectividad >= baseReq.efectividad_min;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />

      <div className="absolute left-1/2 top-1/2 w-[min(1200px,92vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-center gap-4 relative">
            <div className="flex items-center justify-center gap-4 pr-44">
              <div className="text-2xl font-extrabold text-slate-900">
                Análisis de {(row as any).vendedor}
              </div>

              <div className="mt-1 inline-flex items-center gap-2">
                <span
                  className={[
                    'px-2 py-1 mb-2 rounded-md text-xs font-bold text-white',
                    alcanzada.color.bg.replace(/\/\d+$/, ''),
                  ].join(' ')}
                >
                  {alcanzada.label.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="absolute right-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="rounded-lg px-3 py-2 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloadingPdf ? 'Generando...' : 'Descargar PDF'}
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-3 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="mt-6 justify-center flex gap-8 text-sm">
            <div className="text-center">
              <div className="text-slate-500">Horario requerido: {baseReq.horas_ruta_min}</div>
              <div
                className={
                  okHorario ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'
                }
              >
                Alcanzado: {computed.horasRutaStr} {okHorario ? '✓' : '✕'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-slate-500">
                Efectividad requerida: {baseReq.efectividad_min}%
              </div>
              <div
                className={
                  okEfect ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'
                }
              >
                Alcanzado: {computed.efectividad.toFixed(2)}% {okEfect ? '✓' : '✕'}
              </div>
            </div>
          </div>
        </div>

        <div
          className="
            p-6 overflow-y-auto max-h-[calc(85vh-84px)]
            pb-24 sm:pb-6
            [padding-bottom:calc(6rem+env(safe-area-inset-bottom))]
            sm:[padding-bottom:1.5rem]
          "
        >
          <div className="mb-6 flex justify-center">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('comparacion')}
                className={[
                  'px-4 py-2 text-sm font-semibold rounded-xl transition',
                  activeTab === 'comparacion'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                Comparación
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('datos')}
                className={[
                  'px-4 py-2 text-sm font-semibold rounded-xl transition',
                  activeTab === 'datos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                Datos + Cálculos
              </button>
            </div>
          </div>

          {activeTab === 'comparacion' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {CATEGORIAS.map((cat) => (
                <CompareColumn key={cat.key} cat={cat} computed={computed} />
              ))}
            </div>
          ) : (
            <FullDataSection row={row} computed={computed} />
          )}

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="rounded-lg px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareColumn({ cat, computed }: { cat: Categoria; computed: Computed }) {
  const result = getCategoriaComparison(cat, computed);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <span
          className={[
            'px-2 py-1 rounded-md text-xs font-bold text-white',
            (cat as any).color.bg.replace(/\/\d+$/, ''),
          ].join(' ')}
        >
          {(cat as any).label.toUpperCase()}
        </span>

        <div className="text-xs text-slate-500">
          TOTAL PUNTOS{' '}
          <span className="font-bold text-slate-900">
            {formatNumber(result.total)}/{(cat as any).total}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <RowProjection
          required={String((cat as any).facturacion).replaceAll('_', ' ')}
          got={String(computed.proyeccionKey).replaceAll('_', ' ')}
          earned={result.metrics[0].puntos}
        />

        <RowCompare
          label="Eficiencia"
          req={`${(cat as any).eficiencia}%`}
          got={`${computed.eficiencia.toFixed(2)}%`}
          earned={result.metrics[1].puntos}
        />

        <RowCompare
          label="Cobertura"
          req={(cat as any).cobertura}
          got={computed.cobertura}
          earned={result.metrics[2].puntos}
        />

        <RowCompare
          label="Volumen"
          req={(cat as any).volumen}
          got={computed.volumen}
          earned={result.metrics[3].puntos}
        />

        <RowCompare
          label="% POP"
          req={`${(cat as any).pop}%`}
          got={`${computed.pop.toFixed(2)}%`}
          earned={result.metrics[4].puntos}
        />

        <RowCompare
          label="% Exhibición"
          req={`${(cat as any).exhibicion}%`}
          got={`${computed.exhib.toFixed(2)}%`}
          earned={result.metrics[5].puntos}
        />

        <RowCompare
          label="Mix"
          req={`${(cat as any).mix}%`}
          got={`${computed.mix.toFixed(2)}%`}
          earned={result.metrics[6].puntos}
        />
      </div>
    </div>
  );
}

function RowProjection({
  required,
  got,
  earned,
}: {
  required: string;
  got: string;
  earned: number;
}) {
  const ok = earned > 0;

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">Facturación esperada</div>
        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md font-bold">
          {earned > 0 ? `+${formatNumber(earned)}` : '0'}
        </span>
      </div>

      <div className="mt-1 text-xs text-slate-600">Requerido: {required}</div>

      <div className="text-xs">
        Alcanzado:{' '}
        <span className={ok ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
          {got}
        </span>
      </div>
    </div>
  );
}

function RowCompare({
  label,
  req,
  got,
  earned,
}: {
  label: string;
  req: React.ReactNode;
  got: React.ReactNode;
  earned: number;
}) {
  const ok = earned > 0;

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">{label}</div>
        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md font-bold">
          {earned > 0 ? `+${formatNumber(earned)}` : '0'}
        </span>
      </div>

      <div className="mt-1 text-xs text-slate-600">Requerido: {req}</div>

      <div className="text-xs">
        Alcanzado:{' '}
        <span className={ok ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
          {got}
        </span>
      </div>
    </div>
  );
}

function FullDataSection({ row, computed }: { row: VendedorCategoriaRow; computed: Computed }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiExplainCard
          title="Efectividad"
          value={`${computed.efectividad.toFixed(2)}%`}
          kpis={[
            { label: 'Visitas Planeadas', value: (row as any).visitas_planeadas },
            { label: 'Visitados', value: (row as any).visitados },
          ]}
          formula="(visitados / visitas planeadas) * 100"
        />

        <KpiExplainCard
          title="Eficiencia"
          value={`${computed.eficiencia.toFixed(2)}%`}
          kpis={[
            { label: 'Visitados', value: (row as any).visitados },
            { label: 'Total de Ventas', value: (row as any).total_de_ventas },
          ]}
          formula="(ventas / visitados) * 100"
        />

        <KpiExplainCard
          title="% Ventas en PDV"
          value={(row as any).porcentaje_de_ventas_en_el_PDV}
          kpis={[
            { label: 'Total de Ventas', value: (row as any).total_de_ventas },
            { label: 'Venta en el PDV', value: (row as any).venta_en_el_pdv },
          ]}
          formula="(ventas pdv / total ventas) * 100"
        />

        <KpiExplainCard
          title="% Ventas a Distancia"
          value={(row as any).porcentaje_de_ventas_a_distancia}
          kpis={[
            { label: 'Visitas Planeadas', value: (row as any).visitas_planeadas },
            { label: 'Venta a Distancia', value: (row as any).venta_a_distancia },
          ]}
          formula="(ventas distancia / visitas planeadas) * 100"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">Resumen del vendedor</div>
            <div className="text-sm text-slate-500">KPIs base + datos para cálculos</div>
          </div>

          <div className="text-xs text-slate-500">
            ID: <span className="font-semibold text-slate-900">{(row as any).id}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard title="Facturación" value={(row as any).facturacion} hint="Total facturado" />
          <StatCard
            title="Total de ventas"
            value={(row as any).total_de_ventas}
            hint="Boletas / ventas registradas"
          />
          <StatCard title="Visitados" value={(row as any).visitados} hint="Clientes visitados" />
          <StatCard
            title="Visitas planeadas"
            value={(row as any).visitas_planeadas}
            hint="Objetivo de visitas"
          />
          <StatCard
            title="Venta a distancia"
            value={(row as any).venta_a_distancia}
            hint="Ventas sin PDV"
          />
          <StatCard
            title="Venta en el PDV"
            value={(row as any).venta_en_el_pdv}
            hint="Ventas en punto de venta"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="text-lg font-extrabold text-slate-900">Datos de Facturación</div>
        <div className="text-sm text-slate-500">Promedios y datos considerados del período</div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <BentoCard title="Días considerados" value={(row as any).dias_considerados} />
          <BentoCard
            title="Promedio boletas diarias"
            value={(row as any).promedio_boletas_diarias}
          />
          <BentoCard title="Facturación promedio" value={(row as any).facturacion_promedio} />
          <BentoCard title="Promedio $ boletas" value={(row as any)['promedio_$_boletas']} />
          <BentoCard
            title="Categoría según proyección"
            value={String(computed.proyeccionKey).replaceAll('_', ' ')}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, hint }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function BentoCard({ title, value }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-base font-bold text-slate-900 truncate">{value}</div>
    </div>
  );
}

function KpiExplainCard({ title, value, kpis, formula }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-900">{value}</div>

      <div className="mt-4 space-y-1 text-sm text-slate-600">
        {kpis.map((k: any) => (
          <div key={k.label} className="flex items-center gap-2">
            <span>{k.label}:</span>
            <span className="font-semibold text-slate-900">{k.value}</span>
          </div>
        ))}
        <br />
        <code className="text-xs">{formula}</code>
      </div>
    </div>
  );
}

function getCategoriaComparison(cat: Categoria, computed: Computed) {
  const facturacionKey = normalizeCategoriaKey((cat as any).facturacion);

  const puntosFacturacion =
    CATEGORIA_RANK[computed.proyeccionKey] >= CATEGORIA_RANK[facturacionKey]
      ? PUNTOS.FACTURACION
      : 0;

  const puntosEficiencia = computed.eficiencia >= (cat as any).eficiencia ? PUNTOS.EFICIENCIA : 0;
  const puntosCobertura = computed.cobertura >= (cat as any).cobertura ? PUNTOS.COBERTURA : 0;
  const puntosVolumen = computed.volumen >= (cat as any).volumen ? PUNTOS.VOLUMEN : 0;
  const puntosPop = computed.pop >= (cat as any).pop ? PUNTOS.POP : 0;
  const puntosExhib = computed.exhib >= (cat as any).exhibicion ? PUNTOS.EXHIBICION : 0;
  const puntosMix = computed.mix >= (cat as any).mix ? (PUNTOS as any).MIX ?? 0 : 0;

  const metrics: PdfMetric[] = [
    {
      label: 'Facturación esperada',
      requerido: String((cat as any).facturacion).replaceAll('_', ' '),
      alcanzado: String(computed.proyeccionKey).replaceAll('_', ' '),
      puntos: puntosFacturacion,
    },
    {
      label: 'Eficiencia',
      requerido: `${(cat as any).eficiencia}%`,
      alcanzado: `${computed.eficiencia.toFixed(2)}%`,
      puntos: puntosEficiencia,
    },
    {
      label: 'Cobertura',
      requerido: String((cat as any).cobertura),
      alcanzado: String(computed.cobertura),
      puntos: puntosCobertura,
    },
    {
      label: 'Volumen',
      requerido: String((cat as any).volumen),
      alcanzado: String(computed.volumen),
      puntos: puntosVolumen,
    },
    {
      label: '% POP',
      requerido: `${(cat as any).pop}%`,
      alcanzado: `${computed.pop.toFixed(2)}%`,
      puntos: puntosPop,
    },
    {
      label: '% Exhibición',
      requerido: `${(cat as any).exhibicion}%`,
      alcanzado: `${computed.exhib.toFixed(2)}%`,
      puntos: puntosExhib,
    },
    {
      label: 'Mix',
      requerido: `${(cat as any).mix}%`,
      alcanzado: `${computed.mix.toFixed(2)}%`,
      puntos: puntosMix,
    },
  ];

  return {
    metrics,
    total: metrics.reduce((acc, metric) => acc + metric.puntos, 0),
  };
}

async function downloadCategoriaPdf({
  row,
  computed,
  activeTab,
}: {
  row: VendedorCategoriaRow;
  computed: Computed;
  activeTab: TabKey;
}) {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;

  pdf.setProperties({
    title: `Análisis de ${asText((row as any).vendedor)}`,
    subject: 'Análisis de categorías',
    creator: 'RedcomLanding',
  });

  drawPdfHeader(pdf, {
    x: margin,
    y: margin,
    width: contentWidth,
    row,
    computed,
  });

  if (activeTab === 'comparacion') {
    drawComparacionPdf(pdf, {
      x: margin,
      y: 48,
      width: contentWidth,
      computed,
    });
  } else {
    drawDatosPdf(pdf, {
      x: margin,
      y: 48,
      width: contentWidth,
      pageHeight,
      margin,
      row,
      computed,
    });
  }

  drawPdfFooter(pdf, pageWidth, pageHeight, margin);

  const vendedor = sanitizeFileName(String((row as any).vendedor ?? 'vendedor'));
  const tab = activeTab === 'comparacion' ? 'comparacion' : 'datos-calculos';

  pdf.save(`analisis-${vendedor}-${tab}.pdf`);
}

function drawPdfHeader(
  pdf: any,
  {
    x,
    y,
    width,
    row,
    computed,
  }: {
    x: number;
    y: number;
    width: number;
    row: VendedorCategoriaRow;
    computed: Computed;
  }
) {
  const baseReq = getCategoriaByKey('JUNIOR');
  const alcanzada = getCategoriaByKey(computed.categoriaAlcanzadaKey);

  const okHorario = computed.horasRutaSec >= hmsToSeconds(baseReq.horas_ruta_min);
  const okEfect = computed.efectividad >= baseReq.efectividad_min;

  drawCard(pdf, x, y, width, 33, {
    radius: 5,
    fill: PDF_COLORS.surface,
    stroke: PDF_COLORS.border,
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(`Análisis de ${asText((row as any).vendedor)}`, x + 6, y + 10);

  const badgeLabel = alcanzada.label.toUpperCase();
  const badgeWidth = Math.max(28, pdf.getTextWidth(badgeLabel) + 8);
  drawBadge(pdf, x + width - badgeWidth - 6, y + 5.4, badgeWidth, 7, badgeLabel, {
    bg: PDF_CATEGORY_COLORS[computed.categoriaAlcanzadaKey] ?? PDF_COLORS.red,
    fg: '#ffffff',
    fontSize: 7,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text(`ID: ${asText((row as any).id)}`, x + width - 6, y + 17, { align: 'right' });

  const statusY = y + 19.5;
  const statusWidth = (width - 18) / 2;

  drawStatusPill(pdf, x + 6, statusY, statusWidth, {
    title: `Horario requerido: ${baseReq.horas_ruta_min}`,
    value: `Alcanzado: ${computed.horasRutaStr || '-'}`,
    ok: okHorario,
  });

  drawStatusPill(pdf, x + 12 + statusWidth, statusY, statusWidth, {
    title: `Efectividad requerida: ${baseReq.efectividad_min}%`,
    value: `Alcanzado: ${computed.efectividad.toFixed(2)}%`,
    ok: okEfect,
  });
}

function drawComparacionPdf(
  pdf: any,
  { x, y, width, computed }: { x: number; y: number; width: number; computed: Computed }
) {
  const columnGap = 5;
  const columnWidth = (width - columnGap * 2) / 3;
  const categories = CATEGORIAS.slice(0, 3);

  categories.forEach((cat, index) => {
    const columnX = x + index * (columnWidth + columnGap);
    drawCategoryPdfColumn(pdf, columnX, y, columnWidth, cat, computed);
  });
}

function drawCategoryPdfColumn(
  pdf: any,
  x: number,
  y: number,
  width: number,
  cat: Categoria,
  computed: Computed
) {
  const headerHeight = 13;
  const metricHeight = 15.7;
  const metricGap = 3;
  const padding = 4;
  const comparison = getCategoriaComparison(cat, computed);
  const totalHeight = headerHeight + padding + comparison.metrics.length * metricHeight +
    (comparison.metrics.length - 1) * metricGap + padding;

  drawCard(pdf, x, y, width, totalHeight, {
    radius: 5,
    fill: PDF_COLORS.surface,
    stroke: PDF_COLORS.border,
  });

  setStroke(pdf, PDF_COLORS.border);
  pdf.line(x, y + headerHeight, x + width, y + headerHeight);

  drawBadge(pdf, x + 4, y + 3.2, 25, 6.5, String((cat as any).label).toUpperCase(), {
    bg: PDF_CATEGORY_COLORS[(cat as any).key] ?? PDF_COLORS.blue,
    fg: '#ffffff',
    fontSize: 6.2,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.6);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text('TOTAL PUNTOS', x + width - 24, y + 5.4);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(`${formatNumber(comparison.total)}/${(cat as any).total}`, x + width - 4, y + 9, {
    align: 'right',
  });

  let metricY = y + headerHeight + padding;

  comparison.metrics.forEach((metric) => {
    drawMetricPdfCard(pdf, x + padding, metricY, width - padding * 2, metricHeight, metric);
    metricY += metricHeight + metricGap;
  });
}

function drawMetricPdfCard(pdf: any, x: number, y: number, width: number, height: number, metric: PdfMetric) {
  const ok = metric.puntos > 0;

  drawCard(pdf, x, y, width, height, {
    radius: 4,
    fill: PDF_COLORS.soft,
    stroke: PDF_COLORS.borderSoft,
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.3);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(metric.label, x + 3.3, y + 5.2, {
    maxWidth: width - 18,
  });

  drawBadge(pdf, x + width - 10.5, y + 3.4, 7, 5.2, metric.puntos > 0 ? `+${formatNumber(metric.puntos)}` : '0', {
    bg: PDF_COLORS.blueSoft,
    fg: PDF_COLORS.blue,
    fontSize: 6,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.4);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text(`Requerido: ${metric.requerido}`, x + 3.3, y + 9.7, {
    maxWidth: width - 6,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.4);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text('Alcanzado:', x + 3.3, y + 13.1);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(ok ? PDF_COLORS.green : PDF_COLORS.redDark);
  pdf.text(metric.alcanzado, x + 16.2, y + 13.1, {
    maxWidth: width - 19,
  });
}

function drawDatosPdf(
  pdf: any,
  {
    x,
    y,
    width,
    pageHeight,
    margin,
    row,
    computed,
  }: {
    x: number;
    y: number;
    width: number;
    pageHeight: number;
    margin: number;
    row: VendedorCategoriaRow;
    computed: Computed;
  }
) {
  let cursorY = y;

  const kpis: PdfKpi[] = [
    {
      title: 'Efectividad',
      value: `${computed.efectividad.toFixed(2)}%`,
      lines: [
        `Visitas Planeadas: ${asText((row as any).visitas_planeadas)}`,
        `Visitados: ${asText((row as any).visitados)}`,
      ],
      formula: '(visitados / visitas planeadas) * 100',
    },
    {
      title: 'Eficiencia',
      value: `${computed.eficiencia.toFixed(2)}%`,
      lines: [
        `Visitados: ${asText((row as any).visitados)}`,
        `Total de Ventas: ${asText((row as any).total_de_ventas)}`,
      ],
      formula: '(ventas / visitados) * 100',
    },
    {
      title: '% Ventas en PDV',
      value: asText((row as any).porcentaje_de_ventas_en_el_PDV),
      lines: [
        `Total de Ventas: ${asText((row as any).total_de_ventas)}`,
        `Venta en el PDV: ${asText((row as any).venta_en_el_pdv)}`,
      ],
      formula: '(ventas pdv / total ventas) * 100',
    },
    {
      title: '% Ventas a Distancia',
      value: asText((row as any).porcentaje_de_ventas_a_distancia),
      lines: [
        `Visitas Planeadas: ${asText((row as any).visitas_planeadas)}`,
        `Venta a Distancia: ${asText((row as any).venta_a_distancia)}`,
      ],
      formula: '(ventas distancia / visitas planeadas) * 100',
    },
  ];

  const kpiGap = 4;
  const kpiWidth = (width - kpiGap * 3) / 4;
  const kpiHeight = 35;

  kpis.forEach((kpi, index) => {
    drawKpiPdfCard(pdf, x + index * (kpiWidth + kpiGap), cursorY, kpiWidth, kpiHeight, kpi);
  });

  cursorY += kpiHeight + 7;

  const summary = [
    { title: 'Facturación', value: asText((row as any).facturacion), hint: 'Total facturado' },
    { title: 'Total de ventas', value: asText((row as any).total_de_ventas), hint: 'Boletas / ventas registradas' },
    { title: 'Visitados', value: asText((row as any).visitados), hint: 'Clientes visitados' },
    { title: 'Visitas planeadas', value: asText((row as any).visitas_planeadas), hint: 'Objetivo de visitas' },
    { title: 'Venta a distancia', value: asText((row as any).venta_a_distancia), hint: 'Ventas sin PDV' },
    { title: 'Venta en el PDV', value: asText((row as any).venta_en_el_pdv), hint: 'Ventas en punto de venta' },
  ];

  cursorY = drawPdfSection(pdf, {
    x,
    y: cursorY,
    width,
    title: 'Resumen del vendedor',
    subtitle: 'KPIs base + datos para cálculos',
    items: summary,
    columns: 3,
  });

  cursorY += 6;

  const facturacion = [
    { title: 'Días considerados', value: asText((row as any).dias_considerados) },
    { title: 'Promedio boletas diarias', value: asText((row as any).promedio_boletas_diarias) },
    { title: 'Facturación promedio', value: asText((row as any).facturacion_promedio) },
    { title: 'Promedio $ boletas', value: asText((row as any)['promedio_$_boletas']) },
    { title: 'Categoría según proyección', value: String(computed.proyeccionKey).replaceAll('_', ' ') },
  ];

  if (cursorY + 42 > pageHeight - margin) {
    pdf.addPage('a4', 'landscape');
    cursorY = margin;
  }

  drawPdfSection(pdf, {
    x,
    y: cursorY,
    width,
    title: 'Datos de Facturación',
    subtitle: 'Promedios y datos considerados del período',
    items: facturacion,
    columns: 5,
  });
}

function drawKpiPdfCard(pdf: any, x: number, y: number, width: number, height: number, kpi: PdfKpi) {
  drawCard(pdf, x, y, width, height, {
    radius: 5,
    fill: PDF_COLORS.surface,
    stroke: PDF_COLORS.border,
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.3);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(kpi.title, x + 3.5, y + 5.7, { maxWidth: width - 7 });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(kpi.value || '-', x + 3.5, y + 13.5, { maxWidth: width - 7 });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.2);
  pdf.setTextColor(PDF_COLORS.muted);

  kpi.lines.forEach((line, index) => {
    pdf.text(line, x + 3.5, y + 20 + index * 3.6, { maxWidth: width - 7 });
  });

  drawCard(pdf, x + 3.5, y + height - 8, width - 7, 5, {
    radius: 2.5,
    fill: PDF_COLORS.soft,
    stroke: PDF_COLORS.borderSoft,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.8);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text(kpi.formula, x + 5.5, y + height - 4.6, { maxWidth: width - 11 });
}

function drawPdfSection(
  pdf: any,
  {
    x,
    y,
    width,
    title,
    subtitle,
    items,
    columns,
  }: {
    x: number;
    y: number;
    width: number;
    title: string;
    subtitle: string;
    items: { title: string; value: string; hint?: string }[];
    columns: number;
  }
) {
  const gap = 4;
  const itemHeight = 19;
  const itemWidth = (width - gap * (columns - 1) - 8) / columns;
  const rows = Math.ceil(items.length / columns);
  const sectionHeight = 20 + rows * itemHeight + (rows - 1) * gap + 6;

  drawCard(pdf, x, y, width, sectionHeight, {
    radius: 5,
    fill: PDF_COLORS.surface,
    stroke: PDF_COLORS.border,
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.2);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(title, x + 4.5, y + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text(subtitle, x + 4.5, y + 11.3);

  let itemY = y + 16;

  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const itemX = x + 4 + column * (itemWidth + gap);
    const currentY = itemY + row * (itemHeight + gap);

    drawMiniStatPdf(pdf, itemX, currentY, itemWidth, itemHeight, item);
  });

  return y + sectionHeight;
}

function drawMiniStatPdf(
  pdf: any,
  x: number,
  y: number,
  width: number,
  height: number,
  item: { title: string; value: string; hint?: string }
) {
  drawCard(pdf, x, y, width, height, {
    radius: 4,
    fill: PDF_COLORS.soft,
    stroke: PDF_COLORS.border,
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.3);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text(item.title, x + 3, y + 5, { maxWidth: width - 6 });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.2);
  pdf.setTextColor(PDF_COLORS.text);
  pdf.text(item.value || '-', x + 3, y + 10.7, { maxWidth: width - 6 });

  if (item.hint) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.8);
    pdf.setTextColor(PDF_COLORS.muted);
    pdf.text(item.hint, x + 3, y + 15.3, { maxWidth: width - 6 });
  }
}

function drawStatusPill(
  pdf: any,
  x: number,
  y: number,
  width: number,
  {
    title,
    value,
    ok,
  }: {
    title: string;
    value: string;
    ok: boolean;
  }
) {
  drawCard(pdf, x, y, width, 9, {
    radius: 4,
    fill: PDF_COLORS.soft,
    stroke: PDF_COLORS.borderSoft,
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.6);
  pdf.setTextColor(PDF_COLORS.muted);
  pdf.text(title, x + 3, y + 3.8);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(ok ? PDF_COLORS.green : PDF_COLORS.redDark);
  pdf.text(`${value} ${ok ? 'OK' : 'NO'}`, x + width - 3, y + 3.8, { align: 'right' });
}

function drawBadge(
  pdf: any,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  { bg, fg, fontSize }: { bg: string; fg: string; fontSize: number }
) {
  setFill(pdf, bg);
  pdf.roundedRect(x, y, width, height, 1.8, 1.8, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(fg);
  pdf.text(label, x + width / 2, y + height / 2 + fontSize * 0.13, {
    align: 'center',
    baseline: 'middle',
  });
}

function drawCard(
  pdf: any,
  x: number,
  y: number,
  width: number,
  height: number,
  {
    radius,
    fill,
    stroke,
  }: {
    radius: number;
    fill: string;
    stroke: string;
  }
) {
  setFill(pdf, fill);
  setStroke(pdf, stroke);
  pdf.setLineWidth(0.18);
  pdf.roundedRect(x, y, width, height, radius, radius, 'FD');
}

function drawPdfFooter(pdf: any, pageWidth: number, pageHeight: number, margin: number) {
  const totalPages = pdf.getNumberOfPages();
  const generatedAt = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  for (let index = 1; index <= totalPages; index += 1) {
    pdf.setPage(index);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(PDF_COLORS.muted);
    pdf.text(`Generado: ${generatedAt}`, margin, pageHeight - 3.5);
    pdf.text(`Página ${index}/${totalPages}`, pageWidth - margin, pageHeight - 3.5, {
      align: 'right',
    });
  }
}

function setFill(pdf: any, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  pdf.setFillColor(r, g, b);
}

function setStroke(pdf: any, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  pdf.setDrawColor(r, g, b);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return [r, g, b];
}

function asText(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}
