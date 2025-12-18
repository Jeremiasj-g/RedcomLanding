'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from '@/hooks/useMe';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Shield,
  ClipboardList,
  LogOut,
  LogIn,
  Hammer,
  CalendarDays,
  ListChecks,
  Bell,
  Check,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

type TaskNotification = {
  id: number;
  title: string;
  summary: string | null;
  due_date: string | null;
  project: string;
  created_at: string;
  read: boolean;
};

const getNotifStorageKey = (userId: string) =>
  `project_notifs_last_seen_${userId}`;

export default function Navbar() {
  const { me, firstName, loading } = useMe();

  // Dropdowns (desktop)
  const [openCtes, setOpenCtes] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Mobile
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileBranchesOpen, setMobileBranchesOpen] = useState(false);
  const [mobileUserOpen, setMobileUserOpen] = useState(false);

  const userBtnRef = useRef<HTMLButtonElement | null>(null);

  // Notificaciones
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);

  const logged = !!me;
  const role = me?.role ?? 'vendedor';
  const isActive = !!me?.is_active;

  const isVendor = role === 'vendedor';

  // ✅ vendedor NO ve: Mis tareas / Proyectos
  const canSeeWorkSection = logged && isActive && !isVendor;

  // ✅ Proyectos solo admin/supervisor
  const canSeeProjects = logged && isActive && ['admin', 'supervisor'].includes(role);

  // ✅ vendedor NO ve campanita
  const canSeeNotifs = logged && isActive && !isVendor;

  const branches = useMemo(
    () => (me?.branches ?? []).map((b) => b.toLowerCase()),
    [me?.branches],
  );

  const hasCorrientes = branches.includes('corrientes');
  const hasRefrigerados = branches.includes('refrigerados');
  const showCorrientesDropdown = hasCorrientes || hasRefrigerados;

  // Contador solicitudes (admin)
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // ─────────────────────────────────────────
  // Solicitudes pendientes (admin) + realtime
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!me || role !== 'admin') {
      setPendingCount(null);
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('signup_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (cancelled) return;

      if (error) {
        console.error('Error contando solicitudes pendientes', error);
        setPendingCount(null);
        return;
      }

      setPendingCount(count ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel('signup_requests_admin_badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signup_requests' },
        () => fetchCount(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me, role]);

  // ─────────────────────────────────────────
  // Notificaciones realtime (solo si puede ver campanita)
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!canSeeNotifs || !me?.id) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const loadInitialNotifications = async () => {
      // 🔧 Acá va tu carga inicial real si la tenías.
      // Si no la tenés todavía, no pasa nada.
      // setNotifications([...])
    };

    loadInitialNotifications();

    const channel = supabase
      .channel(`project_notifications_${me.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_task_assignees',
          filter: `user_id=eq.${me.id}`,
        },
        async (payload) => {
          const taskId = (payload.new as any).task_id as number;

          const { data: task, error } = await supabase
            .from('project_tasks')
            .select('id, title, summary, due_date, project, created_at')
            .eq('id', taskId)
            .single();

          if (error || !task || cancelled) return;

          setNotifications((prev) => {
            const exists = prev.find((n) => n.id === taskId);
            const newNotif: TaskNotification = {
              id: task.id as number,
              title: (task as any).title ?? '',
              summary: (task as any).summary ?? null,
              due_date: (task as any).due_date ?? null,
              project: (task as any).project ?? '',
              created_at: (task as any).created_at ?? '',
              read: false,
            };
            const withoutDup = exists ? prev.filter((n) => n.id !== taskId) : prev;
            return [newNotif, ...withoutDup].slice(0, 10);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canSeeNotifs, me?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ─────────────────────────────────────────
  // Cerrar dropdowns con click fuera / ESC (fix mobile)
  // ─────────────────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;

      const inside =
        t.closest?.('#menu-ctes') ||
        t.closest?.('#menu-user') ||
        t.closest?.('#menu-notif') ||
        t.closest?.('#menu-mobile-root');

      if (!inside) {
        setOpenCtes(false);
        setUserOpen(false);
        setNotifOpen(false);
        setMobileOpen(false);
        setMobileBranchesOpen(false);
        setMobileUserOpen(false);
      }
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCtes(false);
        setUserOpen(false);
        setNotifOpen(false);
        setMobileOpen(false);
        setMobileBranchesOpen(false);
        setMobileUserOpen(false);
      }
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const closeAllMenus = () => {
    setOpenCtes(false);
    setUserOpen(false);
    setNotifOpen(false);
    setMobileOpen(false);
    setMobileBranchesOpen(false);
    setMobileUserOpen(false);
  };

  // Avatar “fake”: iniciales
  const initials = useMemo(() => {
    const name = (me?.full_name ?? '').trim();
    if (!name) return (me?.email ?? 'U')[0]?.toUpperCase?.() ?? 'U';
    const parts = name.split(' ').filter(Boolean);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }, [me?.full_name, me?.email]);

  const handleMarkAllRead = () => {
    if (!me?.id) return;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(getNotifStorageKey(me.id), nowIso);
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkOneRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-gray-900/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.15 }}
          className="flex h-full items-center gap-2"
        >
          <img
            src="/LogoRedcom.png"
            alt="Redcom"
            className="h-full w-auto object-contain"
          />
          <Link href="/" className="text-xl font-bold text-white" onClick={closeAllMenus}>
            REDCOM
          </Link>
        </motion.div>

        {/* Desktop */}
        <div className="hidden items-center gap-3 md:flex">
          {/* ✅ Mis tareas (NO vendedor) */}
          {canSeeWorkSection && (
            <Link
              href="/tareas"
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-sky-300 hover:bg-slate-800 hover:text-sky-200"
              onClick={closeAllMenus}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Mis tareas</span>
            </Link>
          )}

          {/* ✅ Proyectos (solo admin/supervisor) */}
          {canSeeProjects && (
            <Link
              href="/proyectos"
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
              onClick={closeAllMenus}
            >
              <ListChecks className="h-4 w-4" />
              <span>Proyectos</span>
            </Link>
          )}

          {/* Sucursales (desktop) */}
          {logged && isActive && (
            <div className="hidden items-center gap-1 lg:flex">
              {showCorrientesDropdown && (
                <div className="relative" id="menu-ctes">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenCtes((v) => !v);
                      setUserOpen(false);
                      setNotifOpen(false);
                    }}
                    className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring"
                    aria-haspopup="true"
                    aria-expanded={openCtes}
                    type="button"
                  >
                    Corrientes
                  </button>

                  <AnimatePresence>
                    {openCtes && (
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasCorrientes && (
                          <Link
                            href="/corrientes/masivos"
                            role="menuitem"
                            className="block px-3 py-2 text-slate-100 hover:bg-slate-800"
                            onClick={closeAllMenus}
                          >
                            Masivos
                          </Link>
                        )}
                        {hasRefrigerados && (
                          <Link
                            href="/corrientes/refrigerados"
                            role="menuitem"
                            className="block px-3 py-2 text-slate-100 hover:bg-slate-800"
                            onClick={closeAllMenus}
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
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800"
                  href="/chaco"
                  onClick={closeAllMenus}
                >
                  Chaco
                </Link>
              )}
              {branches.includes('misiones') && (
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800"
                  href="/misiones"
                  onClick={closeAllMenus}
                >
                  Misiones
                </Link>
              )}
              {branches.includes('obera') && (
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800"
                  href="/obera"
                  onClick={closeAllMenus}
                >
                  Oberá
                </Link>
              )}
            </div>
          )}

          {/* Login */}
          {!loading && !logged && (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl border border-slate-400 px-3 py-2 text-slate-100 transition-all hover:bg-slate-800"
            >
              <LogIn className="h-4 w-4" />
              Ingresar
            </Link>
          )}

          {/* User menu (desktop) */}
          {logged && (
            <div className="relative" id="menu-user">
              <button
                ref={userBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setUserOpen((v) => !v);
                  setOpenCtes(false);
                  setNotifOpen(false);
                }}
                aria-haspopup="true"
                aria-expanded={userOpen}
                type="button"
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 p-1 pl-2 pr-1 text-slate-100 hover:bg-slate-800"
              >
                <span className="hidden text-sm text-slate-300 lg:block">
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
                    className="absolute right-0 mt-2 w-max overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl"
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
                      {me?.email}
                    </div>

                    <Link
                      href="/perfil"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                      onClick={closeAllMenus}
                    >
                      <User className="h-4 w-4" />
                      Mi perfil
                    </Link>

                    {role === 'admin' && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                        onClick={closeAllMenus}
                      >
                        <Shield className="h-4 w-4" />
                        Panel de administrador
                      </Link>
                    )}

                    {role === 'admin' && (
                      <Link
                        href="/tareas/supervisores"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sky-300 hover:bg-slate-800 hover:text-sky-200"
                        onClick={closeAllMenus}
                      >
                        <ListChecks className="h-4 w-4" />
                        Tareas de supervisores
                      </Link>
                    )}

                    {role === 'admin' && (
                      <Link
                        href="/admin/solicitudes"
                        className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                        onClick={closeAllMenus}
                      >
                        <ClipboardList className="h-4 w-4" />
                        <span>Solicitudes</span>
                        {pendingCount !== null && pendingCount > 0 && (
                          <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-none text-slate-900">
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                    )}

                    {role === 'admin' && (
                      <Link
                        href="/gerencia"
                        className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                        onClick={closeAllMenus}
                      >
                        <Hammer className="h-4 w-4" />
                        Recursos
                      </Link>
                    )}

                    <div className="my-1 border-t border-slate-800" />

                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
                      onClick={async () => {
                        closeAllMenus();
                        await supabase.auth.signOut();
                        window.location.replace('/login');
                      }}
                      type="button"
                    >
                      <LogOut className="h-4 w-4" />
                      Salir
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ✅ Campanita (NO vendedor) + ✅ un solo panel */}
          {canSeeNotifs && (
            <div className="relative" id="menu-notif">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifOpen((v) => !v);
                  setOpenCtes(false);
                  setUserOpen(false);
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-slate-50">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-slate-100 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-1 flex items-center justify-between gap-4 px-2 pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Proyectos asignados
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          disabled={notifications.length === 0 || unreadCount === 0}
                          className="text-[10px] text-slate-100 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Marcar todo
                        </button>

                        <Link
                          href="/proyectos"
                          className="text-[11px] text-emerald-300 hover:text-emerald-200"
                          onClick={closeAllMenus}
                        >
                          Ver todo
                        </Link>
                      </div>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="px-2 py-3 text-[11px] text-slate-500">
                        No tenés proyectos asignados por ahora.
                      </div>
                    ) : (
                      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                        {notifications.map((n) => {
                          const dueLabel = n.due_date
                            ? new Date(n.due_date).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : 'Sin fecha límite';

                          const createdDate = n.created_at ? new Date(n.created_at) : null;

                          const timeLabel = createdDate
                            ? createdDate.toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '';

                          const cardClasses = n.read
                            ? 'border-slate-900 bg-slate-900/40'
                            : 'border-slate-700 bg-slate-900/80';

                          return (
                            <div
                              key={n.id}
                              className={`relative rounded-lg border px-3 py-2 transition ${cardClasses}`}
                            >
                              {!n.read && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkOneRead(n.id)}
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              )}

                              <div className="mb-1 flex items-center justify-between gap-6 pr-6">
                                <span className="line-clamp-1 text-[11px] font-semibold text-slate-100">
                                  {n.title}
                                </span>
                                {!n.read && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-[2px] text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                                    Nuevo
                                  </span>
                                )}
                              </div>

                              <p className="mb-1 line-clamp-2 text-[11px] text-slate-400">
                                {n.summary || 'Sin descripción.'}
                              </p>

                              <div className="flex flex-col items-start text-[10px] text-slate-500">
                                <span className="line-clamp-1">
                                  Proyecto:{' '}
                                  <span className="text-slate-300">{n.project || 'General'}</span>
                                </span>
                                <span>
                                  Vence: <span className="text-slate-300">{dueLabel}</span>
                                </span>
                              </div>

                              <div className="mt-1 text-[10px] text-slate-500">
                                Asignado:{' '}
                                <span className="text-slate-300">
                                  {createdDate
                                    ? createdDate.toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                      }) + ` · ${timeLabel} hs`
                                    : 'Fecha no disponible'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Mobile: botón hamburguesa + panel dentro del mismo root (fix) */}
        <div className="flex items-center gap-2 md:hidden" id="menu-mobile-root">
          {/* Campanita en mobile (NO vendedor) */}
          {canSeeNotifs && (
            <div className="relative" id="menu-notif">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifOpen((v) => !v);
                  setMobileOpen(false);
                  setMobileBranchesOpen(false);
                  setMobileUserOpen(false);
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-slate-50">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 w-[330px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-slate-100 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-1 flex items-center justify-between gap-4 px-2 pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Proyectos asignados
                      </span>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={notifications.length === 0 || unreadCount === 0}
                        className="text-[10px] text-slate-100 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Marcar todo
                      </button>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="px-2 py-3 text-[11px] text-slate-500">
                        No tenés proyectos asignados por ahora.
                      </div>
                    ) : (
                      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`relative rounded-lg border px-3 py-2 transition ${
                              n.read
                                ? 'border-slate-900 bg-slate-900/40'
                                : 'border-slate-700 bg-slate-900/80'
                            }`}
                          >
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => handleMarkOneRead(n.id)}
                                className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                            <div className="pr-6 text-[11px] font-semibold text-slate-100">
                              {n.title}
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-2">
                              {n.summary || 'Sin descripción.'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMobileOpen((v) => !v);
              setNotifOpen(false);
              setMobileBranchesOpen(false);
              setMobileUserOpen(false);
              setOpenCtes(false);
              setUserOpen(false);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="absolute left-0 right-0 top-16 z-50 border-t border-slate-800 bg-gray-900/95 backdrop-blur md:hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto max-w-7xl px-4 py-3">
                  {!loading && !logged && (
                    <Link
                      href="/login"
                      className="flex items-center gap-2 rounded-xl border border-slate-400 px-3 py-2 text-slate-100 hover:bg-slate-800"
                      onClick={closeAllMenus}
                    >
                      <LogIn className="h-4 w-4" />
                      Ingresar
                    </Link>
                  )}

                  {logged && (
                    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setMobileUserOpen((v) => !v)}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-sm font-bold text-slate-200">
                            {initials}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-sm text-slate-100">
                              Hola, <b>{firstName}</b>
                            </span>
                            <span className="text-xs text-slate-400">{me?.email}</span>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-300 transition ${
                            mobileUserOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {mobileUserOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                              <Link
                                href="/perfil"
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                onClick={closeAllMenus}
                              >
                                <User className="h-4 w-4" />
                                Mi perfil
                              </Link>

                              {role === 'admin' && (
                                <Link
                                  href="/admin"
                                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                                  onClick={closeAllMenus}
                                >
                                  <Shield className="h-4 w-4" />
                                  Panel de administrador
                                </Link>
                              )}

                              {role === 'admin' && (
                                <Link
                                  href="/admin/solicitudes"
                                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                  onClick={closeAllMenus}
                                >
                                  <ClipboardList className="h-4 w-4" />
                                  <span>Solicitudes</span>
                                  {pendingCount !== null && pendingCount > 0 && (
                                    <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-none text-slate-900">
                                      {pendingCount}
                                    </span>
                                  )}
                                </Link>
                              )}

                              {role === 'admin' && (
                                <Link
                                  href="/gerencia"
                                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                  onClick={closeAllMenus}
                                >
                                  <Hammer className="h-4 w-4" />
                                  Recursos
                                </Link>
                              )}

                              <button
                                type="button"
                                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-100 hover:bg-slate-800"
                                onClick={async () => {
                                  closeAllMenus();
                                  await supabase.auth.signOut();
                                  window.location.replace('/login');
                                }}
                              >
                                <LogOut className="h-4 w-4" />
                                Salir
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Links mobile */}
                  <div className="space-y-2">
                    {canSeeWorkSection && (
                      <Link
                        href="/tareas"
                        className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sky-300 hover:bg-slate-800"
                        onClick={closeAllMenus}
                      >
                        <CalendarDays className="h-4 w-4" />
                        Mis tareas
                      </Link>
                    )}

                    {canSeeProjects && (
                      <Link
                        href="/proyectos"
                        className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-emerald-300 hover:bg-slate-800"
                        onClick={closeAllMenus}
                      >
                        <ListChecks className="h-4 w-4" />
                        Proyectos
                      </Link>
                    )}

                    {logged && isActive && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/40">
                        <button
                          type="button"
                          onClick={() => setMobileBranchesOpen((v) => !v)}
                          className="flex w-full items-center justify-between px-3 py-2 text-slate-100"
                        >
                          <span className="text-sm font-semibold">Sucursales</span>
                          <ChevronDown
                            className={`h-4 w-4 transition ${
                              mobileBranchesOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {mobileBranchesOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden border-t border-slate-800"
                            >
                              <div className="p-2 space-y-1">
                                {showCorrientesDropdown && (
                                  <>
                                    {hasCorrientes && (
                                      <Link
                                        href="/corrientes/masivos"
                                        className="block rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                        onClick={closeAllMenus}
                                      >
                                        Corrientes · Masivos
                                      </Link>
                                    )}
                                    {hasRefrigerados && (
                                      <Link
                                        href="/corrientes/refrigerados"
                                        className="block rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                        onClick={closeAllMenus}
                                      >
                                        Corrientes · Refrigerados
                                      </Link>
                                    )}
                                  </>
                                )}

                                {branches.includes('chaco') && (
                                  <Link
                                    href="/chaco"
                                    className="block rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                    onClick={closeAllMenus}
                                  >
                                    Chaco
                                  </Link>
                                )}
                                {branches.includes('misiones') && (
                                  <Link
                                    href="/misiones"
                                    className="block rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                    onClick={closeAllMenus}
                                  >
                                    Misiones
                                  </Link>
                                )}
                                {branches.includes('obera') && (
                                  <Link
                                    href="/obera"
                                    className="block rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800"
                                    onClick={closeAllMenus}
                                  >
                                    Oberá
                                  </Link>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
