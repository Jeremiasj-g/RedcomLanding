import React from 'react';
import { CATEGORIAS, PLAN_MEJORA, type CategoriaConfig } from '@/utils/categories';

const CategoriasTable = () => {
  // ✅ Orden: Senior → Semi → Junior, y Plan de mejora al final (cambiá si querés)
  const rows: CategoriaConfig[] = [...CATEGORIAS, PLAN_MEJORA];

  const fmtPercent = (v: number) => (v > 0 ? `${v}%` : '—');
  const fmtNumber = (v: number) => (v > 0 ? v : '—');

  // ✅ Convierte bg translucido del utils a un bg sólido tipo “pill” como tu screenshot
  const toSolidBg = (bg: string) => {
    // ejemplos: "bg-emerald-700/10" -> "bg-emerald-700"
    //           "bg-yellow-400/10"  -> "bg-yellow-400"
    //           "bg-red-500/10"     -> "bg-red-500"
    return bg.replace(/\/\d+$/, '');
  };

  return (
    <div className="hidden md:block shadow-2xl">
      <h2 className="text-xl sm:text-2xl mb-4 font-bold">Escalas de Evaluación</h2>

      <section className="sticky top-21 z-10 bg-white pb-4 shadow-sm overflow-x-auto rounded-lg md:-z-10">
        <table className="min-w-[900px] w-full text-xs text-left mt-2">
          <thead className="text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Facturación</th>
              <th className="px-3 py-2">Horario</th>
              <th className="px-3 py-2">Efectividad</th>
              <th className="px-3 py-2">Eficiencia</th>
              <th className="px-3 py-2">Cobertura</th>
              <th className="px-3 py-2">Volumen</th>
              <th className="px-3 py-2">% POP</th>
              <th className="px-3 py-2">% Exhibición</th>
              <th className="px-3 py-2">Puntaje</th>
            </tr>
          </thead>

          <tbody className="text-gray-700">
            {rows.map((c) => (
              <tr key={c.key} className="odd:bg-white even:bg-gray-50">
                {/* ✅ Columna 1 con fondo sólido según c.color.bg */}
                <td className="px-3 py-2 font-semibold">
                  <span
                    className={[
                      'inline-flex items-center rounded-md px-2 py-1 text-xs font-bold text-white',
                      toSolidBg(c.color.bg),
                    ].join(' ')}
                  >
                    {c.label.toUpperCase()}
                  </span>
                </td>

                <td className="px-3 py-2">{c.facturacion.replaceAll('_', ' ')}</td>
                <td className="px-3 py-2">{c.horario_ruta ? '✓' : '—'}</td>
                <td className="px-3 py-2">{c.efectividad ? '✓' : '—'}</td>
                <td className="px-3 py-2">{fmtPercent(c.eficiencia)}</td>
                <td className="px-3 py-2">{fmtNumber(c.cobertura)}</td>
                <td className="px-3 py-2">{fmtNumber(c.volumen)}</td>
                <td className="px-3 py-2">{fmtPercent(c.pop)}</td>
                <td className="px-3 py-2">{fmtPercent(c.exhibicion)}</td>
                <td className="px-3 py-2 font-semibold">{c.total > 0 ? c.total : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default CategoriasTable;
