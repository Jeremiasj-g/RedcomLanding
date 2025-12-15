'use client';

import React, { useMemo, useState } from 'react';
import { CATEGORIAS, getCategoriaByKey, PUNTOS, CATEGORIA_RANK } from '@/utils/categories';
import type { VendedorCategoriaRow } from '@/hooks/useCategoriasVendedores';
import { parseBoolTF, parseFloatSafe, parseIntSafe } from '@/utils/vendors/parsers';
import { hmsToSeconds } from '@/utils/vendors/time';


type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: VendedorCategoriaRow | null;
};

export default function CategoriaDetailsModal({ open, onOpenChange, row }: Props) {
  const [showMore, setShowMore] = useState(false);

  const computed = useMemo(() => {
    if (!row) return null;

    return {
      eficiencia: parseFloatSafe(row.eficiencia),
      efectividad: parseFloatSafe(row.efectividad),
      pop: parseFloatSafe(row['%_POP']),
      exhib: parseFloatSafe(row['%_Exhibición']),
      cobertura: parseIntSafe(row.cobertura),
      volumen: parseIntSafe(row.volumen),
      cumpleHorario: parseBoolTF(row.cumple_horario_ruta),
      cumpleEfectividad: parseBoolTF(row.cumple_efectividad),
      categoriaAlcanzada: row.categoriaKey,

      horasRutaStr: row.horas_promedio_ruta,
      horasRutaSec: hmsToSeconds(row.horas_promedio_ruta),
      proyeccion: String(row.Categoria_segun_proyeccion ?? '').trim().toUpperCase(),
    };
  }, [row]);

  if (!open || !row || !computed) return null;

  const alcanzada = getCategoriaByKey(computed.categoriaAlcanzada);

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
            <div className='flex items-center justify-center gap-4'>
              <div className="text-2xl font-extrabold text-slate-900">
                Análisis de {row.vendedor}
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
              onClick={() => onOpenChange(false)}
              className="absolute rounded-lg px-3 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800 right-0"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-6 justify-center flex gap-8 text-sm">
            <div className="text-center">
              <div className="text-slate-500">Horario requerido: {baseReq.horas_ruta_min}</div>
              <div className={okHorario ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                Alcanzado: {computed.horasRutaStr} {okHorario ? '✓' : '✕'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-slate-500">Efectividad requerida: {baseReq.efectividad_min}%</div>
              <div className={okEfect ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                Alcanzado: {computed.efectividad.toFixed(2)}% {okEfect ? '✓' : '✕'}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-84px)]">
          {/* ✅ Comparación por categoría (3 columnas como captura) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {CATEGORIAS.map((cat) => (
              <CompareColumn key={cat.key} cat={cat} computed={computed} />
            ))}
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={() => setShowMore(v => !v)}
              className="rounded-lg px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
            >
              {showMore ? 'Ocultar datos' : 'Mostrar más'}
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-800"
            >
              Cerrar
            </button>
          </div>

          {/* ✅ “Mostrar más”: todos los datos + cálculos */}
          {showMore && (
            <div className="mt-8">
              <FullDataSection row={row} computed={computed} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareColumn({ cat, computed }: any) {
  const okHorario = !cat.horario_ruta || computed.cumpleHorario;
  const okEfectiv = !cat.efectividad || computed.cumpleEfectividad;

  const puntosFacturacion =
    CATEGORIA_RANK[computed.categoriaAlcanzada] >=
      CATEGORIA_RANK[cat.facturacion]
      ? PUNTOS.FACTURACION
      : 0;

  const puntosEficiencia =
    computed.eficiencia >= cat.eficiencia ? PUNTOS.EFICIENCIA : 0;

  const puntosCobertura =
    computed.cobertura >= cat.cobertura ? PUNTOS.COBERTURA : 0;

  const puntosVolumen =
    computed.volumen >= cat.volumen ? PUNTOS.VOLUMEN : 0;

  const puntosPop =
    computed.pop >= cat.pop ? PUNTOS.POP : 0;

  const puntosExhib =
    computed.exhib >= cat.exhibicion ? PUNTOS.EXHIBICION : 0;

  const puntosAlcanzados =
    puntosFacturacion +
    puntosEficiencia +
    puntosCobertura +
    puntosVolumen +
    puntosPop +
    puntosExhib;

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
          got={String(computed.categoriaAlcanzada).replaceAll('_', ' ')}  // ✅
          points={PUNTOS.FACTURACION}
          earned={puntosFacturacion}
        />

        {/*         <RowCompare
          label="Horario"
          req={cat.horario_ruta ? cat.horas_ruta_min : '—'}
          got={cat.horario_ruta ? computed.horasRutaStr : '—'}
          points={0}
          earned={0}
          ok={okHorario}      // ✅ ahora define el color
        />

        <RowCompare
          label="Efectividad"
          req={cat.efectividad ? `${cat.efectividad_min}%` : '—'}
          got={cat.efectividad ? `${computed.efectividad.toFixed(2)}%` : '—'}
          points={0}
          earned={0}
          ok={okEfectiv}      // ✅
        /> */}

        <RowCompare label="Eficiencia" req={`${cat.eficiencia}%`} got={`${computed.eficiencia.toFixed(2)}%`} points={PUNTOS.EFICIENCIA}
          earned={puntosEficiencia} />
        <RowCompare label="Cobertura" req={cat.cobertura} got={computed.cobertura} points={PUNTOS.COBERTURA}
          earned={puntosCobertura} />
        <RowCompare label="Volumen" req={cat.volumen} got={computed.volumen} points={PUNTOS.VOLUMEN}
          earned={puntosVolumen} />
        <RowCompare label="% POP" req={`${cat.pop}%`} got={`${computed.pop.toFixed(2)}%`} points={PUNTOS.POP}
          earned={puntosPop} />
        <RowCompare label="% Exhibición" req={`${cat.exhibicion}%`} got={`${computed.exhib.toFixed(2)}%`} points={PUNTOS.EXHIBICION}
          earned={puntosExhib} />
      </div>
    </div>
  );
}


function RowProjection({ required, got, points, earned }: any) {
  const ok = earned > 0;

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">Facturación esperada</div>
        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md font-bold">
          {earned > 0 ? `+${earned}` : '0'}
        </span>
      </div>

      <div className="mt-1 text-xs text-slate-600">
        Requerido: {required}
      </div>

      <div className="text-xs">
        Alcanzado:{' '}
        <span className={ok ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
          {got}
        </span>
      </div>
    </div>
  );
}


function RowCompare({ label, req, got, points, earned, ok: okProp }: any) {
  const ok = typeof okProp === 'boolean' ? okProp : earned > 0;

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


function FullDataSection({ row, computed }: any) {
  // acá armamos la sección tipo tu captura 3:
  // - Datos generales
  // - Cards con cálculos (efectividad, eficiencia, %PDV, %Distancia)
  // - Datos facturación, etc.
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="text-lg font-bold text-slate-900">Datos Generales</div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MiniKpi title="Efectividad" value={`${computed.efectividad.toFixed(2)}%`} subtitle={`Planeadas: ${row.visitas_planeadas} | Visitados: ${row.visitados}`} />
        <MiniKpi title="Eficiencia" value={`${computed.eficiencia.toFixed(2)}%`} subtitle={`Ventas: ${row.total_de_ventas} | Visitados: ${row.visitados}`} />
        <MiniKpi title="% Ventas en PDV" value={row.porcentaje_de_ventas_en_el_PDV} subtitle={`PDV: ${row.venta_en_el_pdv} | Total: ${row.total_de_ventas}`} />
        <MiniKpi title="% Ventas a Distancia" value={row.porcentaje_de_ventas_a_distancia} subtitle={`Distancia: ${row.venta_a_distancia} | Planeadas: ${row.visitas_planeadas}`} />
      </div>

      <div className="mt-6 text-sm text-slate-600">
        Facturación: <span className="font-semibold text-slate-900">{row.facturacion}</span> ·
        Categoría según proyección: <span className="font-semibold text-slate-900">{row.Categoria_segun_proyeccion}</span>
      </div>
    </div>
  );
}

function MiniKpi({ title, value, subtitle }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-2 text-xs text-slate-600">{subtitle}</div>
    </div>
  );
}
