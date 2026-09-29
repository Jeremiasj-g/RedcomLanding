"use client";

import React, { useMemo } from "react";

import {
  formatNumber,
  type CategoriaHistoryPoint,
  type CategoriaHistorySummary,
} from "@/utils/categoriaHistory";

type ClosedLinesRankingItem = {
  sellerId: string;
  sellerName: string;
  summary?: Pick<CategoriaHistorySummary, "sellerName"> | null;
  history: CategoriaHistoryPoint[];
};

type ClosedLinesTableProps = {
  items: ClosedLinesRankingItem[];
  emptyMessage?: string;
};

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (!valid.length) return null;
  return valid.reduce((acc, value) => acc + value, 0) / valid.length;
}

function normalizeSupervisor(value: unknown) {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();

  if (!raw || raw === "—" || upper === "NO" || upper === "#N/A" || upper === "NULL" || upper === "FALSE") {
    return "Sin supervisor asignado";
  }

  return raw.replace(/\s+/g, " ");
}

export default function ClosedLinesTable({
  items,
  emptyMessage = "No hay cierres disponibles en el rango seleccionado.",
}: ClosedLinesTableProps) {
  const supervisors = useMemo(() => {
    const sellerRows = items.map((seller) => {
      const orderedHistory = [...seller.history].sort((a, b) => a.period.localeCompare(b.period));
      const last = orderedHistory.at(-1);

      return {
        sellerId: seller.sellerId,
        sellerName: seller.summary?.sellerName || seller.sellerName,
        supervisor: normalizeSupervisor(last?.supervisor),
        months: new Set(orderedHistory.map((point) => point.period)).size,
        avgCobertura: average(orderedHistory.map((point) => point.cobertura)),
        avgVolumen: average(orderedHistory.map((point) => point.volumen)),
      };
    });

    const grouped = new Map<string, typeof sellerRows>();

    sellerRows.forEach((seller) => {
      const current = grouped.get(seller.supervisor) ?? [];
      current.push(seller);
      grouped.set(seller.supervisor, current);
    });

    return Array.from(grouped.entries())
      .map(([supervisor, sellers]) => ({
        supervisor,
        sellers: [...sellers].sort((a, b) => a.sellerName.localeCompare(b.sellerName)),
        avgCobertura: average(sellers.map((seller) => seller.avgCobertura)),
        avgVolumen: average(sellers.map((seller) => seller.avgVolumen)),
      }))
      .sort((a, b) => a.supervisor.localeCompare(b.supervisor));
  }, [items]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-slate-950 text-[11px] uppercase tracking-[0.12em] text-white">
          <tr>
            <th className="px-4 py-3 font-black">Nivel</th>
            <th className="px-4 py-3 font-black">Supervisor / Vendedor</th>
            <th className="px-4 py-3 text-center font-black">Meses</th>
            <th className="px-4 py-3 text-right font-black">Prom. líneas cobertura</th>
            <th className="px-4 py-3 text-right font-black">Prom. líneas volumen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {!items.length ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            supervisors.flatMap((group) => {
              const rows: React.ReactNode[] = [
                <tr key={`supervisor:${group.supervisor}`} className="bg-slate-50">
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                      Supervisor
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-black text-slate-950">{group.supervisor}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-600">
                    {group.sellers.length} vend.
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-slate-950">
                    {formatNumber(group.avgCobertura, 1)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-slate-950">
                    {formatNumber(group.avgVolumen, 1)}
                  </td>
                </tr>,
              ];

              group.sellers.forEach((seller) => {
                rows.push(
                  <tr key={`seller:${seller.sellerId}`} className="bg-white hover:bg-slate-50/70">
                    <td className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Vendedor
                    </td>
                    <td className="px-4 py-2 pl-8">
                      <div className="font-bold text-slate-800">{seller.sellerName}</div>
                      <div className="text-[11px] font-semibold text-slate-400">ID {seller.sellerId}</div>
                    </td>
                    <td className="px-4 py-2 text-center font-semibold text-slate-600">{seller.months}</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-700">
                      {formatNumber(seller.avgCobertura, 1)}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-slate-700">
                      {formatNumber(seller.avgVolumen, 1)}
                    </td>
                  </tr>,
                );
              });

              return rows;
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
