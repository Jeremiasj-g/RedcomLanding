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

  // Menú Corrientes (Masivos/Refrigerados)
  const [openCtes, setOpenCtes] = useState(false);

  // Menú de usuario (avatar)
  const [userOpen, setUserOpen] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);

  // Notificaciones proyectos
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);

  const logged = !!me;
  const branches = useMemo(
    () => (me?.branches ?? []).map((b) => b.toLowerCase()),
    [me?.branches],
  );

  const hasCorrientes = branches.includes('corrientes');
  const hasRefrigerados = branches.includes('refrigerados');
  const showCorrientesDropdown = hasCorrientes || hasRefrigerados;

  // Contador de solicitudes pendientes
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // ─────────────────────────────────────────
  // Solicitudes pendientes (admin)
  // ─────────────────────────────────────────
  useEffect(() => {
    // Solo admins necesitan ver el contador
    if (!me || me.role !== 'admin') {
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

    // primera carga
    fetchCount();

    // Realtime: escuchar cualquier cambio en signup_requests
    const channel = supabase
      .channel('signup_requests_admin_badge')
      .on(
        'postgres_changes',
        {
          event: '*', // insert | update | delete
          schema: 'public',
          table: 'signup_requests',
        },
        () => {
          // cada vez que cambie la tabla, refrescamos el contador
          fetchCount();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me?.role]);

  // ─────────────────────────────────────────
  // Notificaciones de proyectos asignados
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!me?.id || !me.is_active) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const loadInitialNotifications = async () => {
      // ... carga inicial de tareas asignadas ...
    };

    loadInitialNotifications();

    // 🔴 AQUÍ: realtime para nuevas asignaciones de tareas
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

          // la metemos arriba de la lista
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
            const withoutDup = exists
              ? prev.filter((n) => n.id !== taskId)
              : prev;
            return [newNotif, ...withoutDup].slice(0, 10);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me?.id, me?.is_active]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ─────────────────────────────────────────
  // Cerrar dropdowns con click fuera / ESC
  // ─────────────────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.('#menu-ctes')) setOpenCtes(false);
      if (!t.closest?.('#menu-user')) setUserOpen(false);
      if (!t.closest?.('#menu-notif')) setNotifOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCtes(false);
        setUserOpen(false);
        setNotifOpen(false);
      }
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

  const toggleNotifOpen = () => {
    setNotifOpen((v) => !v);
  };

  // botón "Marcar todo como leído" (persiste usando lastSeen)
  const handleMarkAllRead = () => {
    if (!me?.id) return;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(getNotifStorageKey(me.id), nowIso);
    } catch {
      // ignore
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // marcar una sola notificación como leída (solo en memoria)
  const handleMarkOneRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-gray-900 backdrop-blur">
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
          <Link href="/" className="text-xl font-bold text-white">
            REDCOM
          </Link>
        </motion.div>

        {/* Sección derecha */}
        <div className="flex items-center gap-3">
          {/* Link a Mis tareas (para usuarios activos) */}
          {logged && me?.is_active && (
            <Link
              href="/tareas"
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-sky-300 hover:bg-slate-800 hover:text-sky-200"
            >
              <CalendarDays className="h-4 w-4" />
              <span>Mis tareas</span>
            </Link>
          )}

          {/* Link a Proyectos (solo admin y supervisores activos) */}
          {(() => {
            const canSeeProjects =
              logged &&
              me?.is_active &&
              ['admin', 'supervisor'].includes((me?.role ?? '') as string);

            if (!canSeeProjects) return null;

            return (
              <Link
                href="/proyectos"
                className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
              >
                <ListChecks className="h-4 w-4" />
                <span>Proyectos</span>
              </Link>
            );
          })()}

          {/* Sucursales visibles (solo si está logueado y activo) */}
          {logged && me?.is_active && (
            <div className="hidden items-center gap-1 md:flex">
              {/* Corrientes con submenú */}
              {showCorrientesDropdown && (
                <div className="relative" id="menu-ctes">
                  <button
                    onClick={() => setOpenCtes((v) => !v)}
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
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800"
                  href="/chaco"
                >
                  Chaco
                </Link>
              )}
              {branches.includes('misiones') && (
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800"
                  href="/misiones"
                >
                  Misiones
                </Link>
              )}
              {branches.includes('obera') && (
                <Link
                  className="rounded-xl px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800"
                  href="/obera"
                >
                  Oberá
                </Link>
              )}
            </div>
          )}

          {/* Si NO está logueado → botón Ingresar */}
          {!loading && !logged && (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl border border-slate-400 px-3 py-2 text-slate-100 transition-all hover:bg-slate-800"
            >
              <LogIn className="h-4 w-4" />
              Ingresar
            </Link>
          )}

          {/* Si está logueado → Avatar con dropdown */}
          {logged && (
            <div className="relative" id="menu-user">
              <button
                ref={userBtnRef}
                onClick={() => setUserOpen((v) => !v)}
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
                    className="absolute right-0 mt-2 w-max overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl"
                    role="menu"
                  >
                    <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
                      {me?.email}
                    </div>
                    <Link
                      href="/perfil"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                      onClick={() => setUserOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Mi perfil
                    </Link>

                    {me?.role === 'admin' && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                        onClick={() => setUserOpen(false)}
                      >
                        <Shield className="h-4 w-4" />
                        Panel de administrador
                      </Link>
                    )}

                    {/* Tareas de supervisores (solo admin) */}
                    {me?.role === 'admin' && (
                      <Link
                        href="/tareas/supervisores"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sky-300 hover:bg-slate-800 hover:text-sky-200"
                        onClick={() => setUserOpen(false)}
                      >
                        <ListChecks className="h-4 w-4" />
                        Tareas de supervisores
                      </Link>
                    )}

                    {me?.role === 'admin' && (
                      <Link
                        href="/admin/solicitudes"
                        className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                        onClick={() => setUserOpen(false)}
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

                    {me?.role === 'admin' && (
                      <Link
                        href="/gerencia"
                        className="flex items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-800"
                        onClick={() => setUserOpen(false)}
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
                        setUserOpen(false);
                        await supabase.auth.signOut();
                        window.location.replace('/login');
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Salir
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Campanita de notificaciones (solo logueado y activo) */}
          {logged && me?.is_active && (
            <div className="relative" id="menu-notif">
              <button
                type="button"
                onClick={toggleNotifOpen}
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
                    className="absolute right-0 mt-2 w-max overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-slate-100 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-1 flex gap-4 items-center justify-between px-2 pb-1">
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
                          Marcar todo como leído
                        </button>
                        <Link
                          href="/proyectos"
                          className="text-[11px] text-emerald-300 hover:text-emerald-200"
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

                          const createdDate = n.created_at
                            ? new Date(n.created_at)
                            : null;

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
                              {/* Botón individual marcar como leído */}
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
                                  <span className="text-slate-300">
                                    {n.project || 'General'}
                                  </span>
                                </span>
                                <span className="text-right">
                                  Vence:{' '}
                                  <span className="text-slate-300">
                                    {dueLabel}
                                  </span>
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
      </nav>
    </header>
  );
}
