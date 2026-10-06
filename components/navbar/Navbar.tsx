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
  Clock3,
  ArrowUpRight,
  Inbox,
  Sparkles,
  ChevronDown,
  Command,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import SidebarDrawer from './SidebarDrawer';
import { getNavModel } from './getNavModel';
import { useModulePermissions } from '@/components/permissions/ModulePermissionsProvider';

import { Skeleton } from '@/components/ui/skeleton';

type VendoPendingSummary = { total: number; altas: number; bajas: number };

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
  if (!r) return 'Usuario';
  return r
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const { canAccessModule, overrides } = useModulePermissions();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [roleDisplayName, setRoleDisplayName] = useState<string>('');

  // Notificaciones
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [vendoPending, setVendoPending] = useState<VendoPendingSummary>({ total: 0, altas: 0, bajas: 0 });
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
  const bellCount = unreadCount + (isAdmin ? vendoPending.total : 0);

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

  useEffect(() => {
    let cancelled = false;
    if (!me?.role) {
      setRoleDisplayName('');
      return;
    }

    supabase
      .from('user_types')
      .select('name')
      .eq('code', me.role)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRoleDisplayName(String(data?.name || ''));
      });

    return () => {
      cancelled = true;
    };
  }, [me?.role]);

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
  // Solicitudes VENDO pendientes en la campanita (administración)
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!me || role !== 'admin') {
      setVendoPending({ total: 0, altas: 0, bajas: 0 });
      return;
    }

    let cancelled = false;

    const fetchVendoPending = async () => {
      const { data, error } = await supabase
        .from('vendo_requests')
        .select('movement_type')
        .eq('status', 'pending');

      if (cancelled) return;
      if (error) {
        console.error('Error contando solicitudes VENDO pendientes', error);
        setVendoPending({ total: 0, altas: 0, bajas: 0 });
        return;
      }

      const rows = data ?? [];
      const altas = rows.filter((row: any) => row.movement_type === 'alta').length;
      const bajas = rows.filter((row: any) => row.movement_type === 'baja').length;
      setVendoPending({ total: rows.length, altas, bajas });
    };

    fetchVendoPending();

    const channel = supabase
      .channel('vendo_requests_navbar_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendo_requests' }, () => fetchVendoPending())
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
        canAccessModule,
      },
      {
        pendingCount,
        unreadNotifs: unreadCount,
      },
    );
  }, [logged, isActive, role, branches, pendingCount, unreadCount, canAccessModule, overrides]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.08] bg-[#F4F5F7]/[0.86] backdrop-blur-2xl">
      <nav className="mx-auto grid h-[72px] max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand + launcher */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-black/[0.08] bg-white/75 text-[#111318] shadow-[0_2px_8px_rgba(15,23,42,.06)] transition hover:bg-white active:scale-[0.97]"
            aria-label="Abrir navegación"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-[12px] px-1.5 py-1 transition"
          >
            <img
              src="/LogoRedcom.png"
              alt="Redcom"
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-[14px] font-semibold tracking-[0.01em] text-[#111318]">
                REDCOM
              </div>
              <div className="-mt-0.5 truncate text-[8px] font-medium uppercase tracking-[0.16em] text-slate-400">
                Workspace
              </div>
            </div>
          </Link>
        </div>

        {/* Contextual navigation */}
        <div className="flex min-w-0 justify-center">
          {showSkeleton ? (
            <NavSkeletonPills />
          ) : logged && isActive ? (
            <div className="hidden max-w-full items-center gap-1 rounded-[14px] border border-black/[0.07] bg-white/70 p-1 shadow-[0_5px_22px_rgba(15,23,42,.06)] md:flex">
              {isAdmin ? (
                <>
                  <Link
                    href="/admin/solicitudes"
                    className="relative inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-[11px] font-medium text-slate-600 transition hover:bg-[#F1F2F4] hover:text-slate-950"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                    Solicitudes
                    {pendingCount !== null && pendingCount > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[#2b2307]">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    ) : null}
                  </Link>

                  <Link
                    href="/gerencia"
                    className="inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-[11px] font-medium text-slate-600 transition hover:bg-[#F1F2F4] hover:text-slate-950"
                  >
                    <Hammer className="h-3.5 w-3.5 text-slate-400" />
                    Gerencia
                  </Link>

                  <span className="mx-1 h-5 w-px bg-black/[0.07]" />
                </>
              ) : null}

              <div className="flex min-w-0 items-center gap-2 rounded-[10px] bg-[#111318] px-3 py-2 text-white shadow-sm">
                <div className="max-w-[190px] truncate text-[11px]">
                  <span className="text-white/[0.46]">Hola, </span>
                  <span className="font-medium text-white/[0.94]">{fullName}</span>
                </div>

                <span className="h-4 w-px bg-white/[0.10]" />

                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-medium',
                    roleChipClass(role),
                  )}
                  title={`Rol: ${roleDisplayName || roleLabel(role)}`}
                >
                  <BadgeCheck className="h-3 w-3" />
                  {roleDisplayName || roleLabel(role)}
                </span>
              </div>
            </div>
          ) : (
            <div className="hidden items-center gap-2 rounded-[12px] border border-black/[0.07] bg-white/70 px-3 py-2 text-[11px] text-slate-500 md:flex">
              <Command className="h-3.5 w-3.5" />
              Redcom
            </div>
          )}
        </div>

        {/* System actions */}
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {showSkeleton ? null : (
            <>
              {canSeeNotifs ? (
                <div className="relative" id="menu-notif" ref={notifRef}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setNotifOpen((value) => !value);
                    }}
                    className={cn(
                      'relative grid h-9 w-9 place-items-center rounded-[11px] border text-white/[0.58] transition duration-150 active:scale-[0.97]',
                      notifOpen
                        ? 'border-[#0a84ff]/25 bg-[#0a84ff]/10 text-[#8bc7ff]'
                        : 'border-transparent bg-transparent hover:border-white/[0.06] hover:bg-white/[0.055] hover:text-white',
                    )}
                    aria-label="Notificaciones"
                  >
                    <Bell className="h-[18px] w-[18px]" />
                    {bellCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-[#1d1d1f] bg-rose-500 px-1 text-[8px] font-bold leading-none text-white">
                        {bellCount > 99 ? '99+' : bellCount}
                      </span>
                    ) : null}
                  </button>

                  <AnimatePresence>
                    {notifOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.975 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.975 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="absolute right-0 mt-2.5 w-[min(460px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#17181b]/[0.985] text-white shadow-[0_28px_80px_rgba(0,0,0,.50)] backdrop-blur-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-4 border-b border-white/[0.065] px-5 py-5">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-[#0a84ff]/15 bg-[#0a84ff]/10 text-[#5ac8fa]">
                              <Bell className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-[15px] font-semibold text-white/[0.94]">
                                Notificaciones
                              </div>
                              <p className="mt-0.5 text-[11px] leading-5 text-white/[0.34]">
                                Actividad pendiente y asignaciones recientes.
                              </p>
                            </div>
                          </div>

                          {notifications.length > 0 && unreadCount > 0 ? (
                            <button
                              type="button"
                              onClick={handleMarkAllRead}
                              className="shrink-0 rounded-[9px] px-2.5 py-1.5 text-[11px] font-medium text-[#8bc7ff] transition hover:bg-[#0a84ff]/10"
                            >
                              Marcar leídas
                            </button>
                          ) : null}
                        </div>

                        <div className="max-h-[min(72vh,620px)] overflow-y-auto p-4">
                          {isAdmin ? (
                            <Link
                              href="/admin/vendo"
                              onClick={() => setNotifOpen(false)}
                              className={cn(
                                'group mb-3 block rounded-[16px] border p-4 transition',
                                vendoPending.total > 0
                                  ? 'border-amber-300/12 bg-amber-400/[0.055] hover:bg-amber-400/[0.08]'
                                  : 'border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.045]',
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.045] text-white/[0.52]">
                                    <ClipboardList className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-semibold text-white/[0.84]">
                                      Solicitudes VENDO
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-white/[0.34]">
                                      {vendoPending.total > 0
                                        ? `${vendoPending.total} pendiente${vendoPending.total === 1 ? '' : 's'} de revisión`
                                        : 'Sin solicitudes pendientes'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  {vendoPending.total > 0 ? (
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-semibold text-amber-200">
                                      {vendoPending.total}
                                    </span>
                                  ) : null}
                                  <ArrowUpRight className="h-3.5 w-3.5 text-white/[0.20] transition group-hover:text-white/[0.52]" />
                                </div>
                              </div>

                              {vendoPending.total > 0 ? (
                                <div className="mt-3 flex gap-1.5 pl-[42px]">
                                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                                    Altas {vendoPending.altas}
                                  </span>
                                  <span className="rounded-full bg-rose-400/10 px-2 py-1 text-[10px] font-medium text-rose-300">
                                    Bajas {vendoPending.bajas}
                                  </span>
                                </div>
                              ) : null}
                            </Link>
                          ) : null}

                          <div className="mb-2 flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/[0.32]">
                              <Sparkles className="h-3 w-3" />
                              Proyectos asignados
                            </div>
                            <Link
                              href="/proyectos"
                              className="text-[11px] font-medium text-[#8bc7ff] transition hover:text-[#b9ddff]"
                              onClick={() => setNotifOpen(false)}
                            >
                              Ver proyectos
                            </Link>
                          </div>

                          {notifications.length === 0 ? (
                            <div className="grid min-h-[150px] place-items-center rounded-[15px] border border-dashed border-white/[0.065] bg-white/[0.015] px-5 text-center">
                              <div>
                                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white/[0.035] text-white/[0.20]">
                                  <Inbox className="h-4 w-4" />
                                </div>
                                <div className="mt-2.5 text-[12px] font-semibold text-white/[0.56]">
                                  Todo al día
                                </div>
                                <p className="mt-1 text-[11px] leading-5 text-white/[0.28]">
                                  No tenés nuevas asignaciones de proyectos.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {notifications.map((notification) => {
                                const date = notification.due_date
                                  ? new Date(notification.due_date)
                                  : notification.created_at
                                    ? new Date(notification.created_at)
                                    : null;

                                return (
                                  <div
                                    key={notification.id}
                                    className={cn(
                                      'group relative rounded-[15px] border px-4 py-3.5 transition',
                                      notification.read
                                        ? 'border-white/[0.045] bg-white/[0.018]'
                                        : 'border-[#0a84ff]/12 bg-[#0a84ff]/[0.045]',
                                    )}
                                  >
                                    <div className="flex items-start gap-3">
                                      <span
                                        className={cn(
                                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                                          notification.read
                                            ? 'bg-white/[0.15]'
                                            : 'bg-[#5ac8fa]',
                                        )}
                                      />

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="truncate text-[12px] font-semibold text-white/[0.84]">
                                              {notification.title}
                                            </div>
                                            {notification.project ? (
                                              <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.06em] text-white/[0.28]">
                                                {notification.project}
                                              </div>
                                            ) : null}
                                          </div>

                                          {!notification.read ? (
                                            <button
                                              type="button"
                                              onClick={() => handleMarkOneRead(notification.id)}
                                              className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[#74d6a7] transition hover:bg-emerald-400/10"
                                              aria-label="Marcar como leída"
                                              title="Marcar como leída"
                                            >
                                              <Check className="h-3.5 w-3.5" />
                                            </button>
                                          ) : null}
                                        </div>

                                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-white/[0.38]">
                                          {notification.summary || 'Sin descripción registrada.'}
                                        </p>

                                        {date && !Number.isNaN(date.getTime()) ? (
                                          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/[0.26]">
                                            <Clock3 className="h-3 w-3" />
                                            {date.toLocaleDateString('es-AR', {
                                              day: '2-digit',
                                              month: 'short',
                                            })}
                                            {' · '}
                                            {date.toLocaleTimeString('es-AR', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-white/[0.055] bg-black/[0.08] px-4 py-2.5 text-center text-[10px] text-white/[0.22]">
                          Las nuevas asignaciones aparecen en tiempo real.
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}


              {logged ? (
                <Link
                  href="/perfil"
                  className="hidden h-9 items-center gap-2 rounded-[11px] border border-black/[0.07] bg-white/75 px-2.5 text-[11px] font-medium text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,.04)] transition hover:bg-white hover:text-slate-950 lg:inline-flex"
                  aria-label="Ir a perfil"
                  title="Perfil"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="max-w-[120px] truncate">{fullName.split(' ')[0]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
                </Link>
              ) : null}

              {logged ? (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.replace('/login');
                  }}
                  className="grid h-9 w-9 place-items-center rounded-[11px] border border-black/[0.07] bg-white/75 text-slate-500 shadow-[0_2px_8px_rgba(15,23,42,.04)] transition hover:bg-rose-50 hover:text-rose-500 active:scale-[0.97]"
                  aria-label="Cerrar sesión"
                  title="Salir"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : null}

              {!logged ? (
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center rounded-[11px] bg-[#111318] px-4 text-[11px] font-medium text-white transition hover:bg-black"
                >
                  Ingresar
                </Link>
              ) : null}
            </>
          )}
        </div>

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
