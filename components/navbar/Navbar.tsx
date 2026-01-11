'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from '@/hooks/useMe';
import { supabase } from '@/lib/supabaseClient';
import {
  Menu,
  Bell,
  LogOut,
  ClipboardList,
  Hammer,
  User,
  Check,
  BadgeCheck,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import SidebarDrawer from './SidebarDrawer';
import { getNavModel } from './getNavModel';

import { Skeleton } from '@/components/ui/skeleton';

type TaskNotification = {
  id: number;
  title: string;
  summary: string | null;
  due_date: string | null;
  project: string;
  created_at: string;
  read: boolean;
};

const getNotifStorageKey = (userId: string) => `project_notifs_last_seen_${userId}`;

/* ---------------- helpers rol -> label ---------------- */
function roleLabel(role: string) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'Administrador';
  if (r === 'jdv') return 'JDV';
  if (r === 'supervisor') return 'Supervisor';
  if (r === 'rrhh') return 'RRHH';
  return 'Vendedor';
}

function roleChipClass(role: string) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'border-amber-300/40 bg-amber-500/10 text-amber-200';
  if (r === 'jdv') return 'border-indigo-300/40 bg-indigo-500/10 text-indigo-200';
  if (r === 'supervisor') return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-200';
  if (r === 'rrhh') return 'border-pink-300/40 bg-pink-500/10 text-pink-200';
  return 'border-slate-300/30 bg-white/5 text-slate-200';
}

/* ---------------- UI: Skeleton (simple) ---------------- */
/* function NavSkeletonSimple() {
  return (
    <div className="flex items-center gap-2">
      <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
        <Skeleton className="h-4 w-40 rounded-md bg-slate-800/60" />
        <span className="mx-1 h-4 w-px bg-white/10" />
        <Skeleton className="h-7 w-24 rounded-full bg-slate-800/55" />
      </div>

      
      <Skeleton className="h-10 w-10 rounded-full bg-slate-800/60" />
      <Skeleton className="h-10 w-10 rounded-full bg-slate-800/60" />
    </div>
  );
} */

  function NavSkeletonPills() {
  return (
    <div className="flex items-center gap-2">
      <div className="hidden lg:flex items-center gap-2">
        <Skeleton className="h-9 w-36 rounded-full bg-gray-500/60" />
        <Skeleton className="h-9 w-44 rounded-full bg-gray-500/60" />
      </div>
      
      <Skeleton className="h-10 w-10 rounded-full bg-gray-500/60" />
      <Skeleton className="h-10 w-10 rounded-full bg-gray-500/60" />
      <Skeleton className="h-10 w-10 rounded-full bg-gray-500/60" />
    </div>
  );
}

export default function Navbar() {
  const { me, loading } = useMe();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Notificaciones
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Dropdown notificaciones
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  // Solicitudes (badge admin)
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const logged = !!me;
  const role = me?.role ?? 'vendedor';
  const isActive = !!me?.is_active;
  const isVendor = role === 'vendedor';
  const isAdmin = role === 'admin';

  // Campanita solo usuarios internos activos (no vendedor)
  const canSeeNotifs = logged && isActive && !isVendor;

  const branches = useMemo(
    () => (me?.branches ?? []).map((b) => String(b).toLowerCase()),
    [me?.branches],
  );

  // Nombre completo
  const fullName = useMemo(() => {
    const n = (me?.full_name ?? '').trim();
    if (n) return n;
    return (me?.email ?? '').split('@')[0] ?? 'Usuario';
  }, [me?.full_name, me?.email]);

  // ✅ no parpadea al volver a la pestaña
  const showSkeleton = loading && !me;

  // ─────────────────────────────────────────
  // Cerrar dropdowns por click fuera / ESC
  // ─────────────────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const inside = t.closest?.('#menu-notif');
      if (!inside) setNotifOpen(false);
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signup_requests' }, () => fetchCount())
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
      try {
        const _lastSeen = localStorage.getItem(getNotifStorageKey(me.id));
        void _lastSeen;
      } catch {
        // ignore
      }
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

  const handleMarkOneRead = (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  // Modelo de navegación (drawer)
  const navSections = useMemo(() => {
    return getNavModel(
      {
        logged,
        isActive,
        role,
        branches,
      },
      {
        pendingCount,
        unreadNotifs: unreadCount,
      },
    );
  }, [logged, isActive, role, branches, pendingCount, unreadCount]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-gray-900/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Left: burger + logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <img src="/LogoRedcom.png" alt="Redcom" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold tracking-wide text-white">REDCOM</span>
          </Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {showSkeleton ? (
            <NavSkeletonPills />
          ) : (
            <>
              {/* Admin quick links */}
              {logged && isActive && isAdmin && (
                <>
                  <Link
                    href="/admin/solicitudes"
                    className={cn(
                      'relative hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 md:inline-flex',
                    )}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Solicitudes
                    {pendingCount !== null && pendingCount > 0 && (
                      <span className="ml-1 inline-flex min-w-[1.6rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-none text-slate-900">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/gerencia"
                    className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 md:inline-flex"
                  >
                    <Hammer className="h-4 w-4" />
                    Recursos
                  </Link>
                </>
              )}

              {/* Saludo + rol */}
              {logged && (
                <div className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 lg:flex">
                  <span>
                    Hola, <b className="ml-1 text-slate-50">{fullName}</b>
                  </span>

                  <span className="mx-1 h-4 w-px bg-white/10" />

                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-extrabold',
                      roleChipClass(role),
                    )}
                    title={`Rol: ${roleLabel(role)}`}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {roleLabel(role)}
                  </span>
                </div>
              )}

              {/* Campanita */}
              {canSeeNotifs && (
                <div className="relative" id="menu-notif" ref={notifRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotifOpen((v) => !v);
                    }}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
                    aria-label="Notificaciones"
                  >
                    <Bell className="h-5 w-5" />
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
                        className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur p-2 text-xs text-slate-100 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mb-1 flex items-center justify-between gap-4 px-2 pb-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Proyectos asignados
                          </span>

                          <div className="flex items-center gap-3">
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
                              onClick={() => setNotifOpen(false)}
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
                            {notifications.map((n) => (
                              <div
                                key={n.id}
                                className={cn(
                                  'relative rounded-xl border px-3 py-2 transition',
                                  n.read
                                    ? 'border-slate-900 bg-slate-900/40'
                                    : 'border-slate-700 bg-slate-900/80',
                                )}
                              >
                                {!n.read && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkOneRead(n.id)}
                                    className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30"
                                    aria-label="Marcar como leída"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                )}
                                <div className="pr-6 text-[11px] font-semibold text-slate-100">{n.title}</div>
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

              {/* Perfil */}
              {logged && (
                <Link
                  href="/perfil"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
                  aria-label="Ir a perfil"
                  title="Perfil"
                >
                  <User className="h-5 w-5" />
                </Link>
              )}

              {/* Logout */}
              {logged && (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.replace('/login');
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
                  aria-label="Cerrar sesión"
                  title="Salir"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              )}

              {!logged && (
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Ingresar
                </Link>
              )}
            </>
          )}
        </div>

        {/* Drawer */}
        <SidebarDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          sections={navSections}
          title="Navegación"
        />
      </nav>
    </header>
  );
}
