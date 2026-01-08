'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Home, ShieldAlert } from 'lucide-react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AccesoDenegadoPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100">
      {/* Decor suave */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-rose-300/30 blur-[90px]" />
        <div className="absolute -top-44 -right-44 h-[560px] w-[560px] rounded-full bg-indigo-300/28 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/22 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.35)_1px,transparent_0)] [background-size:26px_26px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4">
        {/* Top nav */}
        <div className="pt-8 sm:pt-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Acceso restringido
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" />
              Inicio
            </Link>

            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          </div>
        </div>

        {/* Hero */}
        <main className="relative flex-1">
          {/* Texto superior centrado */}
          <div className="mx-auto mt-12 sm:mt-16 max-w-4xl text-center">
            <h1 className="text-[34px] leading-[1.05] sm:text-[54px] font-black tracking-tight text-slate-900">
              ACCESO DENEGADO
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-600">
              Tu sesión es válida, pero tu <span className="font-semibold text-slate-800">rol</span> o{' '}
              <span className="font-semibold text-slate-800">sucursal</span> no habilitan esta sección.
              Si creés que es un error, pedí acceso a un administrador.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm backdrop-blur">
                Protegido por rol
              </span>
              <span className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm backdrop-blur">
                Puede requerir sucursal
              </span>
            </div>
          </div>

          {/* Avatar grande “saliendo” desde abajo */}
          <div className="pointer-events-none inset-x-0 flex justify-center">
            <div className="relative w-[min(920px,92vw)]">
              <Image
                src="/stop_avatar.png"
                alt="Acceso denegado"
                width={1400}
                height={1000}
                priority
                className="h-[400px] md:h-[700px] object-contain drop-shadow-[0_40px_50px_rgba(2,6,23,0.18)]"
              />
            </div>
          </div>

        </main>

      </div>
    </div>
  );
}
