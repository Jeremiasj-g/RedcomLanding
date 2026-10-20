import { Target } from 'lucide-react';

export const metadata = {
  title: 'Seguimiento SKUs FOCO | REDCOM',
  description: 'Seguimiento de volumen y cobertura por línea y artículo de foco.',
};

export default function SeguimientoSKUsFocoPage() {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 pb-8 pt-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1536px]">
        <header className="mb-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-600">
            <Target className="h-4 w-4" aria-hidden="true" />
            Seguimiento comercial
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#17181B] sm:text-4xl">
            Seguimiento SKUs FOCO
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Definí líneas y artículos de foco, cargá los reportes del sistema y analizá sus resultados.
          </p>
        </header>
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.05)]">
          <iframe
            title="Dashboard de ventas por foco"
            src="/seguimiento-skus-foco.html"
            className="block min-h-[900px] w-full border-0 bg-[#f3f4f6] lg:min-h-[1100px]"
            style={{ height: 'calc(100vh - 210px)' }}
          />
        </div>
      </div>
    </main>
  );
}
