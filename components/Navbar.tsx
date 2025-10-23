'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from '@/hooks/useMe';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, ClipboardList, LogOut, LogIn, Hammer } from 'lucide-react';

export default function Navbar() {
  const { me, firstName, loading } = useMe();

  // Menú Corrientes (Masivos/Refrigerados)
  const [openCtes, setOpenCtes] = useState(false);

  // Menú de usuario (avatar)
  const [userOpen, setUserOpen] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);

  const logged = !!me;
  const branches = useMemo(() => (me?.branches ?? []).map(b => b.toLowerCase()), [me?.branches]);

  const hasCorrientes = branches.includes('corrientes');
  const hasRefrigerados = branches.includes('refrigerados');
  const showCorrientesDropdown = hasCorrientes || hasRefrigerados;

  // Cerrar dropdowns con click fuera / ESC
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.('#menu-ctes')) setOpenCtes(false);
      if (!t.closest?.('#menu-user')) setUserOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenCtes(false); setUserOpen(false); }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  // Avatar “fake”: iniciales o imagen por defecto
  const initials = useMemo(() => {
    const name = (me?.full_name ?? '').trim();
    if (!name) return (me?.email ?? 'U')[0]?.toUpperCase?.() ?? 'U';
    const parts = name.split(' ').filter(Boolean);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }, [me?.full_name, me?.email]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-gray-900 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.15 }}
          className="flex h-full items-center"
        >
          <img
            src="/LogoRedcom.png"
            alt="Redcom"
            className="h-full w-auto object-contain"
          />
          <Link href="/" className="text-xl font-bold text-white">
            REDCOM
          </Link>
        </motion.div>
        {/* Sección derecha */}
        <div className="flex items-center gap-2">
          {/* Sucursales visibles (solo si está logueado y activo) */}
          {logged && me?.is_active && (
            <div className="hidden items-center gap-1 md:flex">
              {/* Corrientes con submenú */}
              {showCorrientesDropdown && (
                <div className="relative" id="menu-ctes">
                  <button
                    onClick={() => setOpenCtes(v => !v)}
                    className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring"
                    aria-haspopup="true"
                    aria-expanded={openCtes}
                    aria-controls="menu-ctes-list"
                  >
                    Corrientes
                  </button>
                  <AnimatePresence>
                    {openCtes && (
                      <motion.div
                        id="menu-ctes-list"
                        role="menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
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
                      </motion.div>
                    )}
                  </AnimatePresence>
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
            </div>
          )}
          {/* Si NO está logueado → botón Ingresar */}
          {!loading && !logged && (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl border border-slate-400 px-3 py-2 text-slate-100 hover:bg-slate-800 transition-all"
            >
              <LogIn className="w-4 h-4" />
              Ingresar
            </Link>
          )}
          {/* Si está logueado → Avatar con dropdown */}
          {logged && (
            <div className="relative" id="menu-user">
              <button
                ref={userBtnRef}
                onClick={() => setUserOpen(v => !v)}
                aria-haspopup="true"
                aria-expanded={userOpen}
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 p-1 pl-2 pr-1 text-slate-100 hover:bg-slate-800"
              >
                <span className="hidden text-sm text-slate-300 md:block">
                  Hola, <b className="text-slate-100">{firstName}</b>
                </span>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-sm font-bold text-slate-200">
                  {initials}
                </div>
              </button>
              <AnimatePresence>
                {userOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 p-2 w-max overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
                    role="menu"
                  >
                    <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-800">
                      {me?.email}
                    </div>
                    <Link
                      href="/perfil"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                      onClick={() => setUserOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      Mi perfil
                    </Link>
                    {me?.role === 'admin' && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                        onClick={() => setUserOpen(false)}
                      >
                        <Shield className="w-4 h-4" />
                        Panel de administrador
                      </Link>
                    )}
                    {me?.role === 'admin' && (
                      <Link href="/admin/solicitudes" className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800">
                        <ClipboardList className="w-4 h-4" />
                        Solicitudes
                      </Link>
                    )}
                    {me?.role === 'admin' && (
                      <Link href="/gerencia" className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800">
                        <Hammer className="w-4 h-4" />
                        Recursos
                      </Link>
                    )}
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      role="menuitem"
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
                      onClick={async () => {
                        setUserOpen(false);
                        await supabase.auth.signOut();
                        window.location.replace('/login');
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      Salir
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
