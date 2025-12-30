'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';

import { useImportantAlert } from '@/hooks/useImportantAlert';
import ImportantAlertModal from '@/components/rrhh/ImportantAlertModal';

export default function AppHome() {
  const router = useRouter();
  const { me, loading } = useMe();

  // Evita redirecciones múltiples en cambios de foco o re-renders
  const redirected = useRef(false);
  useEffect(() => {
    if (!loading && !me && !redirected.current) {
      redirected.current = true;
      router.replace('/login'); // navegación SPA, sin reload
    }
  }, [loading, me, router]);

  // saludo según hora
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return '¡Buen día';
    if (h < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  }, []);

  const firstName = useMemo(
    () =>
      ((me?.full_name ?? '')
        .split(' ')
        .filter(Boolean)[0] ||
        me?.email?.split('@')[0] ||
        ''
      ).trim(),
    [me?.full_name, me?.email]
  );


  const {
    alert,
    acknowledge, // 👈 ESTA FUNCIÓN VIENE DEL HOOK
  } = useImportantAlert(me?.id);

  const handleScrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  // Loader moderno mientras resolvemos el perfil
  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-[#fff5f5] via-white to-[#fff0f0]">
        <ImportantAlertModal
          open={!!alert}
          title={alert?.title ?? ''}
          content={alert?.content ?? ''}
          severity={alert?.severity ?? 'info'}
          requireAck={alert?.require_ack ?? false}
          onAcknowledge={acknowledge}
        />


        <div className="flex flex-col items-center gap-5">
          {/* Logo circular Redcom */}
          <div className="relative">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#A81C18] text-white text-2xl font-bold shadow-lg">
              R
            </div>
            <div className="absolute -inset-2 rounded-3xl border border-red-200/60 animate-pulse" />
          </div>
          {/* Texto animado */}
          <div className="text-center">
            <p className="text-lg font-semibold text-[#A81C18]">Cargando tu panel…</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A81C18] animate-bounce [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#A81C18] animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#A81C18] animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay usuario (se disparó la redirección), no renderizamos nada
  if (!me) return null;

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-[#fff5f5] via-white to-[#fff0f0]">
      <div className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-2 md:items-center lg:gap-6">
        {/* Columna izquierda: saludo + CTA */}
        <div className="order-2 md:order-1">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Sesión activa
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            {greeting},{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7e1411] to-[#e44b45]">
              {firstName || 'usuario'}
            </span>
            !
          </h1>
          <p className="mt-3 text-slate-700 text-lg">
            Bienvenido al panel general. Desde aquí podrás acceder rápidamente a tus sucursales y gestionar tu perfil.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Portada
            </Link>
            <Link
              href="/perfil"
              className="rounded-xl border border-red-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:bg-red-50"
            >
              Editar perfil
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace('/login'); // sin reload
              }}
              className="rounded-xl border border-red-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>

          {/* chips de sucursales si existen */}
          {me.branches?.length ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tus sucursales</p>
              <div className="flex flex-wrap gap-2">
                {me.branches.map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm capitalize"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Columna derecha: espacio para avatar/imagen */}
        <div className="order-1 md:order-2">
          <div className="relative mx-auto aspect-square rounded-3xl p-4">
            <figure className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-inset ring-white/60">
              <Image
                src="/redcom_avatar.png" // poné tu imagen en /public
                alt="Avatar del usuario"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 18rem, 22rem"
                priority
              />
            </figure>

            {/* Placa con datos básicos */}
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-red-200 bg-white/70 p-4 backdrop-blur-md shadow-xl">
              <p className="truncate text-sm font-semibold text-slate-900">
                {me.full_name || firstName || me.email}
              </p>
              <p className="truncate text-xs text-slate-600">{me.email}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
