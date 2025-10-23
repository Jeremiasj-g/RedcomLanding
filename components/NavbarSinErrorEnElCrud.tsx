'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMe } from '@/hooks/useMe';
import { supabase } from '@/lib/supabaseClient';

export default function Navbar() {
  const { me, firstName, loading } = useMe();
  const [openCtes, setOpenCtes] = useState(false);

  const logged = !!me;
  const branches = (me?.branches ?? []).map(b => b.toLowerCase());

  const hasCorrientes = branches.includes('corrientes');
  const hasRefrigerados = branches.includes('refrigerados');
  const showCorrientesDropdown = hasCorrientes || hasRefrigerados;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.('#menu-ctes')) setOpenCtes(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCtes(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/85 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-slate-100">Redcom</Link>

        <div className="flex items-center gap-2">
          {/* Menú de sucursales */}
          {logged && me?.is_active && (
            <div className="hidden items-center gap-1 md:flex">
              {/* Corrientes (dropdown con Masivos/Refrigerados según permisos) */}
              {showCorrientesDropdown && (
                <div className="relative" id="menu-ctes">
                  <button
                    onClick={() => setOpenCtes(v => !v)}
                    className="rounded-xl px-3 py-2 font-semibold text-emerald-300 hover:bg-slate-800 hover:text-emerald-200 focus:outline-none focus:ring focus:ring-emerald-500/30"
                    aria-haspopup="true"
                    aria-expanded={openCtes}
                    aria-controls="menu-ctes-list"
                  >
                    Corrientes
                  </button>
                  {openCtes && (
                    <div
                      id="menu-ctes-list"
                      role="menu"
                      className="absolute left-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
                    >
                      {hasCorrientes && (
                        <Link
                          href="/corrientes/masivos"
                          role="menuitem"
                          className="block px-3 py-2 text-slate-100 hover:bg-slate-800"
                        >
                          Masivos
                        </Link>
                      )}
                      {hasRefrigerados && (
                        <Link
                          href="/corrientes/refrigerados"
                          role="menuitem"
                          className="block px-3 py-2 text-slate-100 hover:bg-slate-800"
                        >
                          Refrigerados
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {branches.includes('chaco') && (
                <Link className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800" href="/chaco">
                  Chaco
                </Link>
              )}
              {branches.includes('misiones') && (
                <Link className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800" href="/misiones">
                  Misiones
                </Link>
              )}
              {branches.includes('obera') && (
                <Link className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800" href="/obera">
                  Oberá
                </Link>
              )}

              {/* Admin */}
              {me.role === 'admin' && (
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                  href="/admin"
                >
                  Panel de administrador
                </Link>
              )}
            </div>
          )}

          {/* Bienvenida / Login */}
          {!loading && !logged && (
            <Link
              href="/login"
              className="rounded-xl border border-slate-700 px-3 py-2 text-slate-100 hover:bg-slate-800"
            >
              Ingresar
            </Link>
          )}
          {logged && (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-300 md:inline">
                Hola, <b className="text-slate-100">{firstName}</b>
              </span>
              <button
                className="rounded-xl border border-slate-700 px-3 py-2 text-slate-100 hover:bg-slate-800"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.replace('/login');
                }}
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
