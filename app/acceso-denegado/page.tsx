'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function AccesoDenegadoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          {/* Glow */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative p-8 sm:p-10">
            {/* Icono */}
            <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-red-50 px-3 py-2 text-red-600">
              <ShieldAlert className="h-5 w-5 mr-2" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                Acceso restringido
              </span>
            </div>

            {/* Título */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              No tenés permisos para ver esta sección
            </h1>

            {/* Texto */}
            <p className="text-sm sm:text-base text-slate-600 mb-6">
              Tu usuario está autenticado, pero tu rol o sucursal no tienen acceso
              al recurso que intentás abrir. Si creés que se trata de un error,
              contactá a un administrador del sistema.
            </p>

            {/* Info compacta del motivo */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm text-slate-600">
              <ul className="list-disc list-inside space-y-1">
                <li>Ruta protegida por rol (admin / supervisor / vendedor).</li>
                <li>También puede requerir una sucursal específica.</li>
              </ul>
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
              >
                <Home className="h-4 w-4" />
                Volver al inicio
              </Link>

              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a la página anterior
              </button>
            </div>
          </div>
        </div>

        {/* Pie pequeño */}
        <p className="mt-4 text-center text-xs text-slate-400">
          Si necesitás permisos adicionales, hablá con el administrador de RedcomWeb.
        </p>
      </div>
    </div>
  );
}
