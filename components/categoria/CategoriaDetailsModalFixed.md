'use client';

import React, { useEffect, useMemo, useState } from 'react';

import {
  CATEGORIAS,
  getCategoriaByKey,
  PUNTOS,
  CATEGORIA_RANK,
  type CategoriaKey,
  type CategoriaConfig,
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

function normalizeCategoriaKey(raw: unknown): CategoriaKey {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  // soporta "PLAN DE MEJORA", "PLAN_MEJORA", "PLAN_DE_MEJORA", etc.
  if (v === 'PLAN_DE_MEJORA' || v === 'PLAN_MEJORA' || v === 'PLANDEM' || v === 'PLANDEM EJOR A') {
    return 'PLAN_MEJORA';
  }

  if (v === 'JUNIOR') return 'JUNIOR';
  if (v === 'SEMI_SENIOR' || v === 'SEMISENIOR' || v === 'SEMI-SENIOR') return 'SEMI_SENIOR';
  if (v === 'SENIOR') return 'SENIOR';

  // fallback seguro
  return 'PLAN_MEJORA';
}

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

export default function CategoriaDetailsModal({ open, onOpenChange, row }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('comparacion');

  useEffect(() => {
    if (open) setActiveTab('comparacion');
  }, [open, row?.id]);

  const computed = useMemo<Computed | null>(() => {
    if (!row) return null;

    // 👇 IMPORTANTE: cuando viene de BD (snapshot) las keys son distintas:
    // - Categoria_alcanzada
    // - Categoria_segun_proyeccion
    // y a veces NO existe row.categoriaKey (porque tu tipo live lo arma diferente)
    const r: any = row;

    const categoriaAlcanzadaKey = normalizeCategoriaKey(
      r.categoriaKey ?? r.Categoria_alcanzada ?? r['Categoria_alcanzada']
    );

    const proyeccionKey = normalizeCategoriaKey(
      r.Categoria_segun_proyeccion ?? r['Categoria_segun_proyeccion']
    );

    const horasRutaStr = String(r.horas_promedio_ruta ?? '');
    const horasRutaSec = hmsToSeconds(horasRutaStr);

    return {
      eficiencia: parseFloatSafe(r.eficiencia),
      efectividad: parseFloatSafe(r.efectividad),
      pop: parseFloatSafe(r['%_POP']),
      exhib: parseFloatSafe(r['%_Exhibición']),
      cobertura: parseIntSafe(r.cobertura),
      volumen: parseIntSafe(r.volumen),
      cumpleHorario: parseBoolTF(r.cumple_horario_ruta),
      cumpleEfectividad: parseBoolTF(r.cumple_efectividad),

      categoriaAlcanzadaKey,
      proyeccionKey,

      horasRutaStr,
      horasRutaSec,
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

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-84px)]">
          {/* Tabs */}
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
            <FullDataSection row={row as any} computed={computed} />
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

function CompareColumn({ cat, computed }: { cat: CategoriaConfig; computed: Computed }) {
  // ✅ Facturación esperada = comparación por PROYECCIÓN (lo que “debería ser”)
  const puntosFacturacion =
    CATEGORIA_RANK[computed.proyeccionKey] >= CATEGORIA_RANK[cat.facturacion]
      ? PUNTOS.FACTURACION
      : 0;

  const puntosEficiencia = computed.eficiencia >= cat.eficiencia ? PUNTOS.EFICIENCIA : 0;
  const puntosCobertura = computed.cobertura >= cat.cobertura ? PUNTOS.COBERTURA : 0;
  const puntosVolumen = computed.volumen >= cat.volumen ? PUNTOS.VOLUMEN : 0;
  const puntosPop = computed.pop >= cat.pop ? PUNTOS.POP : 0;
  const puntosExhib = computed.exhib >= cat.exhibicion ? PUNTOS.EXHIBICION : 0;

  const puntosAlcanzados =
    puntosFacturacion +
    puntosEficiencia +
    puntosCobertura +
    puntosVolumen +
    puntosPop +
    puntosExhib +
    puntosMix;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <span
          className={[
            'px-2 py-1 rounded-md text-xs font-bold text-white',
            cat.color.bg.replace(/\/\d+$/, ''),
          ].join(' ')}
        >
          {cat.label.toUpperCase()}
        </span>
        <div className="text-xs text-slate-500">
          TOTAL PUNTOS{' '}
          <span className="font-bold text-slate-900">
            {puntosAlcanzados}/{cat.total}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <RowProjection
          required={cat.facturacion.replaceAll('_', ' ')}
          got={computed.proyeccionKey.replaceAll('_', ' ')}
          earned={puntosFacturacion}
        />

        <RowCompare
          label="Eficiencia"
          req={`${cat.eficiencia}%`}
          got={`${computed.eficiencia.toFixed(2)}%`}
          earned={puntosEficiencia}
        />
        <RowCompare label="Cobertura" req={cat.cobertura} got={computed.cobertura} earned={puntosCobertura} />
        <RowCompare label="Volumen" req={cat.volumen} got={computed.volumen} earned={puntosVolumen} />
        <RowCompare label="% POP" req={`${cat.pop}%`} got={`${computed.pop.toFixed(2)}%`} earned={puntosPop} />
        <RowCompare
          label="% Exhibición"
          req={`${cat.exhibicion}%`}
          got={`${computed.exhib.toFixed(2)}%`}
          earned={puntosExhib}
        />
        <RowCompare
          label="Mix"
          req={`${(cat as any).mix}%`}
          got={`${computed.mix.toFixed(2)}%`}
          earned={puntosMix}
        />
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
  req: string | number;
  got: string | number;
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

function FullDataSection({ row, computed }: { row: any; computed: Computed }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiExplainCard
          title="Efectividad"
          value={`${computed.efectividad.toFixed(2)}%`}
          kpis={[
            { label: 'Visitas Planeadas', value: row.visitas_planeadas },
            { label: 'Visitados', value: row.visitados },
          ]}
          formula="(visitados / visitas planeadas) * 100"
        />

        <KpiExplainCard
          title="Eficiencia"
          value={`${computed.eficiencia.toFixed(2)}%`}
          kpis={[
            { label: 'Visitados', value: row.visitados },
            { label: 'Total de Ventas', value: row.total_de_ventas },
          ]}
          formula="(ventas / visitados) * 100"
        />

        <KpiExplainCard
          title="% Ventas en PDV"
          value={row.porcentaje_de_ventas_en_el_PDV}
          kpis={[
            { label: 'Total de Ventas', value: row.total_de_ventas },
            { label: 'Venta en el PDV', value: row.venta_en_el_pdv },
          ]}
          formula="(ventas pdv / total ventas) * 100"
        />

        <KpiExplainCard
          title="% Ventas a Distancia"
          value={row.porcentaje_de_ventas_a_distancia}
          kpis={[
            { label: 'Visitas Planeadas', value: row.visitas_planeadas },
            { label: 'Venta a Distancia', value: row.venta_a_distancia },
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
            ID: <span className="font-semibold text-slate-900">{row.id}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard title="Facturación" value={row.facturacion} hint="Total facturado" />
          <StatCard title="Total de ventas" value={row.total_de_ventas} hint="Boletas / ventas registradas" />
          <StatCard title="Visitados" value={row.visitados} hint="Clientes visitados" />
          <StatCard title="Visitas planeadas" value={row.visitas_planeadas} hint="Objetivo de visitas" />
          <StatCard title="Venta a distancia" value={row.venta_a_distancia} hint="Ventas sin PDV" />
          <StatCard title="Venta en el PDV" value={row.venta_en_el_pdv} hint="Ventas en punto de venta" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="text-lg font-extrabold text-slate-900">Datos de Facturación</div>
        <div className="text-sm text-slate-500">Promedios y datos considerados del período</div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <BentoCard title="Días considerados" value={row.dias_considerados} />
          <BentoCard title="Promedio boletas diarias" value={row.promedio_boletas_diarias} />
          <BentoCard title="Facturación promedio" value={row.facturacion_promedio} />
          <BentoCard title="Promedio $ boletas" value={row['promedio_$_boletas']} />
          <BentoCard title="Categoría según proyección" value={computed.proyeccionKey.replaceAll('_', ' ')} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, hint }: { title: string; value: any; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function BentoCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-base font-bold text-slate-900 truncate">{value}</div>
    </div>
  );
}

function KpiExplainCard({
  title,
  value,
  kpis,
  formula,
}: {
  title: string;
  value: string;
  kpis: { label: string; value: any }[];
  formula: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-900">{value}</div>

      <div className="mt-4 space-y-1 text-sm text-slate-600">
        {kpis.map((k) => (
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
