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

// ✅ Tipo real de cada categoria del array
type Categoria = (typeof CATEGORIAS)[number];

export default function CategoriaDetailsModal({ open, onOpenChange, row }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('comparacion');

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

  if (!open || !row || !computed) return null;

  const alcanzada = getCategoriaByKey(computed.categoriaAlcanzadaKey);

  const baseReq = getCategoriaByKey('JUNIOR'); // tiene 5:20:00 y 89
  const okHorario = computed.horasRutaSec >= hmsToSeconds(baseReq.horas_ruta_min);
  const okEfect = computed.efectividad >= baseReq.efectividad_min;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />

      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[min(1200px,92vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-center gap-4 relative">
            <div className="flex items-center justify-center gap-4">
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

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute rounded-lg px-3 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800 right-0"
            >
              Cerrar
            </button>
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

        {/* ✅ FIX MOBILE: padding-bottom extra + safe-area */}
        <div
          className="
            p-6 overflow-y-auto max-h-[calc(85vh-84px)]
            pb-24 sm:pb-6
            [padding-bottom:calc(6rem+env(safe-area-inset-bottom))]
            sm:[padding-bottom:1.5rem]
          "
        >
          {/* tabs */}
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

          {/* footer */}
          <div className="mt-6 flex justify-center">
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

  const puntosAlcanzados =
    puntosFacturacion + puntosEficiencia + puntosCobertura + puntosVolumen + puntosPop + puntosExhib + puntosMix;

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
            {puntosAlcanzados}/{(cat as any).total}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <RowProjection
          required={String((cat as any).facturacion).replaceAll('_', ' ')}
          got={String(computed.proyeccionKey).replaceAll('_', ' ')}
          earned={puntosFacturacion}
        />

        <RowCompare
          label="Eficiencia"
          req={`${(cat as any).eficiencia}%`}
          got={`${computed.eficiencia.toFixed(2)}%`}
          earned={puntosEficiencia}
        />
        <RowCompare label="Cobertura" req={(cat as any).cobertura} got={computed.cobertura} earned={puntosCobertura} />
        <RowCompare label="Volumen" req={(cat as any).volumen} got={computed.volumen} earned={puntosVolumen} />
        <RowCompare label="% POP" req={`${(cat as any).pop}%`} got={`${computed.pop.toFixed(2)}%`} earned={puntosPop} />
        <RowCompare
          label="% Exhibición"
          req={`${(cat as any).exhibicion}%`}
          got={`${computed.exhib.toFixed(2)}%`}
          earned={puntosExhib}
        />
        <RowCompare label="Mix" req={`${(cat as any).mix}%`} got={`${computed.mix.toFixed(2)}%`} earned={puntosMix} />
      </div>
    </div>
  );
}

function RowProjection({ required, got, earned }: { required: string; got: string; earned: number }) {
  const ok = earned > 0;

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">Facturación esperada</div>
        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md font-bold">
          {earned > 0 ? `+${earned}` : '0'}
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
          {earned > 0 ? `+${earned}` : '0'}
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

/* -------------------------------------------------- */
/* FULL DATA SECTION */
/* -------------------------------------------------- */

function FullDataSection({ row, computed }: { row: VendedorCategoriaRow; computed: Computed }) {
  return (
    <div className="space-y-6">
      {/* (tu sección igual, la dejo tal cual) */}
      {/* ... */}
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
          <StatCard title="Total de ventas" value={(row as any).total_de_ventas} hint="Boletas / ventas registradas" />
          <StatCard title="Visitados" value={(row as any).visitados} hint="Clientes visitados" />
          <StatCard title="Visitas planeadas" value={(row as any).visitas_planeadas} hint="Objetivo de visitas" />
          <StatCard title="Venta a distancia" value={(row as any).venta_a_distancia} hint="Ventas sin PDV" />
          <StatCard title="Venta en el PDV" value={(row as any).venta_en_el_pdv} hint="Ventas en punto de venta" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="text-lg font-extrabold text-slate-900">Datos de Facturación</div>
        <div className="text-sm text-slate-500">Promedios y datos considerados del período</div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <BentoCard title="Días considerados" value={(row as any).dias_considerados} />
          <BentoCard title="Promedio boletas diarias" value={(row as any).promedio_boletas_diarias} />
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
