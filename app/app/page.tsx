'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';

export default function AppHome() {
  // Validación de sesión (como ya hacías)
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const { me, loading } = useMe();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setSessionReady(true);
      if (!data.session) window.location.replace('/login');
    });
  }, []);

  // saludo según hora
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return '¡Buen día';
    if (h < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  }, []);

  const firstName = useMemo(
    () => ((me?.full_name ?? '').split(' ').filter(Boolean)[0] || me?.email?.split('@')[0] || '').trim(),
    [me?.full_name, me?.email]
  );

  if (!sessionReady || loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }
  if (!hasSession) return null; // redirigido

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">

      <div className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-2 md:items-center lg:gap-6">
        {/* Columna izquierda: saludo + CTA */}
        <div className="order-2 md:order-1">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            Sesión activa
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-800 to-red-400">{firstName || 'usuario'}</span>!
          </h1>
          <p className="mt-3 text-slate-600 text-lg">
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
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Editar perfil
            </Link>
            <Link
              href="/login"
              onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.replace('/login'); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cerrar sesión
            </Link>
          </div>

          {/* chips de sucursales si existen */}
          {me?.branches?.length ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tus sucursales</p>
              <div className="flex flex-wrap gap-2">
                {me.branches.map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm capitalize"
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
          <div className="relative mx-auto aspect-square  rounded-3xl border-slate-200 p-4">
            {/* Inserta tu imagen en /public/avatar.png o cambia el src */}
            <figure className="relative h-full w-full rounded-2xl ring-1 ring-inset ring-white/60">
              <Image
                src="/redcom_avatar.png"
                alt="Avatar del usuario"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 18rem, 22rem"
                priority
              />
            </figure>

            {/* Placa con datos básicos */}
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-slate-200 bg-white/60 p-8 backdrop-blur-md scale-110 shadow-xl">
              <p className="truncate text-sm font-semibold text-slate-900">{me?.full_name || firstName || me?.email}</p>
              <p className="truncate text-xs text-slate-500">{me?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
